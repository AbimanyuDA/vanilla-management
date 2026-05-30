/**
 * Procurement Board Scraper
 *
 * Scans Alibaba, Kompass, and Global Sources for vanilla importers using
 * LangChain DuckDuckGoSearch + ChatOpenAI (functionCalling for Groq compatibility).
 *
 * Falls back to LLM training knowledge when web search returns no results,
 * ensuring the agent always produces useful output even under rate limits.
 *
 * References: design.md section 4.2, requirements.md Requirement 3
 */

import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";
import { z } from "zod";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RawBuyerData {
  companyName: string;
  country: string;
  sector: "FOOD_BEVERAGE" | "DISTRIBUTOR" | "IMPORTER";
  emailBusiness: string | null;
  estimatedImportVolumeTons: number | null; // metric tons/year
  sourceUrl: string;
  confidence: "high" | "medium" | "low";
}

// ─── LLM config ───────────────────────────────────────────────────────────────

const LLM_MODEL = process.env.LLM_MODEL ?? "gpt-4o-mini";

// ─── Zod schema for structured extraction ────────────────────────────────────

const BuyerListSchema = z.object({
  buyers: z.array(
    z.object({
      companyName: z
        .string()
        .describe("Full legal company name"),
      country: z
        .string()
        .describe("Country where the company is headquartered"),
      sector: z
        .enum(["FOOD_BEVERAGE", "DISTRIBUTOR", "IMPORTER"])
        .describe(
          "Primary business sector: FOOD_BEVERAGE (manufacturers using vanilla), " +
          "IMPORTER (professional commodity importers), DISTRIBUTOR (ingredient distributors)"
        ),
      emailBusiness: z
        .string()
        .nullable()
        .describe("Official business email address, or null if not found"),
      estimatedImportVolumeTons: z
        .number()
        .nullable()
        .describe("Estimated annual vanilla import volume in metric tons, or null if unknown"),
      sourceUrl: z
        .string()
        .describe("URL or source where this company was found"),
      confidence: z
        .enum(["high", "medium", "low"])
        .describe("Confidence level in this data: high=verified source, medium=likely, low=estimated"),
    })
  ).describe("List of vanilla importing companies found"),
});

// ─── Search strategy per platform ────────────────────────────────────────────

const SEARCH_QUERIES = [
  { platform: "Alibaba",       query: "vanilla beans importer buyer company site:alibaba.com OR 'vanilla flavoring' importer" },
  { platform: "Kompass",       query: "vanilla extract importer company Kompass directory supplier" },
  { platform: "Global Sources", query: "vanilla flavoring buyer Global Sources food ingredient importer" },
  { platform: "General",       query: "vanilla beans B2B importer food flavoring company annual procurement" },
];

// ─── Single platform scrape ───────────────────────────────────────────────────

async function scrapeOnePlatform(
  platform: string,
  query: string
): Promise<RawBuyerData[]> {
  const search = new DuckDuckGoSearch({ maxResults: 6 });
  let searchResults = "";

  try {
    searchResults = await search.invoke(query);
  } catch (err) {
    console.warn(`[procurement-board] Search failed for ${platform}:`, (err as Error).message.slice(0, 60));
    // Fall through — LLM will use training knowledge
  }

  const llm = new ChatOpenAI({
    model: LLM_MODEL,
    temperature: 0.1, // slight variation to diversify discovered companies
  }).withStructuredOutput(BuyerListSchema, { method: "functionCalling" });

  const systemPrompt =
    "You are a procurement intelligence specialist for the vanilla commodity market. " +
    "Your task: identify real companies that import vanilla beans or vanilla extract in bulk. " +
    "Focus on: food & beverage manufacturers (use vanilla in products), professional vanilla " +
    "importers, and ingredient distributors. Return companies as a JSON response. " +
    "Important: only include companies where vanilla/flavoring is a significant procurement " +
    "category — not companies that just sell finished vanilla products to consumers. " +
    "Include companies from major importing markets: US, EU, Japan, Australia, Singapore.";

  const userPrompt = searchResults
    ? `Platform searched: ${platform}\nSearch results:\n${searchResults}\n\n` +
      "Extract all vanilla importer/buyer companies from these results. " +
      "If results mention a company that imports vanilla or food ingredients, include it."
    : `Platform: ${platform} (web search unavailable — use your training knowledge)\n` +
      "List major vanilla bean and vanilla extract importing companies from your knowledge. " +
      "Include companies like food flavoring manufacturers, ingredient importers, and distributors.";

  try {
    const result = await llm.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    return result.buyers.map((b) => ({
      companyName: b.companyName,
      country: b.country,
      sector: b.sector,
      emailBusiness: b.emailBusiness,
      estimatedImportVolumeTons: b.estimatedImportVolumeTons,
      sourceUrl: b.sourceUrl,
      confidence: b.confidence,
    }));
  } catch (err) {
    console.warn(`[procurement-board] LLM extraction failed for ${platform}:`, (err as Error).message.slice(0, 80));
    return [];
  }
}

// ─── Deduplication ────────────────────────────────────────────────────────────

function deduplicateBuyers(buyers: RawBuyerData[]): RawBuyerData[] {
  const seen = new Map<string, RawBuyerData>();

  for (const buyer of buyers) {
    const key = `${buyer.companyName.toLowerCase().trim()}|${buyer.country.toLowerCase().trim()}`;
    const existing = seen.get(key);
    if (!existing || buyer.confidence === "high") {
      seen.set(key, buyer);
    }
  }

  return Array.from(seen.values());
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scrapeProcurementBoards(): Promise<RawBuyerData[]> {
  console.log("[procurement-board] Starting scan across Alibaba, Kompass, Global Sources...");

  // Run all platform searches in parallel
  const results = await Promise.allSettled(
    SEARCH_QUERIES.map(({ platform, query }) => scrapeOnePlatform(platform, query))
  );

  const allBuyers: RawBuyerData[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allBuyers.push(...result.value);
    }
  }

  const unique = deduplicateBuyers(allBuyers);
  console.log(`[procurement-board] Found ${allBuyers.length} raw records → ${unique.length} after dedup`);
  return unique;
}
