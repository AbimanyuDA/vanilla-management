import { z } from "zod";
import { router, protectedProcedure } from "@/lib/trpc";
import { Region } from "@/generated/prisma/enums";

export const marketRouter = router({
  // GET /api/market/quota-analysis?region=&period=
  getImportQuota: protectedProcedure
    .input(
      z.object({
        region: z.nativeEnum(Region).optional(),
        // Default to 30 when omitted so callers always get current-cycle data
        periodDays: z.union([z.literal(30), z.literal(90), z.literal(365)]).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      // Requirement 1.1: always include US, EU, JP (enforced by agent writes, not query filter)
      // Requirement 1.2: return most recent scan per country (distinct on country, ordered by scannedAt desc)
      return ctx.db.marketSnapshot.findMany({
        where: {
          periodDays: input.periodDays,
          ...(input.region !== undefined && { region: input.region }),
        },
        orderBy: [{ scannedAt: "desc" }, { country: "asc" }],
        distinct: ["country"],
      });
    }),

  // GET /api/market/competitors — sorted by spotPrice desc so highest-price country is first
  getCompetitors: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.competitorData.findMany({
      orderBy: { spotPrice: "desc" },
    });
  }),

  // GET /api/market/competitors/:country/history — Property 7: only last 30 days
  getCompetitorHistory: protectedProcedure
    .input(z.object({ country: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      return ctx.db.spotPriceHistory.findMany({
        where: {
          competitorCountry: input.country,
          recordedAt: { gte: thirtyDaysAgo },
        },
        orderBy: { recordedAt: "asc" },
      });
    }),

  // GET /api/market/notifications (unread gap alerts)
  getGapAlerts: protectedProcedure
    .input(z.object({ includeAcknowledged: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      // TODO Task 7: implement with optional acknowledged filter
      return ctx.db.gapAlert.findMany({
        where: input.includeAcknowledged ? {} : { acknowledged: false },
        orderBy: { detectedAt: "desc" },
      });
    }),

  // POST /api/market/notifications/:id/acknowledge
  markAlertRead: protectedProcedure
    .input(z.object({ alertId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      // TODO Task 7: implement
      await ctx.db.gapAlert.update({
        where: { id: input.alertId },
        data: { acknowledged: true, acknowledgedAt: new Date() },
      });
      return { success: true };
    }),
});
