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
  // GET /api/compliance/checklist/:country — Requirement 5.2: MRL, Phytosanitary, Customs, Organic
  getChecklist: protectedProcedure
    .input(
      z.object({
        country: z.string().min(1),
        requirementType: RequirementTypeSchema.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Returns items ordered so MRL → phytosanitary → customs → organic_cert
      return ctx.db.complianceItem.findMany({
        where: {
          country: input.country,
          ...(input.requirementType !== undefined && { requirementType: input.requirementType }),
        },
        orderBy: { requirementType: "asc" },
      });
    }),

  // GET /api/compliance/notifications — optionally filtered by country
  getRegulationNotifications: protectedProcedure
    .input(
      z.object({
        includeAcknowledged: z.boolean().optional(),
        country: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.regulationChangeNotification.findMany({
        where: {
          ...(input.includeAcknowledged ? {} : { acknowledged: false }),
          ...(input.country !== undefined && { country: input.country }),
        },
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

  // GET /api/compliance/freight-rates — available routes for UI dropdown
  getFreightRates: protectedProcedure
    .input(
      z.object({
        destinationCountry: z.string().optional(),
        containerType: ContainerTypeSchema.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.freightRate.findMany({
        where: {
          ...(input.destinationCountry && { destinationCountry: input.destinationCountry }),
          ...(input.containerType && { containerType: input.containerType }),
        },
        orderBy: { destinationCountry: "asc" },
      });
    }),

  // GET /api/compliance/costing/calculate — query (not mutation) for auto-recalculate support
  // Property 14: FOB = domestic.subtotal, CFR = FOB + freight.oceanFreightRate, CIF = CFR + marineInsurance
  calculateCost: protectedProcedure
    .input(CostingInputSchema)
    .query(async ({ ctx, input }) => {
      const freightRate = await ctx.db.freightRate.findFirst({
        where: {
          destinationCountry: input.destinationCountry,
          containerType: input.containerType,
        },
        orderBy: { updatedAt: "desc" },
      });

      // Requirement 6.7: when rate is unavailable, return structured error with alternative routes
      if (!freightRate) {
        // Find other container types for the same country
        const sameCountryRates = await ctx.db.freightRate.findMany({
          where: { destinationCountry: input.destinationCountry },
          select: { containerType: true, rateUsd: true, destinationPort: true },
        });

        // Find nearest countries with available rates
        const nearbyCountries = await ctx.db.freightRate.findMany({
          distinct: ["destinationCountry"],
          select: { destinationCountry: true, destinationPort: true },
          where: { containerType: input.containerType },
          take: 4,
        });

        return {
          available: false as const,
          message: `Tarif Ocean Freight untuk rute ${input.destinationCountry} (${input.containerType}) tidak tersedia`,
          alternatives: {
            containerTypes: sameCountryRates.map((r) => ({
              containerType: r.containerType,
              rateUsd: r.rateUsd,
              destinationPort: r.destinationPort,
            })),
            nearbyCountries: nearbyCountries
              .map((r) => r.destinationCountry)
              .filter((c) => c !== input.destinationCountry),
          },
        };
      }

      // ── FOB→CIF calculation (Requirement 6.2, 6.3, Property 14) ──────────
      //   Domestic (FOB-origin)  → subtotal = FOB
      //   Freight                → CFR = FOB + oceanFreight
      //   Destination            → CIF = CFR + marineInsurance

      // Domestic cost components (Requirement 6.2)
      const vanillaHPP = input.hppPerKg * input.volumeKg;
      const dryingCost = vanillaHPP * 0.05;           // 5% of HPP for drying
      const vacuumPackagingCost = input.volumeKg * 2; // $2/kg for vacuum packaging
      const truckToPortCost = 500;                    // fixed trucking to Tanjung Priok
      const emklCost = 300;                           // EMKL / undername
      const localDocumentCost = 150;                  // phytosanitary + export docs
      const domesticSubtotal =
        vanillaHPP + dryingCost + vacuumPackagingCost + truckToPortCost + emklCost + localDocumentCost;

      // Freight cost components
      const oceanFreightRate = freightRate.rateUsd;
      const marineInsurance = domesticSubtotal * 0.005; // 0.5% of cargo value
      const freightSubtotal = oceanFreightRate + marineInsurance;

      // Destination cost components (estimates — vary by country)
      const importDuty = domesticSubtotal * 0.05;    // avg 5% import duty
      const portTax = 200;                           // port handling fee
      const customsClearance = 350;                  // customs broker fee
      const destinationSubtotal = importDuty + portTax + customsClearance;

      // Property 14: FOB ≤ CFR ≤ CIF invariant
      const fob = domesticSubtotal;                  // FOB = all domestic costs
      const cfr = fob + oceanFreightRate;            // CFR = FOB + ocean freight
      const cif = cfr + marineInsurance;             // CIF = CFR + insurance

      return {
        available: true as const,
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
