import { z } from "zod";
import { router, protectedProcedure } from "@/lib/trpc";
import { Region } from "@/generated/prisma/enums";

export const marketRouter = router({
  // GET /api/market/quota-analysis?region=&period=
  getImportQuota: protectedProcedure
    .input(
      z.object({
        region: z.nativeEnum(Region).optional(),
        periodDays: z.union([z.literal(30), z.literal(90), z.literal(365)]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // TODO Task 7: implement real DB query with filters
      const where: Record<string, unknown> = {};
      if (input.region) where.region = input.region;
      if (input.periodDays) where.periodDays = input.periodDays;

      return ctx.db.marketSnapshot.findMany({
        where,
        orderBy: { scannedAt: "desc" },
      });
    }),

  // GET /api/market/competitors
  getCompetitors: protectedProcedure.query(async ({ ctx }) => {
    // TODO Task 8: implement with staleness metadata
    return ctx.db.competitorData.findMany({
      orderBy: { spotPrice: "desc" },
    });
  }),

  // GET /api/market/competitors/:country/history
  getCompetitorHistory: protectedProcedure
    .input(z.object({ country: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      // TODO Task 8: filter to 30-day window
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
