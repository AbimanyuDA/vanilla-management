/**
 * FDA Feed Scraper
 *
 * Fetches current MRL, phytosanitary, customs, and organic certification
 * requirements for vanilla beans destined to the United States market.
 *
 * Primary source: FDA Import Alerts + USDA APHIS + USITC tariff schedule
 * Method: DuckDuckGoSearch → ChatOpenAI (functionCalling) structured extraction
 *
 * References: design.md section 4.3, requirements.md Requirement 5
 */

import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";
import { z } from "zod";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ComplianceDataItem {
  country: string;
  requirementType: "mrl" | "phytosanitary" | "customs" | "organic_cert";
  description: string;
  currentValue: string;
  sourceUrl: string;
}

// ─── LLM config ───────────────────────────────────────────────────────────────

const LLM_MODEL = process.env.LLM_MODEL ?? "gpt-4o-mini";

// ─── Zod schema ───────────────────────────────────────────────────────────────

const FDAComplianceSchema = z.object({
  requirements: z.array(
    z.object({
      requirementType: z
        .enum(["mrl", "phytosanitary", "customs", "organic_cert"])
        .describe("Type of compliance requirement"),
      description: z
        .string()
        .describe("Brief description of the requirement"),
      currentValue: z
        .string()
        .describe(
          "The specific current value/threshold/rule, e.g. '0.1 mg/kg' for MRL, " +
            "'USDA Form PPQ 577 required' for phytosanitary, " +
            "'0% MFN rate (HS 0905.10)' for customs, " +
            "'USDA NOP certified' for organic"
        ),
      sourceUrl: z
        .string()
        .describe("URL of the official source for this requirement"),
    })
  ),
});

// ─── Scraper ──────────────────────────────────────────────────────────────────

export async function scrapeFDARegulaions(): Promise<ComplianceDataItem[]> {
  const search = new DuckDuckGoSearch({ maxResults: 6 });
  const year = new Date().getFullYear();

  // Search FDA + USDA sources for vanilla bean import requirements
  const searchResults = await Promise.allSettled([
    search.invoke(`FDA vanilla beans maximum residue level MRL pesticide ${year}`),
    search.invoke(`USDA APHIS phytosanitary certificate vanilla beans import United States`),
    search.invoke(`USITC tariff vanilla beans HS 0905 import duty United States ${year}`),
    search.invoke(`USDA NOP organic vanilla beans certification requirements ${year}`),
  ]);

  const combinedContext = searchResults
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<string>).value)
    .join("\n\n");

  const llm = new ChatOpenAI({
    model: LLM_MODEL,
    temperature: 0,
  }).withStructuredOutput(FDAComplianceSchema, { method: "functionCalling" });

  const result = await llm.invoke([
    {
      role: "system",
      content:
        "You are a regulatory compliance specialist for vanilla bean imports into the United States. " +
        "Extract the current official compliance requirements from the search results as a JSON response. " +
        "Focus on: FDA Maximum Residue Levels (MRL) for pesticides in vanilla, " +
        "USDA APHIS phytosanitary certificate requirements, " +
        "US Customs import duty rate (HS Code 0905), " +
        "and USDA National Organic Program (NOP) certification requirements. " +
        "Use precise, up-to-date values. For MRL, cite the specific mg/kg threshold.",
    },
    {
      role: "user",
      content:
        searchResults.some((r) => r.status === "fulfilled")
          ? `Search results for US vanilla import requirements:\n${combinedContext}\n\nExtract all four requirement types.`
          : "Use your training knowledge (as of 2024) to provide current US FDA/USDA vanilla bean import requirements for all four types.",
    },
  ]);

  return result.requirements.map((req) => ({
    country: "United States",
    requirementType: req.requirementType,
    description: req.description,
    currentValue: req.currentValue,
    sourceUrl: req.sourceUrl,
  }));
}
