/**
 * Competitor Supply Scraper
 *
 * Uses LangChain DuckDuckGoSearch + ChatOpenAI (withStructuredOutput) to
 * aggregate harvest news and logistics issues for the three monitored
 * competitor vanilla exporters: Madagascar, Uganda, Papua New Guinea.
 *
 * Returns structured CompetitorSupplyData that maps directly to CompetitorData
 * Prisma model fields.
 */

import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";
import { z } from "zod";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompetitorSupplyData {
  country: string;
  spotPrice: number;        // USD/kg — estimated current market price
  spotPricePrevious: number; // USD/kg — previous period price for % change calc
  harvestQualityEstimate: "low" | "medium" | "high";
  logisticsIssueActive: boolean;
  logisticsIssueDescription: string | null;
  supplyDropPct: number;    // positive = supply fell; negative = supply rose
  sourceUrls: string[];
}

// ─── Zod schema for LLM structured output ─────────────────────────────────────

const CompetitorAnalysisSchema = z.object({
  country: z.string(),
  estimatedSpotPriceUsd: z
    .number()
    .describe("Estimated vanilla bean spot price for this country in USD/kg"),
  previousSpotPriceUsd: z
    .number()
    .describe("Estimated price from 2-3 months ago in USD/kg"),
  harvestQuality: z
    .enum(["low", "medium", "high"])
    .describe("Estimated current/upcoming harvest quality"),
  hasLogisticsIssue: z.boolean(),
  logisticsDescription: z
    .string()
    .nullable()
    .describe(
      "Description of logistics issue (port closure, delays, etc.) or null"
    ),
  supplyChangeNotes: z
    .string()
    .describe("Brief note about whether supply is increasing or decreasing"),
});

const LLM_MODEL = process.env.LLM_MODEL ?? "gpt-4o-mini";
// functionCalling works on all Groq models with tool use support (llama-3.3-70b-versatile etc.)
// jsonSchema requires specific newer model versions
const STRUCTURED_OUTPUT_METHOD = "functionCalling" as const;

const COMPETITOR_COUNTRIES = ["Madagascar", "Uganda", "Papua New Guinea"] as const;

// ─── Core scraper ─────────────────────────────────────────────────────────────

async function scrapeOneCountry(country: string): Promise<CompetitorSupplyData> {
  const search = new DuckDuckGoSearch({ maxResults: 6 });
  const year = new Date().getFullYear();

  // Run multiple targeted searches in parallel for richer context
  const [priceResults, harvestResults, logisticsResults] = await Promise.allSettled([
    search.invoke(`vanilla beans ${country} price market ${year}`),
    search.invoke(`vanilla harvest ${country} ${year} supply quality`),
    search.invoke(`${country} vanilla export logistics shipping delay ${year}`),
  ]);

  const searchContext = [
    priceResults.status === "fulfilled" ? `PRICE:\n${priceResults.value}` : "",
    harvestResults.status === "fulfilled" ? `HARVEST:\n${harvestResults.value}` : "",
    logisticsResults.status === "fulfilled" ? `LOGISTICS:\n${logisticsResults.value}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const llm = new ChatOpenAI({
    model: LLM_MODEL,
    temperature: 0,
  }).withStructuredOutput(CompetitorAnalysisSchema, { method: STRUCTURED_OUTPUT_METHOD });

  const analysis = await llm.invoke([
    {
      role: "system",
      content:
        "You are a commodity intelligence analyst specialising in vanilla markets. " +
        "Analyse the search results about vanilla production in a competitor country and " +
        "extract structured market intelligence as a JSON response. " +
        "For prices: focus on vanilla beans (grade B/standard), FOB or local market price. " +
        "Be conservative — if data is limited, estimate based on general market knowledge. " +
        "Typical vanilla price range: $150–$600/kg depending on year and quality.",
    },
    {
      role: "user",
      content:
        `Country: ${country}\n\nSearch results:\n${searchContext || "(no results — use general knowledge)"}\n\n` +
        "Provide your market intelligence analysis.",
    },
  ]);

  // Calculate supply drop % from price change
  // Price increase = supply constraint (positive supplyDropPct = supply fell)
  const priceChangePct =
    analysis.previousSpotPriceUsd > 0
      ? ((analysis.estimatedSpotPriceUsd - analysis.previousSpotPriceUsd) /
          analysis.previousSpotPriceUsd) *
        100
      : 0;

  // Logistics issues add additional supply constraint
  const logisticsConstraint = analysis.hasLogisticsIssue ? 15 : 0;

  // Low harvest quality reduces effective tradeable supply
  const harvestConstraint =
    analysis.harvestQuality === "low"
      ? 20
      : analysis.harvestQuality === "medium"
        ? 5
        : 0;

  const supplyDropPct = Math.max(
    priceChangePct + logisticsConstraint + harvestConstraint,
    -50 // cap downside
  );

  return {
    country,
    spotPrice: analysis.estimatedSpotPriceUsd,
    spotPricePrevious: analysis.previousSpotPriceUsd,
    harvestQualityEstimate: analysis.harvestQuality,
    logisticsIssueActive: analysis.hasLogisticsIssue,
    logisticsIssueDescription: analysis.logisticsDescription,
    supplyDropPct,
    sourceUrls: [], // populated if we had real URL extraction
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scrapeCompetitorSupply(): Promise<CompetitorSupplyData[]> {
  const results = await Promise.allSettled(
    COMPETITOR_COUNTRIES.map((country) => scrapeOneCountry(country))
  );

  const successful: CompetitorSupplyData[] = [];
  const failed: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      successful.push(result.value);
    } else {
      const country = COMPETITOR_COUNTRIES[i];
      failed.push(country);
      console.warn(`[competitor-supply] Failed for ${country}:`, result.reason?.message);
      // Push a neutral fallback entry so the run doesn't produce gaps in DB
      successful.push({
        country,
        spotPrice: 250,
        spotPricePrevious: 250,
        harvestQualityEstimate: "medium",
        logisticsIssueActive: false,
        logisticsIssueDescription: null,
        supplyDropPct: 0,
        sourceUrls: [],
      });
    }
  }

  if (failed.length > 0) {
    console.warn(`[competitor-supply] Partial failure for: ${failed.join(", ")}`);
  }

  return successful;
}
