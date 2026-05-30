import { z } from "zod";
import { router, protectedProcedure } from "@/lib/trpc";
import { TRPCError } from "@trpc/server";

const ContainerTypeSchema = z.enum(["20ft", "40ft", "LCL"]);
const RequirementTypeSchema = z.enum(["mrl", "phytosanitary", "customs", "organic_cert"]);

const CostingInputSchema = z.object({
  volumeKg: z.number().positive(),
  destinationCountry: z.string().min(1),
  containerType: ContainerTypeSchema,
  hppPerKg: z.number().positive().default(250), // vanilla HPP in USD/kg
});

export const complianceRouter = router({
  // GET /api/compliance/checklist/:country
  getChecklist: protectedProcedure
    .input(
      z.object({
        country: z.string().min(1),
        requirementType: RequirementTypeSchema.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // TODO Task 14: implement with grouped categories
      return ctx.db.complianceItem.findMany({
        where: {
          country: input.country,
          ...(input.requirementType && { requirementType: input.requirementType }),
        },
        orderBy: { requirementType: "asc" },
      });
    }),

  // GET /api/compliance/notifications
  getRegulationNotifications: protectedProcedure
    .input(z.object({ includeAcknowledged: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      // TODO Task 14: implement
      return ctx.db.regulationChangeNotification.findMany({
        where: input.includeAcknowledged ? {} : { acknowledged: false },
        orderBy: { detectedAt: "desc" },
      });
    }),

  // POST acknowledge regulation notification
  markRegulationNotificationRead: protectedProcedure
    .input(z.object({ notificationId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.regulationChangeNotification.update({
        where: { id: input.notificationId },
        data: { acknowledged: true },
      });
      return { success: true };
    }),

  // GET /api/compliance/freight-rates
  getFreightRates: protectedProcedure
    .input(
      z.object({
        destinationCountry: z.string().optional(),
        containerType: ContainerTypeSchema.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // TODO Task 15: implement
      return ctx.db.freightRate.findMany({
        where: {
          ...(input.destinationCountry && { destinationCountry: input.destinationCountry }),
          ...(input.containerType && { containerType: input.containerType }),
        },
        orderBy: { destinationCountry: "asc" },
      });
    }),

  // POST /api/compliance/costing/calculate
  calculateCost: protectedProcedure
    .input(CostingInputSchema)
    .mutation(async ({ ctx, input }) => {
      // TODO Task 15: implement full FOB→CIF calculation using freight rates from DB
      const freightRate = await ctx.db.freightRate.findFirst({
        where: {
          destinationCountry: input.destinationCountry,
          containerType: input.containerType,
        },
        orderBy: { updatedAt: "desc" },
      });

      if (!freightRate) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Tarif Ocean Freight untuk rute ${input.destinationCountry} (${input.containerType}) tidak tersedia`,
        });
      }

      // Placeholder calculation — replaced by real formula in Task 15
      const vanillaHPP = input.hppPerKg * input.volumeKg;
      const dryingCost = vanillaHPP * 0.05;
      const vacuumPackagingCost = input.volumeKg * 2;
      const truckToPortCost = 500;
      const emklCost = 300;
      const localDocumentCost = 150;
      const domesticSubtotal =
        vanillaHPP + dryingCost + vacuumPackagingCost + truckToPortCost + emklCost + localDocumentCost;

      const oceanFreightRate = freightRate.rateUsd;
      const marineInsurance = domesticSubtotal * 0.005;
      const freightSubtotal = oceanFreightRate + marineInsurance;

      const importDuty = domesticSubtotal * 0.05;
      const portTax = 200;
      const customsClearance = 350;
      const destinationSubtotal = importDuty + portTax + customsClearance;

      const fob = domesticSubtotal;
      const cfr = fob + oceanFreightRate;
      const cif = cfr + marineInsurance;

      return {
        input,
        domestic: {
          vanillaHPP,
          dryingCost,
          vacuumPackagingCost,
          truckToPortCost,
          emklCost,
          localDocumentCost,
          subtotal: domesticSubtotal,
        },
        freight: {
          oceanFreightRate,
          marineInsurance,
          subtotal: freightSubtotal,
        },
        destination: {
          importDuty,
          portTax,
          customsClearance,
          subtotal: destinationSubtotal,
        },
        fob,
        cfr,
        cif,
        calculatedAt: new Date(),
        freightRateUpdatedAt: freightRate.updatedAt,
      };
    }),

  // POST /api/compliance/export (PDF or XLSX)
  exportCostMatrix: protectedProcedure
    .input(
      CostingInputSchema.extend({
        format: z.enum(["pdf", "xlsx"]),
      })
    )
    .mutation(async () => {
      // TODO Task 16: implement PDF/XLSX export
      throw new TRPCError({
        code: "NOT_IMPLEMENTED" as never,
        message: "Export akan diimplementasi pada Task 16",
      });
    }),
});
