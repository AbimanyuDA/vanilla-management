/**
 * FOB/CIF Matrix Calculator — Freight Rate Updater
 *
 * Fetches current ocean freight rates for vanilla bean shipments from
 * Tanjung Priok (Jakarta, Indonesia) to major importing ports.
 *
 * Upserts FreightRate records in DB using the unique constraint:
 *   (originPort, destinationPort, containerType)
 *
 * Runs every 24 hours (Requirement 6.4).
 *
 * Method: DuckDuckGoSearch → ChatOpenAI structured extraction → DB upsert
 *
 * References: design.md section 4.3, requirements.md Requirement 6
 */

import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";
import { z } from "zod";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FreightRateData {
  originPort: string;
  destinationPort: string;
  destinationCountry: string;
  containerType: "20ft" | "40ft" | "LCL";
  rateUsd: number;
  validFrom: Date;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const LLM_MODEL = process.env.LLM_MODEL ?? "gpt-4o-mini";
const ORIGIN_PORT = "Tanjung Priok";
const ORIGIN_CITY = "Jakarta, Indonesia";

// Target routes (port, country pairs)
const TARGET_ROUTES = [
  { port: "Los Angeles", country: "United States" },
  { port: "Rotterdam", country: "Netherlands" },
  { port: "Yokohama", country: "Japan" },
  { port: "Sydney", country: "Australia" },
  { port: "Singapore", country: "Singapore" },
  { port: "Hamburg", country: "Germany" },
  { port: "Busan", country: "South Korea" },
];

// ─── Zod schema ───────────────────────────────────────────────────────────────

const FreightRatesSchema = z.object({
  rates: z.array(
    z.object({
      destinationPort: z.string().describe("Destination port name"),
      destinationCountry: z.string().describe("Destination country"),
      containerType: z.enum(["20ft", "40ft", "LCL"]).describe("Container type"),
      rateUsd: z
        .number()
        .describe(
          "Freight rate in USD. For 20ft/40ft: total USD per container. " +
            "For LCL: USD per cubic meter or per 100 kg (note which unit)."
        ),
      notes: z.string().optional().describe("Any caveats about this rate"),
    })
  ),
});

// ─── Freight rate fetcher ─────────────────────────────────────────────────────

export async function fetchOceanFreightRates(): Promise<FreightRateData[]> {
  const search = new DuckDuckGoSearch({ maxResults: 6 });
  const year = new Date().getFullYear();
  const month = new Date().toLocaleString("en-US", { month: "long" });

  // Search for current freight rates from Jakarta
  const searchResults = await Promise.allSettled([
    search.invoke(
      `ocean freight rates Jakarta Tanjung Priok container shipping ${month} ${year} USD`
    ),
    search.invoke(
      `container shipping rates Indonesia Los Angeles Rotterdam Yokohama ${year}`
    ),
    search.invoke(
      `LCL freight rates Indonesia to USA Europe Japan ${year} per CBM`
    ),
  ]);

  const context = searchResults
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<string>).value)
    .join("\n\n");

  const routeList = TARGET_ROUTES.map((r) => `${r.port} (${r.country})`).join(", ");

  const llm = new ChatOpenAI({
    model: LLM_MODEL,
    temperature: 0,
  }).withStructuredOutput(FreightRatesSchema, { method: "functionCalling" });

  const result = await llm.invoke([
    {
      role: "system",
      content:
        `You are an ocean freight pricing specialist. Extract current freight rate estimates ` +
        `for cargo shipments from ${ORIGIN_PORT}, ${ORIGIN_CITY} to major import ports. ` +
        `Provide rates for 20ft FCL, 40ft FCL, and LCL (per CBM or per 100kg) containers. ` +
        `Return estimates as a JSON response. ` +
        `Typical ranges (2024): Asia routes $300-800/20ft, Trans-Pacific $2000-4000/20ft, ` +
        `Asia-Europe $2500-3500/20ft. LCL is typically $100-300/CBM.`,
    },
    {
      role: "user",
      content:
        context.length > 100
          ? `Search results for current freight rates:\n${context}\n\n` +
            `Extract rates from ${ORIGIN_PORT} to: ${routeList}. ` +
            `Include all three container types (20ft, 40ft, LCL) for each route.`
          : `Provide current (${month} ${year}) ocean freight rate estimates from ` +
            `${ORIGIN_PORT} to: ${routeList}. Include 20ft, 40ft, and LCL rates.`,
    },
  ]);

  const today = new Date();

  return result.rates.map((r) => ({
    originPort: ORIGIN_PORT,
    destinationPort: r.destinationPort,
    destinationCountry: r.destinationCountry,
    containerType: r.containerType,
    rateUsd: r.rateUsd,
    validFrom: today,
  }));
}
