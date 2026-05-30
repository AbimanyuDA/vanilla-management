/**
 * LangChain Tool Definitions — Market Agent
 *
 * Wraps the scraper and analyzer functions as LangChain DynamicStructuredTools
 * so they can be composed into a LangChain agent or called individually.
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { fetchCommodityPrices, fetchMarketQuotaEstimates } from "./scrapers/commodity-price.js";
import { scrapeCompetitorSupply } from "./scrapers/competitor-supply.js";
import { detectGaps } from "./analyzers/gap-detector.js";

// ─── Tool: Fetch Commodity Price ──────────────────────────────────────────────

export const fetchCommodityPriceTool = new DynamicStructuredTool({
  name: "fetch_vanilla_commodity_price",
  description:
    "Fetches the current global vanilla bean spot price (USD/kg) from web sources. " +
    "Returns the spot price, the date of the price, and the data source used.",
  schema: z.object({}),
  func: async () => {
    const snapshot = await fetchCommodityPrices();
    return JSON.stringify(snapshot);
  },
});

// ─── Tool: Fetch Market Quota Estimates ───────────────────────────────────────

export const fetchMarketQuotaTool = new DynamicStructuredTool({
  name: "fetch_market_quota_estimates",
  description:
    "Fetches vanilla import quota estimates and demand growth percentages for major " +
    "importing countries (US, EU, Japan, Australia, Singapore, Germany) using World Bank " +
    "agricultural data and web search. Returns an array of market quota estimates.",
  schema: z.object({}),
  func: async () => {
    const estimates = await fetchMarketQuotaEstimates();
    return JSON.stringify(estimates);
  },
});

// ─── Tool: Scrape Competitor Supply ──────────────────────────────────────────

export const scrapeCompetitorSupplyTool = new DynamicStructuredTool({
  name: "scrape_competitor_supply",
  description:
    "Scrapes current vanilla supply conditions for the three monitored competitor " +
    "exporting countries: Madagascar, Uganda, and Papua New Guinea. " +
    "Returns spot price, harvest quality estimate, logistics issues, and supply change percentage.",
  schema: z.object({}),
  func: async () => {
    const data = await scrapeCompetitorSupply();
    return JSON.stringify(data);
  },
});

// ─── Tool: Detect Market Gaps ────────────────────────────────────────────────

export const detectMarketGapsTool = new DynamicStructuredTool({
  name: "detect_market_gaps",
  description:
    "Analyses market quota snapshots and competitor supply data to detect market gaps " +
    "where demand growth + competitor supply drop > 10%. " +
    "Returns an array of gap analyses including whether each combination triggers an alert.",
  schema: z.object({
    snapshots: z
      .array(
        z.object({
          country: z.string(),
          demandGrowthPct: z.number(),
          periodDays: z.number(),
        })
      )
      .describe("Array of MarketSnapshot records"),
    competitorData: z
      .array(
        z.object({
          country: z.string(),
          supplyDropPct: z.number(),
          logisticsIssueActive: z.boolean(),
        })
      )
      .describe("Array of competitor supply data"),
  }),
  func: async ({ snapshots, competitorData }) => {
    const analyses = detectGaps(snapshots, competitorData);
    const gaps = analyses.filter((a) => a.isGap);
    return JSON.stringify({
      total: analyses.length,
      gapsDetected: gaps.length,
      threshold: "10%",
      gaps,
    });
  },
});

// ─── Export all tools ─────────────────────────────────────────────────────────

export const marketAgentTools = [
  fetchCommodityPriceTool,
  fetchMarketQuotaTool,
  scrapeCompetitorSupplyTool,
  detectMarketGapsTool,
];
