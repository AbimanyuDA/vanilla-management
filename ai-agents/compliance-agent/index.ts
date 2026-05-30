/**
 * Compliance Agent — Entry Point
 *
 * Orchestrates the full Compliance & Freight rate update cycle:
 *   1. Scrape FDA requirements (United States)
 *   2. Scrape EU, Japan, and Australia regulations
 *   3. Detect changes vs existing ComplianceItem records → upsert + notify
 *   4. Fetch current ocean freight rates → upsert FreightRate records
 *   5. Write AgentRunLog (RUNNING → SUCCESS or FAILED)
 *
 * Schedule:
 *   - Regulation scraping: every 7 days (Requirement 5.3)
 *   - Freight rate update: every 24 hours (Requirement 6.4)
 *   Both are orchestrated here; the scheduler (Task 17) separates the cadence.
 *
 * References: design.md section 4.3, requirements.md Requirements 5, 6
 */

import "dotenv/config";
import { db } from "../../src/lib/db.js";
import { AgentType, RunStatus } from "../../src/generated/prisma/enums.js";
import { scrapeFDARegulaions } from "./scrapers/fda-feed.js";
import { scrapeEUAndOtherRegulations } from "./scrapers/eu-regulation.js";
import { fetchOceanFreightRates } from "./calculators/fob-cif-matrix.js";
import type { ComplianceDataItem } from "./scrapers/fda-feed.js";

// ─── Change detection + DB persistence ────────────────────────────────────────

/**
 * Upserts a ComplianceItem and creates a RegulationChangeNotification if the
 * value has changed. Implements Requirement 5.4 (notification on change).
 */
async function upsertComplianceItem(
  item: ComplianceDataItem
): Promise<"created" | "updated" | "unchanged"> {
  const existing = await db.complianceItem.findFirst({
    where: {
      country: item.country,
      requirementType: item.requirementType,
    },
  });

  if (!existing) {
    await db.complianceItem.create({
      data: {
        country: item.country,
        requirementType: item.requirementType,
        description: item.description,
        currentValue: item.currentValue,
        sourceUrl: item.sourceUrl,
      },
    });
    return "created";
  }

  // Change detection: compare currentValue (trimmed, case-insensitive)
  const hasChanged =
    existing.currentValue.trim().toLowerCase() !== item.currentValue.trim().toLowerCase();

  if (!hasChanged) return "unchanged";

  // Update item: rotate values
  await db.complianceItem.update({
    where: { id: existing.id },
    data: {
      previousValue: existing.currentValue,
      currentValue: item.currentValue,
      description: item.description,
      sourceUrl: item.sourceUrl,
    },
  });

  // Create notification (Requirement 5.4)
  await db.regulationChangeNotification.create({
    data: {
      country: item.country,
      regulationName: `${item.requirementType.toUpperCase()} — ${item.description.slice(0, 80)}`,
      oldValue: existing.currentValue,
      newValue: item.currentValue,
      detectedAt: new Date(),
      acknowledged: false,
    },
  });

  console.log(
    `[compliance-agent] Change detected: ${item.country} / ${item.requirementType}: ` +
      `"${existing.currentValue}" → "${item.currentValue}"`
  );

  return "updated";
}

// ─── Freight rate upsert ──────────────────────────────────────────────────────

async function upsertFreightRates(
  rates: Awaited<ReturnType<typeof fetchOceanFreightRates>>
): Promise<number> {
  let upserted = 0;
  for (const rate of rates) {
    try {
      await db.freightRate.upsert({
        where: {
          originPort_destinationPort_containerType: {
            originPort: rate.originPort,
            destinationPort: rate.destinationPort,
            containerType: rate.containerType,
          },
        },
        update: {
          rateUsd: rate.rateUsd,
          destinationCountry: rate.destinationCountry,
          validFrom: rate.validFrom,
          validUntil: null, // open-ended until next update
        },
        create: {
          originPort: rate.originPort,
          destinationPort: rate.destinationPort,
          destinationCountry: rate.destinationCountry,
          containerType: rate.containerType,
          rateUsd: rate.rateUsd,
          validFrom: rate.validFrom,
        },
      });
      upserted++;
    } catch (err) {
      console.warn(
        `[compliance-agent] Freight rate upsert failed (${rate.destinationPort}/${rate.containerType}):`,
        (err as Error).message?.slice(0, 60)
      );
    }
  }
  return upserted;
}

// ─── Agent runner ─────────────────────────────────────────────────────────────

