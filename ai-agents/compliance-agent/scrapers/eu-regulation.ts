/**
 * EU Regulation Scraper
 *
 * Fetches current MRL, phytosanitary, customs, and organic certification
 * requirements for vanilla beans destined to EU, Japan, Australia, and South Korea.
 *
 * Primary sources:
 *   - EU: Regulation (EC) No 396/2005 (MRL), Commission Reg (EU) 2019/2072, TARIC
 *   - Japan: MHLW Positive List, Ministry of Agriculture, Japan Customs
 *   - Australia: APVMA, DAFF, Australian Border Force
 *
 * Method: DuckDuckGoSearch → ChatOpenAI (functionCalling) structured extraction
 *
 * References: design.md section 4.3, requirements.md Requirement 5
 */

import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";
import { z } from "zod";
import type { ComplianceDataItem } from "./fda-feed.js";

// ─── LLM config ───────────────────────────────────────────────────────────────

const LLM_MODEL = process.env.LLM_MODEL ?? "gpt-4o-mini";

// ─── Zod schema ───────────────────────────────────────────────────────────────

const MarketComplianceSchema = z.object({
  requirements: z.array(
    z.object({
      country: z
        .string()
        .describe("Target market country or region name, e.g. 'European Union', 'Japan'"),
      requirementType: z
        .enum(["mrl", "phytosanitary", "customs", "organic_cert"])
        .describe("Type of compliance requirement"),
      description: z.string().describe("Brief description of the requirement"),
      currentValue: z
        .string()
        .describe(
          "Specific current value/threshold. E.g. '0.05 mg/kg' for MRL, " +
            "'Required — BARANTAN certificate' for phytosanitary"
        ),
      sourceUrl: z.string().describe("Official source URL"),
    })
  ),
});

// ─── Per-market scraper ───────────────────────────────────────────────────────

interface MarketSpec {
  name: string;
  queries: string[];
  systemHint: string;
}

const MARKETS: MarketSpec[] = [
  {
    name: "European Union",
    queries: [
      "EU vanilla beans pesticide MRL EC 396/2005 maximum residue levels",
      "EU phytosanitary vanilla import certificate 2019/2072",
      "EU vanilla import duty TARIC 0905 GSP Indonesia",
      "EU organic certification vanilla Regulation 2018/848",
    ],
    systemHint:
      "Regulation (EC) No 396/2005 for MRL, Commission Implementing Regulation (EU) 2019/2072 " +
      "for phytosanitary, TARIC 0905 for customs, Regulation (EU) 2018/848 for organic.",
  },
  {
    name: "Japan",
    queries: [
      "Japan vanilla MRL positive list MHLW pesticide 0905",
      "Japan vanilla phytosanitary certificate import requirements",
      "Japan vanilla import duty EPA Indonesia-Japan",
      "JAS organic certification vanilla export Japan",
    ],
    systemHint:
      "Japan Food Sanitation Act Positive List for MRL (0.01 mg/kg default), " +
      "Plant Protection Law for phytosanitary, EPA Indonesia-Japan for customs, JAS for organic.",
  },
  {
    name: "Australia",
    queries: [
      "Australia vanilla beans MRL APVMA pesticide residue",
      "Australia vanilla import biosecurity DAFF certificate",
      "Australia vanilla import duty FTA Indonesia tariff",
      "Australia organic vanilla certification ACO requirements",
    ],
    systemHint:
      "APVMA for MRL, DAFF for biosecurity/phytosanitary, Australia-Indonesia FTA for customs, " +
      "ACO or similar for organic.",
  },
];

async function scrapeOneMarket(market: MarketSpec): Promise<ComplianceDataItem[]> {
  const search = new DuckDuckGoSearch({ maxResults: 5 });

  const searchResults = await Promise.allSettled(
    market.queries.map((q) => search.invoke(q))
  );

  const context = searchResults
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<string>).value)
    .join("\n\n");

  const llm = new ChatOpenAI({
    model: LLM_MODEL,
    temperature: 0,
  }).withStructuredOutput(MarketComplianceSchema, { method: "functionCalling" });

  const result = await llm.invoke([
    {
      role: "system",
      content:
        `You are a regulatory compliance specialist for vanilla bean exports to ${market.name}. ` +
        `Extract current compliance requirements for vanilla beans (HS 0905) in JSON format. ` +
        `Regulatory references: ${market.systemHint} ` +
        `Extract all four types: mrl, phytosanitary, customs, organic_cert.`,
    },
    {
      role: "user",
      content:
        context.length > 100
          ? `Search results for ${market.name} vanilla import requirements:\n${context}\n\nExtract all four requirement types for ${market.name}.`
          : `Using your training knowledge (2024), provide vanilla bean import requirements for ${market.name} for all four types.`,
    },
  ]);

  return result.requirements.map((req) => ({
    country: market.name,
    requirementType: req.requirementType,
    description: req.description,
    currentValue: req.currentValue,
    sourceUrl: req.sourceUrl,
  }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scrapeEUAndOtherRegulations(): Promise<ComplianceDataItem[]> {
  const results = await Promise.allSettled(
    MARKETS.map((m) => scrapeOneMarket(m))
  );

  const all: ComplianceDataItem[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      all.push(...r.value);
    } else {
      console.warn(`[eu-regulation] Failed for ${MARKETS[i].name}:`, (r.reason as Error).message?.slice(0, 60));
    }
  }

  return all;
}
