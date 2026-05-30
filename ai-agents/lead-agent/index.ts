/**
 * Lead Agent — Entry Point
 *
 * Orchestrates the full Buyer Discovery cycle:
 *   1. Scrape procurement boards (Alibaba, Kompass, Global Sources)
 *   2. Score each discovered buyer (industry relevance + import volume + geo fit)
 *   3. Upsert Buyer records in DB (create new / update existing)
 *   4. Write AgentRunLog (RUNNING → SUCCESS or FAILED)
 *
 * Runs on a 72-hour cron schedule (configured in workers/scheduler.ts — Task 17).
 * Can also be triggered manually via POST /api/agents/leads.
 *
 * References: design.md section 4.2, requirements.md Requirement 3
 */

import "dotenv/config";
import { db } from "../../src/lib/db.js";
import { AgentType, RunStatus, BuyerSector } from "../../src/generated/prisma/enums.js";
import { scrapeProcurementBoards } from "./scrapers/procurement-board.js";
import { scoreBuyers } from "./scorers/lead-scorer.js";

// ─── Sector mapping ───────────────────────────────────────────────────────────

const SECTOR_MAP: Record<string, BuyerSector> = {
  FOOD_BEVERAGE: BuyerSector.FOOD_BEVERAGE,
  DISTRIBUTOR: BuyerSector.DISTRIBUTOR,
  IMPORTER: BuyerSector.IMPORTER,
};

// ─── Upsert helper ────────────────────────────────────────────────────────────

async function upsertBuyer(buyer: ReturnType<typeof scoreBuyers>[number]): Promise<"created" | "updated" | "skipped"> {
  // Skip entries with obvious placeholder names from fallback
  if (!buyer.companyName || buyer.companyName.length < 3) return "skipped";

  const sector = SECTOR_MAP[buyer.sector];
  if (!sector) return "skipped";

  const data = {
    companyName: buyer.companyName,
    country: buyer.country,
    sector,
    leadScore: buyer.leadScore,
    emailBusiness: buyer.emailBusiness,
    emailVerified: buyer.emailVerified,
    importVolumeHistorical: buyer.estimatedImportVolumeTons,
    scannedAt: new Date(),
  };

  // Use findFirst + update/create since companyName+country isn't a DB unique constraint
  const existing = await db.buyer.findFirst({
    where: {
      companyName: buyer.companyName,
      country: buyer.country,
    },
  });

  if (existing) {
    await db.buyer.update({
      where: { id: existing.id },
      data: {
        sector: data.sector,
        leadScore: data.leadScore,
        emailBusiness: data.emailBusiness,
        emailVerified: data.emailVerified,
        importVolumeHistorical: data.importVolumeHistorical,
        scannedAt: data.scannedAt,
      },
    });
    return "updated";
  } else {
    await db.buyer.create({ data });
    return "created";
  }
}

// ─── Agent runner ─────────────────────────────────────────────────────────────

export async function runLeadAgent(): Promise<{ success: boolean; runId: string }> {
  const startedAt = new Date();
  console.log(`[lead-agent] Starting buyer discovery at ${startedAt.toISOString()}`);

  const runLog = await db.agentRunLog.create({
    data: {
      agentType: AgentType.LEAD_AGENT,
      status: RunStatus.RUNNING,
      startedAt,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metadata: any = {
    rawBuyersFound: 0,
    buyersScored: 0,
    buyersCreated: 0,
    buyersUpdated: 0,
    buyersSkipped: 0,
    errors: [] as string[],
  };

  try {
    // ── Step 1: Scrape procurement boards ─────────────────────────────────

    let rawBuyers: Awaited<ReturnType<typeof scrapeProcurementBoards>> = [];
    try {
      rawBuyers = await scrapeProcurementBoards();
      metadata.rawBuyersFound = rawBuyers.length;
    } catch (err) {
      const msg = `Procurement board scrape failed: ${(err as Error).message}`;
      metadata.errors.push(msg);
      console.error("[lead-agent]", msg);
    }

    // ── Step 2: Score all buyers ───────────────────────────────────────────

    const scoredBuyers = scoreBuyers(rawBuyers);
    metadata.buyersScored = scoredBuyers.length;

    console.log(`[lead-agent] Scored ${scoredBuyers.length} buyers`);
    scoredBuyers.slice(0, 5).forEach((b) =>
      console.log(
        `  ${b.companyName} (${b.country}): score=${b.leadScore} ` +
          `[industry=${b.scoreBreakdown.industryRelevance} vol=${b.scoreBreakdown.importVolume} ` +
          `geo=${b.scoreBreakdown.geographicFit}] emailVerified=${b.emailVerified}`
      )
    );

    // ── Step 3: Upsert to DB ───────────────────────────────────────────────

    for (const buyer of scoredBuyers) {
      try {
        const outcome = await upsertBuyer(buyer);
        if (outcome === "created") metadata.buyersCreated++;
        else if (outcome === "updated") metadata.buyersUpdated++;
        else metadata.buyersSkipped++;
      } catch (err) {
        const msg = `Failed to upsert ${buyer.companyName}: ${(err as Error).message}`;
        metadata.errors.push(msg);
        console.warn("[lead-agent]", msg);
      }
    }

    console.log(
      `[lead-agent] DB results: created=${metadata.buyersCreated} ` +
        `updated=${metadata.buyersUpdated} skipped=${metadata.buyersSkipped}`
    );

    // ── Step 4: Mark SUCCESS ───────────────────────────────────────────────

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
      `[lead-agent] Completed in ${completedAt.getTime() - startedAt.getTime()}ms. ` +
        `Buyers: ${metadata.buyersCreated} new, ${metadata.buyersUpdated} updated`
    );

    return { success: true, runId: runLog.id };
  } catch (err) {
    const errorMessage = (err as Error).message;
    console.error("[lead-agent] Fatal error:", errorMessage);

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

if (process.argv[1]?.includes("lead-agent/index")) {
  runLeadAgent()
    .then(({ success, runId }) => {
      console.log(`[lead-agent] Done — runId: ${runId}, success: ${success}`);
      process.exit(success ? 0 : 1);
    })
    .catch((err) => {
      console.error("[lead-agent] Unhandled:", err);
      process.exit(1);
    });
}