export async function runComplianceAgent(
  options: { skipRegulations?: boolean; skipFreightRates?: boolean } = {}
): Promise<{ success: boolean; runId: string }> {
  const startedAt = new Date();
  console.log(`[compliance-agent] Starting scan at ${startedAt.toISOString()}`);

  const runLog = await db.agentRunLog.create({
    data: {
      agentType: AgentType.COMPLIANCE_AGENT,
      status: RunStatus.RUNNING,
      startedAt,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metadata: any = {
    regulationsChecked: 0,
    regulationsCreated: 0,
    regulationsUpdated: 0,
    regulationsUnchanged: 0,
    changesDetected: 0,
    freightRatesUpdated: 0,
    errors: [] as string[],
  };

  try {
    // ── Step 1 & 2: Scrape regulations ───────────────────────────────────────

    if (!options.skipRegulations) {
      console.log("[compliance-agent] Scraping FDA and EU/other regulations...");

      let allItems: ComplianceDataItem[] = [];

      // FDA (US)
      try {
        const fdaItems = await scrapeFDARegulaions();
        allItems.push(...fdaItems);
        console.log(`[compliance-agent] FDA: ${fdaItems.length} items scraped`);
      } catch (err) {
        const msg = `FDA scrape failed: ${(err as Error).message}`;
        metadata.errors.push(msg);
        console.error("[compliance-agent]", msg);
      }

      // EU + others
      try {
        const euItems = await scrapeEUAndOtherRegulations();
        allItems.push(...euItems);
        console.log(`[compliance-agent] EU/other: ${euItems.length} items scraped`);
      } catch (err) {
        const msg = `EU/other scrape failed: ${(err as Error).message}`;
        metadata.errors.push(msg);
        console.error("[compliance-agent]", msg);
      }

      // ── Step 3: Change detection + upsert ──────────────────────────────────

      metadata.regulationsChecked = allItems.length;

      for (const item of allItems) {
        try {
          const outcome = await upsertComplianceItem(item);
          if (outcome === "created") metadata.regulationsCreated++;
          else if (outcome === "updated") {
            metadata.regulationsUpdated++;
            metadata.changesDetected++;
          } else {
            metadata.regulationsUnchanged++;
          }
        } catch (err) {
          metadata.errors.push(
            `Upsert failed (${item.country}/${item.requirementType}): ${(err as Error).message}`
          );
        }
      }

      console.log(
        `[compliance-agent] Regulations: ${metadata.regulationsCreated} created, ` +
          `${metadata.regulationsUpdated} updated (changes), ${metadata.regulationsUnchanged} unchanged`
      );
    }

    // ── Step 4: Freight rates ─────────────────────────────────────────────────

    if (!options.skipFreightRates) {
      console.log("[compliance-agent] Fetching current ocean freight rates...");
      try {
        const rates = await fetchOceanFreightRates();
        metadata.freightRatesUpdated = await upsertFreightRates(rates);
        console.log(`[compliance-agent] Freight rates upserted: ${metadata.freightRatesUpdated}`);
      } catch (err) {
        const msg = `Freight rate fetch failed: ${(err as Error).message}`;
        metadata.errors.push(msg);
        console.error("[compliance-agent]", msg);
      }
    }

    // ── Step 5: Mark SUCCESS ──────────────────────────────────────────────────

    const completedAt = new Date();
    await db.agentRunLog.update({
      where: { id: runLog.id },
      data: {
        status: RunStatus.SUCCESS,
        completedAt,
        metadata,
      },
    });

    console.log(
      `[compliance-agent] Completed in ${completedAt.getTime() - startedAt.getTime()}ms. ` +
        `Changes: ${metadata.changesDetected}, ` +
        `Freight rates: ${metadata.freightRatesUpdated}`
    );

    return { success: true, runId: runLog.id };
  } catch (err) {
    const errorMessage = (err as Error).message;
    console.error("[compliance-agent] Fatal error:", errorMessage);

    await db.agentRunLog.update({
      where: { id: runLog.id },
      data: {
        status: RunStatus.FAILED,
        completedAt: new Date(),
        errorMessage,
        metadata,
      },
    });

    return { success: false, runId: runLog.id };
  } finally {
    await db.$disconnect();
  }
}

// ─── CLI entrypoint ───────────────────────────────────────────────────────────

if (process.argv[1]?.includes("compliance-agent/index")) {
  const freightOnly = process.argv.includes("--freight-only");
  const regulationsOnly = process.argv.includes("--regulations-only");

  runComplianceAgent({
    skipRegulations: freightOnly,
    skipFreightRates: regulationsOnly,
  })
    .then(({ success, runId }) => {
      console.log(`[compliance-agent] Done — runId: ${runId}, success: ${success}`);
      process.exit(success ? 0 : 1);
    })
    .catch((err) => {
      console.error("[compliance-agent] Unhandled:", err);
      process.exit(1);
    });
}
