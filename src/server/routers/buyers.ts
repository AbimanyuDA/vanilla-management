import { z } from "zod";
import { router, protectedProcedure } from "@/lib/trpc";
import { BuyerSector, ProposalStatus } from "@/generated/prisma/enums";

export const buyersRouter = router({
  // GET /api/buyers?country=&sector=&score_min=&score_max=
  getBuyers: protectedProcedure
    .input(
      z.object({
        country: z.string().optional(),
        sector: z.nativeEnum(BuyerSector).optional(),
        scoreMin: z.number().min(0).max(100).optional(),
        scoreMax: z.number().min(0).max(100).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // TODO Task 11: implement with proper filter composition
      return ctx.db.buyer.findMany({
        where: {
          ...(input.country && { country: input.country }),
          ...(input.sector && { sector: input.sector }),
          ...(input.scoreMin !== undefined || input.scoreMax !== undefined
            ? {
                leadScore: {
                  ...(input.scoreMin !== undefined && { gte: input.scoreMin }),
                  ...(input.scoreMax !== undefined && { lte: input.scoreMax }),
                },
              }
            : {}),
        },
        orderBy: { leadScore: "desc" },
      });
    }),

  // POST /api/buyers/:id/generate-proposal
  generateProposal: protectedProcedure
    .input(z.object({ buyerId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      // TODO Task 10: call proposal-writer AI agent, return draft
      const buyer = await ctx.db.buyer.findUniqueOrThrow({
        where: { id: input.buyerId },
      });

      // Placeholder draft — replaced by AI-generated content in Task 10
      const draft = await ctx.db.proposal.create({
        data: {
          buyerId: buyer.id,
          generatedById: ctx.session.user.id,
          quotationSheetDraft: `[Quotation for ${buyer.companyName} — to be generated]`,
          emailDraft: `[Email to ${buyer.companyName} — to be generated]`,
          status: ProposalStatus.DRAFT,
        },
      });

      return draft;
    }),

  // POST /api/buyers/:id/send-proposal
  sendProposal: protectedProcedure
    .input(
      z.object({
        proposalId: z.string().cuid(),
        emailDraft: z.string().optional(),
        quotationDraft: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // TODO Task 10: send via Resend, update status
      const proposal = await ctx.db.proposal.findUniqueOrThrow({
        where: { id: input.proposalId },
        include: { buyer: true },
      });

      if (!proposal.buyer.emailBusiness) {
        return { success: false, error: "Buyer email belum terverifikasi" };
      }

      // Placeholder — actual send implemented in Task 10
      await ctx.db.proposal.update({
        where: { id: input.proposalId },
        data: {
          status: ProposalStatus.FAILED,
          failureReason: "Email service not yet configured",
        },
      });

      return { success: false, error: "Email service not yet configured" };
    }),

  // GET /api/buyers/:id/proposals
  getProposals: protectedProcedure
    .input(z.object({ buyerId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      // TODO Task 11: implement with pagination
      return ctx.db.proposal.findMany({
        where: { buyerId: input.buyerId },
        orderBy: { createdAt: "desc" },
      });
    }),

  // GET /api/buyers/proposals/history
  getProposalHistory: protectedProcedure
    .input(
      z.object({
        status: z.nativeEnum(ProposalStatus).optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      // TODO Task 11: implement with buyer info joined
      return ctx.db.proposal.findMany({
        where: input.status ? { status: input.status } : {},
        include: { buyer: { select: { companyName: true, country: true } } },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),
});
