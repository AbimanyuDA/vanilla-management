/**
 * Market Agent — Entry Point
 *
 * Orchestrates the full Market Intelligence scan cycle:
 *   1. Fetch vanilla commodity prices + market quota estimates
 *   2. Scrape competitor supply data (Madagascar, Uganda, Papua New Guinea)
 *   3. Persist MarketSnapshot + CompetitorData + SpotPriceHistory records
 *   4. Run gap detector → persist GapAlerts
 *   5. Write AgentRunLog (SUCCESS or FAILED)
 *
 * Runs on a 24-hour cron schedule (configured in workers/scheduler.ts — Task 17).
 * Can also be triggered manually via POST /api/agents/market.
 *
 * References: design.md section 4.1, requirements.md Requirements 1, 2
 */

import "dotenv/config";
import { db } from "../../src/lib/db.js";
import { AgentType, RunStatus } from "../../src/generated/prisma/enums.js";
import { fetchCommodityPrices, fetchMarketQuotaEstimates } from "./scrapers/commodity-price.js";
import { scrapeCompetitorSupply } from "./scrapers/competitor-supply.js";
import { detectGaps, persistGapAlerts } from "./analyzers/gap-detector.js";

// ─── Agent runner ─────────────────────────────────────────────────────────────

export async function runMarketAgent(): Promise<{ success: boolean; runId: string }> {
  const startedAt = new Date();
  console.log(`[market-agent] Starting scan at ${startedAt.toISOString()}`);

  // Create RUNNING log entry
  const runLog = await db.agentRunLog.create({
    data: {
      agentType: AgentType.MARKET_AGENT,
      status: RunStatus.RUNNING,
      startedAt,
    },
  });

  // Prisma Json field must be a plain object — avoid typed Record<string,unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metadata: any = {
    snapshotsSaved: 0,
    competitorsSaved: 0,
    priceHistoryPoints: 0,
    gapAlertsCreated: 0,
    errors: [] as string[],
  };

  try {
    // ── Step 1: Commodity price + market quota ─────────────────────────────

    console.log("[market-agent] Fetching commodity prices and market quotas...");
    let quotaEstimates: Awaited<ReturnType<typeof fetchMarketQuotaEstimates>> = [];

    try {
      const [, quotes] = await Promise.all([
        fetchCommodityPrices(), // side-effect: logs the spot price
        fetchMarketQuotaEstimates(),
      ]);
      quotaEstimates = quotes;
    } catch (err) {
      const msg = `Commodity price fetch failed: ${(err as Error).message}`;
      (metadata.errors as string[]).push(msg);
      console.error("[market-agent]", msg);
    }

    // Persist MarketSnapshot records
    if (quotaEstimates.length > 0) {
      for (const estimate of quotaEstimates) {
        await db.marketSnapshot.create({
          data: {
            country: estimate.country,
            region: estimate.region,
            importQuotaTons: estimate.importQuotaTons,
            demandGrowthPct: estimate.demandGrowthPct,
            periodDays: estimate.periodDays,
            scannedAt: startedAt,
          },
        });
      }
      metadata.snapshotsSaved = quotaEstimates.length;
      console.log(`[market-agent] Saved ${quotaEstimates.length} MarketSnapshot records`);
    }

    // ── Step 2: Competitor supply scraping ─────────────────────────────────

    console.log("[market-agent] Scraping competitor supply data...");
    let competitorData: Awaited<ReturnType<typeof scrapeCompetitorSupply>> = [];

    try {
      competitorData = await scrapeCompetitorSupply();
    } catch (err) {
      const msg = `Competitor supply scrape failed: ${(err as Error).message}`;
      (metadata.errors as string[]).push(msg);
      console.error("[market-agent]", msg);
    }

    // ── Step 3: Persist CompetitorData + SpotPriceHistory ─────────────────

    if (competitorData.length > 0) {
      for (const comp of competitorData) {
        // Upsert CompetitorData (one record per country, overwrite with latest)
        await db.competitorData.upsert({
          where: { country: comp.country },
          update: {
            spotPrice: comp.spotPrice,
            spotPricePrevious: comp.spotPricePrevious,
            harvestQualityEstimate: comp.harvestQualityEstimate,
            logisticsIssueActive: comp.logisticsIssueActive,
            logisticsIssueDescription: comp.logisticsIssueDescription,
          },
          create: {
            country: comp.country,
            spotPrice: comp.spotPrice,
            spotPricePrevious: comp.spotPricePrevious,
            harvestQualityEstimate: comp.harvestQualityEstimate,
            logisticsIssueActive: comp.logisticsIssueActive,
            logisticsIssueDescription: comp.logisticsIssueDescription,
          },
        });

        // Append a SpotPriceHistory point for today
        await db.spotPriceHistory.create({
          data: {
            competitorCountry: comp.country,
            spotPrice: comp.spotPrice,
            recordedAt: startedAt,
          },
        });
      }

      metadata.competitorsSaved = competitorData.length;
      metadata.priceHistoryPoints = competitorData.length;
      console.log(`[market-agent] Saved ${competitorData.length} CompetitorData records`);
    }

    // ── Step 4: Gap detection ──────────────────────────────────────────────

    if (quotaEstimates.length > 0 && competitorData.length > 0) {
      console.log("[market-agent] Running gap detection...");

      // Use the freshly saved snapshots (or the estimates directly)
      const gapAnalyses = detectGaps(
        quotaEstimates.map((e) => ({
          country: e.country,
          demandGrowthPct: e.demandGrowthPct,
          periodDays: e.periodDays,
        })),
        competitorData.map((c) => ({
          country: c.country,
          supplyDropPct: c.supplyDropPct,
          logisticsIssueActive: c.logisticsIssueActive,
        }))
      );

      const alertsCreated = await persistGapAlerts(db, gapAnalyses);
      metadata.gapAlertsCreated = alertsCreated;
      console.log(`[market-agent] Gap detection: ${gapAnalyses.length} analyses, ${alertsCreated} new alerts`);
    }

    // ── Step 5: Mark run SUCCESS ───────────────────────────────────────────

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
      `[market-agent] Completed in ${completedAt.getTime() - startedAt.getTime()}ms. ` +
        `Snapshots: ${metadata.snapshotsSaved}, Competitors: ${metadata.competitorsSaved}, ` +
        `Alerts: ${metadata.gapAlertsCreated}`
    );

    return { success: true, runId: runLog.id };
  } catch (err) {
    // Unrecoverable error — mark FAILED
    const errorMessage = (err as Error).message;
    console.error("[market-agent] Fatal error:", errorMessage);

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

// Allow running directly: `tsx ai-agents/market-agent/index.ts`
if (process.argv[1]?.includes("market-agent/index")) {
  runMarketAgent()
    .then(({ success, runId }) => {
      console.log(`[market-agent] Done — runId: ${runId}, success: ${success}`);
      process.exit(success ? 0 : 1);
    })
    .catch((err) => {
      console.error("[market-agent] Unhandled:", err);
      process.exit(1);
    });
}
