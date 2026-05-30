/**
 * Lead Scorer
 *
 * Calculates Lead_Score (0–100) for each discovered buyer using a three-component
 * scoring formula defined in design.md section 4.2:
 *
 *   Lead_Score = industryRelevance(0–40) + importVolume(0–35) + geographicFit(0–25)
 *
 * Property 9 (design.md): Lead_Score ∈ [0, 100] for all valid inputs — enforced by
 * Math.min/max clamping after summation.
 *
 * Email verification heuristic: business domains are considered verified;
 * public webmail (gmail, yahoo, hotmail, etc.) and null emails are not.
 *
 * References: design.md section 4.2, requirements.md Requirement 3
 */

import type { RawBuyerData } from "../scrapers/procurement-board.js";

// ─── Score breakdown type ─────────────────────────────────────────────────────

export interface ScoreBreakdown {
  industryRelevance: number; // 0–40
  importVolume: number;      // 0–35
  geographicFit: number;     // 0–25
  total: number;             // 0–100
}

export interface ScoredBuyer extends RawBuyerData {
  leadScore: number;          // 0–100, clamped
  scoreBreakdown: ScoreBreakdown;
  emailVerified: boolean;
}

// ─── Industry relevance weights (max 40pts) ───────────────────────────────────

const INDUSTRY_SCORES: Record<"FOOD_BEVERAGE" | "DISTRIBUTOR" | "IMPORTER", number> = {
  FOOD_BEVERAGE: 40, // manufacturers using vanilla as ingredient — best fit
  IMPORTER: 30,      // professional commodity importers — strong fit
  DISTRIBUTOR: 25,   // ingredient distributors — good fit
};

// ─── Geographic fit weights (max 25pts) ───────────────────────────────────────
// Weighted by market size and vanilla demand intensity for Indonesian exporters

const GEO_SCORES: Record<string, number> = {
  // Tier 1 — largest vanilla markets, best Indonesian export opportunities
  "United States": 25,
  "Netherlands": 25,   // Rotterdam hub for EU
  "Germany": 24,
  "France": 24,
  "United Kingdom": 22,
  "Japan": 22,
  "Australia": 20,
  "European Union": 25, // aggregate EU entry
  // Tier 2 — strong secondary markets
  "Singapore": 18,
  "South Korea": 17,
  "Canada": 17,
  "Switzerland": 16,
  "United Arab Emirates": 15,
  "China": 15,
  "New Zealand": 14,
  "India": 12,
  "Taiwan": 12,
  // Tier 3 — emerging/niche
  "Malaysia": 11,
  "Thailand": 10,
  "Mexico": 10,
};

const GEO_SCORE_DEFAULT = 8; // for any country not in the map

// ─── Import volume score (max 35pts) ─────────────────────────────────────────
// Based on annual vanilla procurement volume in metric tons

function scoreImportVolume(volumeTons: number | null): number {
  if (volumeTons === null || volumeTons <= 0) return 3;  // unknown
  if (volumeTons >= 500) return 35;
  if (volumeTons >= 200) return 27;
  if (volumeTons >= 100) return 20;
  if (volumeTons >= 50)  return 13;
  if (volumeTons >= 10)  return 7;
  return 3; // < 10 tons
}

// ─── Email verification heuristic ────────────────────────────────────────────

const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com",
  "aol.com", "protonmail.com", "mail.com", "yandex.com", "qq.com",
  "163.com", "126.com", "live.com", "msn.com",
]);

const PLACEHOLDER_PREFIXES = ["info", "contact", "admin", "support", "noreply", "no-reply", "test"];

export function isEmailVerified(email: string | null): boolean {
  if (!email || !email.includes("@")) return false;

  const [local, domain] = email.toLowerCase().split("@");
  if (!domain || !domain.includes(".")) return false;

  // Reject public webmail
  if (PUBLIC_EMAIL_DOMAINS.has(domain)) return false;

  // Reject obvious placeholders (only if combined with generic prefix)
  if (PLACEHOLDER_PREFIXES.includes(local) && (domain === "example.com" || domain === "domain.com")) {
    return false;
  }

  return true; // business domain with specific local part — considered verified
}

// ─── Main scoring function ────────────────────────────────────────────────────

export function scoreBuyer(buyer: RawBuyerData): ScoredBuyer {
  const industryRelevance = INDUSTRY_SCORES[buyer.sector] ?? 20;
  const importVolume = scoreImportVolume(buyer.estimatedImportVolumeTons);
  const geographicFit = GEO_SCORES[buyer.country] ?? GEO_SCORE_DEFAULT;

  const raw = industryRelevance + importVolume + geographicFit;

  // Property 9: Lead_Score ∈ [0, 100]
  const total = Math.min(100, Math.max(0, Math.round(raw)));

  return {
    ...buyer,
    leadScore: total,
    scoreBreakdown: { industryRelevance, importVolume, geographicFit, total },
    emailVerified: isEmailVerified(buyer.emailBusiness),
  };
}

export function scoreBuyers(buyers: RawBuyerData[]): ScoredBuyer[] {
  return buyers.map(scoreBuyer).sort((a, b) => b.leadScore - a.leadScore);
}
