/**
 * Proposal Writer
 *
 * Generates a personalized B2B proposal for a vanilla buyer using LLM.
 * Produces two artefacts:
 *   1. emailDraft — JSON string { subject, body } for professional email outreach
 *   2. quotationSheetDraft — Markdown quotation sheet with pricing, specs, terms
 *
 * This module is intentionally side-effect free (no DB, no dotenv) so it can be
 * imported cleanly by both the tRPC server (Next.js context) and the CLI agent.
 *
 * Requirement 4.2: generation must complete within 30 seconds — enforced by callers.
 * Requirement 4.3: must include buyer companyName, sector, and country.
 *
 * References: design.md section 4.2, requirements.md Requirement 4
 */

import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BuyerProfile {
  companyName: string;
  country: string;
  sector: "FOOD_BEVERAGE" | "DISTRIBUTOR" | "IMPORTER";
  importVolumeHistorical?: number | null; // metric tons/year
  emailBusiness?: string | null;
}

export interface ProposalDraft {
  subject: string;    // email subject line
  emailBody: string;  // full email body (plain text / markdown)
  quotationSheet: string; // markdown quotation sheet
}

// ─── LLM config ───────────────────────────────────────────────────────────────

const LLM_MODEL = process.env.LLM_MODEL ?? "gpt-4o-mini";

// ─── Schemas for structured output ───────────────────────────────────────────

const EmailSchema = z.object({
  subject: z.string().describe("Email subject line, professional and specific"),
  body: z
    .string()
    .describe(
      "Full email body in English. Start with salutation, introduce Vanilla Royal Indonesia, " +
        "highlight value proposition tailored to the buyer's sector, and include a clear CTA."
    ),
});

const QuotationSchema = z.object({
  quotationSheet: z
    .string()
    .describe(
      "Complete quotation sheet in Markdown format. Must include: header, buyer info, " +
        "product specification (vanilla beans grade, origin, moisture content, vanillin content), " +
        "pricing table (FOB price in USD/kg), MOQ, payment terms, delivery time, validity period."
    ),
});

// ─── Sector-specific selling points ──────────────────────────────────────────

function getSectorContext(sector: BuyerProfile["sector"]): string {
  return {
    FOOD_BEVERAGE:
      "As a food & beverage manufacturer, you need consistent quality and traceability. " +
      "Our vanilla beans offer certified organic options, consistent vanillin content, and full " +
      "farm-to-export traceability. We can support your product development with custom grades.",
    DISTRIBUTOR:
      "As a specialty ingredient distributor, you require reliable supply with competitive pricing. " +
      "We offer flexible packaging (bulk 10kg, 25kg, custom), consistent grade quality, and " +
      "attractive distributor margins with co-branding opportunities.",
    IMPORTER:
      "As a commodity importer, you value competitive FOB pricing, reliable shipment schedules, " +
      "and complete documentation. We provide full export documentation, phytosanitary certificates, " +
      "and flexible container options (LCL/FCL) from Tanjung Priok, Jakarta.",
  }[sector];
}

// ─── Reference date for quotation ────────────────────────────────────────────

function getQuotationRef(): { date: string; validUntil: string; ref: string } {
  const now = new Date();
  const validity = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const refNum = Math.floor(Math.random() * 9000 + 1000);
  return {
    date: fmt(now),
    validUntil: fmt(validity),
    ref: `VR-${now.getFullYear()}-${refNum}`,
  };
}

// ─── Generator functions ──────────────────────────────────────────────────────

