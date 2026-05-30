/**
 * Market Gap Detector
 *
 * Compares demand growth (from MarketSnapshot records) with competitor supply
 * drops (from CompetitorSupplyData). When the combined gap exceeds 10%,
 * it writes a GapAlert to the database.
 *
 * Gap condition: demandSurgePct + supplyDropPct > GAP_THRESHOLD (10%)
 *
 * Validates: design.md Property 3 — Market Gap Notification Completeness
 */

import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import type { MarketSnapshot } from "../../../src/generated/prisma/client.js";
import type { CompetitorSupplyData } from "../scrapers/competitor-supply.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const GAP_THRESHOLD_PCT = 10; // Requirement 1.3: alert when gap > 10%

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GapAnalysis {
  targetCountry: string;
  demandSurgePct: number;
  competitorCountry: string;
  supplyDropPct: number;
  gapPct: number;
  isGap: boolean;
}

// ─── Gap detection logic ──────────────────────────────────────────────────────

export function detectGaps(
  snapshots: Pick<MarketSnapshot, "country" | "demandGrowthPct" | "periodDays">[],
  competitorData: Pick<
    CompetitorSupplyData,
    "country" | "supplyDropPct" | "logisticsIssueActive"
  >[]
): GapAnalysis[] {
  const analyses: GapAnalysis[] = [];

  // Only use 30-day snapshots for gap detection (most current demand signal)
  const recentSnapshots = snapshots.filter((s) => s.periodDays === 30);

  for (const snapshot of recentSnapshots) {
    for (const competitor of competitorData) {
      const demandSurgePct = snapshot.demandGrowthPct;
      const supplyDropPct = competitor.supplyDropPct;

      // Gap = demand surge + supply drop at a competitor
      // When a competitor's supply falls AND our target market demand rises,
      // there is a market gap Indonesia can fill
      const gapPct = demandSurgePct + Math.max(supplyDropPct, 0);
      const isGap = gapPct > GAP_THRESHOLD_PCT;

      analyses.push({
        targetCountry: snapshot.country,
        demandSurgePct,
        competitorCountry: competitor.country,
        supplyDropPct,
        gapPct,
        isGap,
      });
    }
  }

  return analyses;
}

// ─── DB persistence ───────────────────────────────────────────────────────────

export async function persistGapAlerts(
  db: PrismaClient,
  analyses: GapAnalysis[]
): Promise<number> {
  const gaps = analyses.filter((a) => a.isGap);
  if (gaps.length === 0) return 0;

  let saved = 0;
  for (const gap of gaps) {
    // Check if we already have an unacknowledged alert for this target+competitor pair
    // (detected within last 24h) to avoid duplicate notifications
    const recent = await db.gapAlert.findFirst({
      where: {
        targetCountry: gap.targetCountry,
        competitorCountry: gap.competitorCountry,
        acknowledged: false,
        detectedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    if (!recent) {
      await db.gapAlert.create({
        data: {
          targetCountry: gap.targetCountry,
          demandSurgePct: gap.demandSurgePct,
          competitorCountry: gap.competitorCountry,
          supplyDropPct: gap.supplyDropPct,
          detectedAt: new Date(),
          acknowledged: false,
        },
      });
      saved++;
      console.log(
        `[gap-detector] Alert: ${gap.targetCountry} demand +${gap.demandSurgePct.toFixed(1)}% ` +
          `+ ${gap.competitorCountry} supply −${gap.supplyDropPct.toFixed(1)}% → gap ${gap.gapPct.toFixed(1)}%`
      );
    }
  }

  return saved;
}
