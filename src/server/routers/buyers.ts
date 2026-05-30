import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Resend } from "resend";
import { router, protectedProcedure } from "@/lib/trpc";
import { BuyerSector, ProposalStatus } from "@/generated/prisma/enums";
import {
  generateProposal,
  serializeEmailDraft,
  parseEmailDraft,
} from "../../../ai-agents/lead-agent/generators/proposal-writer";

// ─── Resend client (lazy — only initialised if RESEND_API_KEY is set) ─────────

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key || key === "re_..." || key.length < 10) return null;
  return new Resend(key);
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const buyersRouter = router({
  // GET /api/buyers?country=&sector=&score_min=&score_max= — Requirement 3.4
  getBuyers: protectedProcedure
    .input(
      z.object({
        country: z.string().optional(),
        sector: z.nativeEnum(BuyerSector).optional(),
        // Numeric bounds (UI sliders / API consumers)
        scoreMin: z.number().min(0).max(100).optional(),
        scoreMax: z.number().min(0).max(100).optional(),
        // Named tiers for filter chip UI
        scoreRange: z.enum(["all", "high", "medium", "low"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Resolve score bounds — named range takes precedence over raw numbers
      let scoreMin = input.scoreMin;
      let scoreMax = input.scoreMax;
      if (input.scoreRange === "high") {
        scoreMin = 70; scoreMax = undefined;
      } else if (input.scoreRange === "medium") {
        scoreMin = 40; scoreMax = 69;
      } else if (input.scoreRange === "low") {
        scoreMin = undefined; scoreMax = 39;
      }

      return ctx.db.buyer.findMany({
        where: {
          // Case-insensitive substring match on country (Requirement 3.4)
          ...(input.country && {
            country: { contains: input.country, mode: "insensitive" },
          }),
          ...(input.sector && { sector: input.sector }),
          ...(scoreMin !== undefined || scoreMax !== undefined
            ? {
                leadScore: {
                  ...(scoreMin !== undefined && { gte: scoreMin }),
                  ...(scoreMax !== undefined && { lte: scoreMax }),
                },
              }
            : {}),
        },
        orderBy: { leadScore: "desc" },
      });
    }),

  // POST /api/buyers/:id/generate-proposal — Requirement 4.2: ≤30 second timeout
  generateProposal: protectedProcedure
    .input(z.object({ buyerId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const buyer = await ctx.db.buyer.findUniqueOrThrow({
        where: { id: input.buyerId },
      });

      // Generate proposal with a hard 28-second timeout (Requirement 4.2 allows 30s)
      const proposal = await Promise.race([
        generateProposal({
          companyName: buyer.companyName,
          country: buyer.country,
          sector: buyer.sector,
          importVolumeHistorical: buyer.importVolumeHistorical,
          emailBusiness: buyer.emailBusiness,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new TRPCError({ code: "TIMEOUT", message: "Proposal generation timed out after 28 seconds" })),
            28_000
          )
        ),
      ]);

      // Persist as DRAFT (Requirement 4.4: preview before send)
      const draft = await ctx.db.proposal.create({
        data: {
          buyerId: buyer.id,
          generatedById: ctx.session.user.id,
          quotationSheetDraft: proposal.quotationSheet,
          emailDraft: serializeEmailDraft(proposal), // JSON: { subject, body }
          status: ProposalStatus.DRAFT,
        },
      });

      // Return with parsed fields for convenient UI consumption
      return {
        ...draft,
        emailSubject: proposal.subject,
        emailBody: proposal.emailBody,
      };
    }),

  // POST /api/buyers/:id/send-proposal — Requirement 4.5: send + persist sentAt
  sendProposal: protectedProcedure
    .input(
      z.object({
        proposalId: z.string().min(1),
        // Optional overrides: user may have edited the draft in the preview modal
        emailDraftOverride: z.string().optional(),
        quotationDraftOverride: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const proposal = await ctx.db.proposal.findUniqueOrThrow({
        where: { id: input.proposalId },
        include: { buyer: true },
      });

      // Requirement 4.5: buyer must have an email
      if (!proposal.buyer.emailBusiness) {
        return {
          success: false as const,
          error: "Buyer email belum tersedia. Tidak dapat mengirim proposal.",
        };
      }

      // Apply any edits made in the preview modal
      const emailRaw = input.emailDraftOverride ?? proposal.emailDraft;
      const quotationRaw = input.quotationDraftOverride ?? proposal.quotationSheetDraft;
      const { subject, body } = parseEmailDraft(emailRaw);

      // Check Resend is configured
      const resend = getResendClient();
      if (!resend) {
        // Gracefully record as FAILED with a clear reason (Requirement 4.6)
        await ctx.db.proposal.update({
          where: { id: input.proposalId },
          data: {
            status: ProposalStatus.FAILED,
            failureReason: "RESEND_API_KEY not configured. Set it in .env to enable email delivery.",
            emailDraft: emailRaw,
            quotationSheetDraft: quotationRaw,
          },
        });
        return {
          success: false as const,
          error: "Email service not configured (RESEND_API_KEY missing).",
        };
      }

      const fromEmail =
        process.env.RESEND_FROM_EMAIL ?? "proposals@vanillaindonesia.com";

      try {
        // Compose HTML email with quotation sheet appended
        const htmlBody = `
<div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
  ${body.replace(/\n/g, "<br />")}
  <hr style="margin: 32px 0; border-color: #e5e7eb;" />
  <h2 style="color: #ECA134;">Attached Quotation</h2>
  <pre style="background: #f8f9fa; padding: 16px; border-radius: 8px; white-space: pre-wrap; font-size: 13px;">${quotationRaw}</pre>
</div>`;

        const { data, error } = await resend.emails.send({
          from: fromEmail,
          to: proposal.buyer.emailBusiness,
          subject,
          html: htmlBody,
          tags: [
            { name: "proposalId", value: proposal.id },
            { name: "buyerCompany", value: proposal.buyer.companyName },
          ],
        });

        if (error || !data?.id) {
          throw new Error(error?.message ?? "Unknown Resend error");
        }

        // Requirement 4.5: record SENT + sentAt
        await ctx.db.proposal.update({
          where: { id: input.proposalId },
          data: {
            status: ProposalStatus.SENT,
            sentAt: new Date(),
            emailDraft: emailRaw,
            quotationSheetDraft: quotationRaw,
            failureReason: null,
          },
        });

        return { success: true as const, emailId: data.id };
      } catch (err) {
        const failureReason = (err as Error).message;

        // Requirement 4.6: FAILED status + preserve draft for retry
        await ctx.db.proposal.update({
          where: { id: input.proposalId },
          data: {
            status: ProposalStatus.FAILED,
            failureReason,
            emailDraft: emailRaw,
            quotationSheetDraft: quotationRaw,
          },
        });

        return { success: false as const, error: failureReason };
      }
    }),

  // GET /api/buyers/:id/proposals
  getProposals: protectedProcedure
    .input(z.object({ buyerId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.proposal.findMany({
        where: { buyerId: input.buyerId },
        orderBy: { createdAt: "desc" },
      });
    }),

  // GET /api/buyers/proposals/history (Requirement 4.7: retrievable history)
  getProposalHistory: protectedProcedure
    .input(
      z.object({
        status: z.nativeEnum(ProposalStatus).optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.proposal.findMany({
        where: input.status ? { status: input.status } : {},
        include: {
          buyer: { select: { companyName: true, country: true } },
          generatedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),
});