async function generateEmail(buyer: BuyerProfile): Promise<{ subject: string; body: string }> {
  const llm = new ChatOpenAI({ model: LLM_MODEL, temperature: 0.4 }).withStructuredOutput(
    EmailSchema,
    { method: "functionCalling" }
  );

  const sectorCtx = getSectorContext(buyer.sector);
  const volumeCtx = buyer.importVolumeHistorical
    ? `Their historical import volume is approximately ${buyer.importVolumeHistorical} metric tons/year.`
    : "Their import volume is not specified.";

  const result = await llm.invoke([
    {
      role: "system",
      content:
        "You are an expert export sales professional for PT Vanilla Royal Indonesia, " +
        "a premium vanilla beans exporter from Sulawesi, Indonesia. " +
        "Write professional, concise business outreach emails in English. " +
        "Personalize based on the buyer's company and sector. " +
        "Tone: professional, confident, not pushy. Length: 200-300 words.",
    },
    {
      role: "user",
      content:
        `Write a business outreach email for this vanilla buyer:\n` +
        `- Company: ${buyer.companyName}\n` +
        `- Country: ${buyer.country}\n` +
        `- Sector: ${buyer.sector.replace("_", " ")}\n` +
        `- ${volumeCtx}\n\n` +
        `Sector context: ${sectorCtx}\n\n` +
        `Include: introduction of PT Vanilla Royal Indonesia, our competitive advantage ` +
        `(premium Sulawesi vanilla, consistent quality, competitive FOB pricing), ` +
        `sector-specific value proposition, and invitation to review the attached quotation.`,
    },
  ]);

  return { subject: result.subject, body: result.body };
}

async function generateQuotationSheet(buyer: BuyerProfile): Promise<string> {
  const llm = new ChatOpenAI({ model: LLM_MODEL, temperature: 0.2 }).withStructuredOutput(
    QuotationSchema,
    { method: "functionCalling" }
  );

  const { date, validUntil, ref } = getQuotationRef();
  const volumeHint = buyer.importVolumeHistorical
    ? `Buyer typically imports ~${buyer.importVolumeHistorical} MT/year.`
    : "Import volume unknown — offer flexible MOQ.";

  const result = await llm.invoke([
    {
      role: "system",
      content:
        "You are a trade documentation specialist at PT Vanilla Royal Indonesia. " +
        "Generate professional export quotation sheets in Markdown. " +
        "Use realistic vanilla bean pricing: Grade A $350-500/kg, Grade B $250-350/kg (2024-2025 market). " +
        "Include professional formatting with tables.",
    },
    {
      role: "user",
      content:
        `Generate a quotation sheet with these details:\n` +
        `- Reference: ${ref}\n` +
        `- Date: ${date}\n` +
        `- Valid Until: ${validUntil}\n` +
        `- Buyer: ${buyer.companyName}, ${buyer.country}\n` +
        `- Buyer Sector: ${buyer.sector}\n` +
        `- ${volumeHint}\n\n` +
        `Include: product specification (Grade A and Grade B vanilla beans, Sulawesi origin), ` +
        `pricing table with 3 volume tiers, FOB Tanjung Priok Incoterms, payment terms, ` +
        `delivery timeline, quality guarantee, and contact details for PT Vanilla Royal Indonesia.`,
    },
  ]);

  return result.quotationSheet;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateProposal(buyer: BuyerProfile): Promise<ProposalDraft> {
  // Run both LLM calls in parallel for speed (Requirement 4.2: ≤30 seconds)
  const [emailResult, quotationSheet] = await Promise.all([
    generateEmail(buyer),
    generateQuotationSheet(buyer),
  ]);

  return {
    subject: emailResult.subject,
    emailBody: emailResult.body,
    quotationSheet,
  };
}

/**
 * Serialise a ProposalDraft into the two DB text fields.
 * emailDraft stores JSON so the UI can render subject and body separately.
 */
export function serializeEmailDraft(draft: ProposalDraft): string {
  return JSON.stringify({ subject: draft.subject, body: draft.emailBody });
}

/**
 * Parse the DB emailDraft field back into subject + body.
 * Falls back gracefully if the field is plain text.
 */
export function parseEmailDraft(raw: string): { subject: string; body: string } {
  try {
    const parsed = JSON.parse(raw) as { subject?: string; body?: string };
    return {
      subject: parsed.subject ?? "Vanilla Beans Quotation — PT Vanilla Royal Indonesia",
      body: parsed.body ?? raw,
    };
  } catch {
    // Legacy plain-text format
    const lines = raw.split("\n");
    const subject = lines[0].replace(/^Subject:\s*/i, "");
    const body = lines.slice(2).join("\n");
    return { subject, body };
  }
}
