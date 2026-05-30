/**
 * Prisma Seed Script — Vanilla Export Intelligence Platform (VEIP)
 *
 * Seeds:
 *  - 3 test users (one per role)
 *  - CompetitorData for Madagascar, Uganda, Papua New Guinea
 *  - SpotPriceHistory (30 days) for each competitor country
 *  - FreightRate for major export routes from Tanjung Priok (Jakarta)
 *  - Sample ComplianceItems for US, EU, Japan
 *  - Sample MarketSnapshot records
 */

import "dotenv/config";
import { PrismaClient, Role, BuyerSector, AgentType, RunStatus } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting database seed...");

  // ---------------------------------------------------------------------------
  // 1. Users — one per role
  // ---------------------------------------------------------------------------
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const eksekutif = await prisma.user.upsert({
    where: { email: "eksekutif@veip.internal" },
    update: {},
    create: {
      email: "eksekutif@veip.internal",
      passwordHash,
      name: "Budi Santoso",
      role: Role.EKSEKUTIF,
    },
  });

  const salesManager = await prisma.user.upsert({
    where: { email: "sales@veip.internal" },
    update: {},
    create: {
      email: "sales@veip.internal",
      passwordHash,
      name: "Siti Rahayu",
      role: Role.SALES_MANAGER,
    },
  });

  const direkturKeuangan = await prisma.user.upsert({
    where: { email: "finance@veip.internal" },
    update: {},
    create: {
      email: "finance@veip.internal",
      passwordHash,
      name: "Ahmad Wijaya",
      role: Role.DIREKTUR_KEUANGAN,
    },
  });

  console.log(`✅ Users seeded: ${eksekutif.email}, ${salesManager.email}, ${direkturKeuangan.email}`);

  // ---------------------------------------------------------------------------
  // 2. CompetitorData — Madagascar, Uganda, Papua New Guinea
  // ---------------------------------------------------------------------------
  const competitors = [
    {
      country: "Madagascar",
      spotPrice: 285.0,
      spotPricePrevious: 270.0,
      harvestQualityEstimate: "high",
      logisticsIssueActive: false,
      logisticsIssueDescription: null,
    },
    {
      country: "Uganda",
      spotPrice: 210.0,
      spotPricePrevious: 225.0,
      harvestQualityEstimate: "medium",
      logisticsIssueActive: true,
      logisticsIssueDescription: "Port congestion at Mombasa causing 2–3 week delays",
    },
    {
      country: "Papua New Guinea",
      spotPrice: 195.0,
      spotPricePrevious: 190.0,
      harvestQualityEstimate: "medium",
      logisticsIssueActive: false,
      logisticsIssueDescription: null,
    },
  ];

  for (const comp of competitors) {
    await prisma.competitorData.upsert({
      where: { country: comp.country },
      update: {
        spotPrice: comp.spotPrice,
        spotPricePrevious: comp.spotPricePrevious,
        harvestQualityEstimate: comp.harvestQualityEstimate,
        logisticsIssueActive: comp.logisticsIssueActive,
        logisticsIssueDescription: comp.logisticsIssueDescription,
      },
      create: comp,
    });
  }

  console.log("✅ CompetitorData seeded for Madagascar, Uganda, Papua New Guinea");

  // ---------------------------------------------------------------------------
  // 3. SpotPriceHistory — 30 days of daily data per competitor
  // ---------------------------------------------------------------------------
  const now = new Date();

  for (const comp of competitors) {
    // Delete existing history to avoid duplicates on re-seed
    await prisma.spotPriceHistory.deleteMany({
      where: { competitorCountry: comp.country },
    });

    const basePrice = comp.spotPrice;
    const records = [];

    for (let daysAgo = 30; daysAgo >= 0; daysAgo--) {
      const recordedAt = new Date(now);
      recordedAt.setDate(recordedAt.getDate() - daysAgo);

      // Simulate realistic price variation ±8%
      const variation = (Math.random() - 0.5) * 0.16 * basePrice;
      const price = Math.round((basePrice + variation) * 100) / 100;

      records.push({
        competitorCountry: comp.country,
        spotPrice: price,
        recordedAt,
      });
    }

    await prisma.spotPriceHistory.createMany({ data: records });
  }

  console.log("✅ SpotPriceHistory seeded (30 days × 3 countries)");

  // ---------------------------------------------------------------------------
  // 4. FreightRate — major routes from Tanjung Priok (Jakarta)
  // ---------------------------------------------------------------------------
  const freightRates = [
    // United States
    {
      originPort: "Tanjung Priok",
      destinationPort: "Los Angeles",
      destinationCountry: "United States",
      containerType: "20ft",
      rateUsd: 3200,
      validFrom: new Date("2025-01-01"),
    },
    {
      originPort: "Tanjung Priok",
      destinationPort: "Los Angeles",
      destinationCountry: "United States",
      containerType: "40ft",
      rateUsd: 5800,
      validFrom: new Date("2025-01-01"),
    },
    {
      originPort: "Tanjung Priok",
      destinationPort: "Los Angeles",
      destinationCountry: "United States",
      containerType: "LCL",
      rateUsd: 180,
      validFrom: new Date("2025-01-01"),
    },
    // European Union (Rotterdam)
    {
      originPort: "Tanjung Priok",
      destinationPort: "Rotterdam",
      destinationCountry: "Netherlands",
      containerType: "20ft",
      rateUsd: 2800,
      validFrom: new Date("2025-01-01"),
    },
    {
      originPort: "Tanjung Priok",
      destinationPort: "Rotterdam",
      destinationCountry: "Netherlands",
      containerType: "40ft",
      rateUsd: 5200,
      validFrom: new Date("2025-01-01"),
    },
    {
      originPort: "Tanjung Priok",
      destinationPort: "Rotterdam",
      destinationCountry: "Netherlands",
      containerType: "LCL",
      rateUsd: 160,
      validFrom: new Date("2025-01-01"),
    },
    // Japan
    {
      originPort: "Tanjung Priok",
      destinationPort: "Yokohama",
      destinationCountry: "Japan",
      containerType: "20ft",
      rateUsd: 1400,
      validFrom: new Date("2025-01-01"),
    },
    {
      originPort: "Tanjung Priok",
      destinationPort: "Yokohama",
      destinationCountry: "Japan",
      containerType: "40ft",
      rateUsd: 2600,
      validFrom: new Date("2025-01-01"),
    },
    {
      originPort: "Tanjung Priok",
      destinationPort: "Yokohama",
      destinationCountry: "Japan",
      containerType: "LCL",
      rateUsd: 95,
      validFrom: new Date("2025-01-01"),
    },
    // Australia
    {
      originPort: "Tanjung Priok",
      destinationPort: "Sydney",
      destinationCountry: "Australia",
      containerType: "20ft",
      rateUsd: 1100,
      validFrom: new Date("2025-01-01"),
    },
    {
      originPort: "Tanjung Priok",
      destinationPort: "Sydney",
      destinationCountry: "Australia",
      containerType: "40ft",
      rateUsd: 2000,
      validFrom: new Date("2025-01-01"),
    },
    // Singapore
    {
      originPort: "Tanjung Priok",
      destinationPort: "Singapore",
      destinationCountry: "Singapore",
      containerType: "20ft",
      rateUsd: 350,
      validFrom: new Date("2025-01-01"),
    },
    {
      originPort: "Tanjung Priok",
      destinationPort: "Singapore",
      destinationCountry: "Singapore",
      containerType: "40ft",
      rateUsd: 650,
      validFrom: new Date("2025-01-01"),
    },
    // Germany (Hamburg)
    {
      originPort: "Tanjung Priok",
      destinationPort: "Hamburg",
      destinationCountry: "Germany",
      containerType: "20ft",
      rateUsd: 2900,
      validFrom: new Date("2025-01-01"),
    },
    {
      originPort: "Tanjung Priok",
      destinationPort: "Hamburg",
      destinationCountry: "Germany",
      containerType: "40ft",
      rateUsd: 5400,
      validFrom: new Date("2025-01-01"),
    },
  ];

  for (const rate of freightRates) {
    await prisma.freightRate.upsert({
      where: {
        originPort_destinationPort_containerType: {
          originPort: rate.originPort,
          destinationPort: rate.destinationPort,
          containerType: rate.containerType,
        },
      },
      update: { rateUsd: rate.rateUsd },
      create: rate,
    });
  }

  console.log(`✅ FreightRate seeded (${freightRates.length} routes)`);

  // ---------------------------------------------------------------------------
  // 5. MarketSnapshot — sample quota data for US, EU, Japan
  // ---------------------------------------------------------------------------
  const marketSnapshots = [
    // United States
    { country: "United States", region: "AMERICAS" as const, importQuotaTons: 1200, demandGrowthPct: 8.5, periodDays: 30 },
    { country: "United States", region: "AMERICAS" as const, importQuotaTons: 3800, demandGrowthPct: 9.2, periodDays: 90 },
    { country: "United States", region: "AMERICAS" as const, importQuotaTons: 14500, demandGrowthPct: 11.0, periodDays: 365 },
    // European Union
    { country: "European Union", region: "EUROPE" as const, importQuotaTons: 950, demandGrowthPct: 6.3, periodDays: 30 },
    { country: "European Union", region: "EUROPE" as const, importQuotaTons: 2900, demandGrowthPct: 7.1, periodDays: 90 },
    { country: "European Union", region: "EUROPE" as const, importQuotaTons: 11200, demandGrowthPct: 8.4, periodDays: 365 },
    // Japan
    { country: "Japan", region: "ASIA_PACIFIC" as const, importQuotaTons: 420, demandGrowthPct: 4.8, periodDays: 30 },
    { country: "Japan", region: "ASIA_PACIFIC" as const, importQuotaTons: 1300, demandGrowthPct: 5.2, periodDays: 90 },
    { country: "Japan", region: "ASIA_PACIFIC" as const, importQuotaTons: 5100, demandGrowthPct: 6.0, periodDays: 365 },
    // Australia
    { country: "Australia", region: "ASIA_PACIFIC" as const, importQuotaTons: 180, demandGrowthPct: 12.1, periodDays: 30 },
    // Singapore
    { country: "Singapore", region: "ASIA_PACIFIC" as const, importQuotaTons: 95, demandGrowthPct: 15.3, periodDays: 30 },
    // Germany
    { country: "Germany", region: "EUROPE" as const, importQuotaTons: 310, demandGrowthPct: 5.9, periodDays: 30 },
  ];

  await prisma.marketSnapshot.createMany({ data: marketSnapshots });

  console.log(`✅ MarketSnapshot seeded (${marketSnapshots.length} records)`);

  // ---------------------------------------------------------------------------
  // 6. ComplianceItems — US, EU, Japan
  // ---------------------------------------------------------------------------
  const complianceItems = [
    // United States
    {
      country: "United States",
      requirementType: "mrl",
      description: "Maximum Residue Level for vanilla beans — FDA 21 CFR",
      currentValue: "0.1 mg/kg",
      sourceUrl: "https://www.fda.gov/food/pesticides/maximum-residue-limits",
    },
    {
      country: "United States",
      requirementType: "phytosanitary",
      description: "USDA APHIS Phytosanitary Certificate required for all vanilla imports",
      currentValue: "Required — USDA Form PPQ 577",
      sourceUrl: "https://www.aphis.usda.gov/aphis/ourfocus/planthealth",
    },
    {
      country: "United States",
      requirementType: "customs",
      description: "US Customs import duty for vanilla beans (HS Code 0905)",
      currentValue: "0% (MFN rate)",
      sourceUrl: "https://hts.usitc.gov/",
    },
    {
      country: "United States",
      requirementType: "organic_cert",
      description: "USDA National Organic Program (NOP) certification for organic vanilla",
      currentValue: "USDA NOP accredited certifier required",
      sourceUrl: "https://www.ams.usda.gov/about-ams/programs-offices/national-organic-program",
    },
    // European Union
    {
      country: "European Union",
      requirementType: "mrl",
      description: "EU Maximum Residue Level for vanilla — Regulation (EC) No 396/2005",
      currentValue: "0.05 mg/kg",
      sourceUrl: "https://ec.europa.eu/food/plant/pesticides/eu-pesticides-database",
    },
    {
      country: "European Union",
      requirementType: "phytosanitary",
      description: "EU Phytosanitary Certificate — Commission Implementing Regulation (EU) 2019/2072",
      currentValue: "Required — issued by Indonesian BARANTAN",
      sourceUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32019R2072",
    },
    {
      country: "European Union",
      requirementType: "customs",
      description: "EU import duty for vanilla beans (CN Code 0905 10 00)",
      currentValue: "0% (GSP rate for Indonesia)",
      sourceUrl: "https://ec.europa.eu/taxation_customs/dds2/taric/",
    },
    {
      country: "European Union",
      requirementType: "organic_cert",
      description: "EU Organic Certification — Regulation (EU) 2018/848",
      currentValue: "EU organic logo + certificate of inspection required",
      sourceUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32018R0848",
    },
    // Japan
    {
      country: "Japan",
      requirementType: "mrl",
      description: "Japan MRL for vanilla — Food Sanitation Act (Positive List System)",
      currentValue: "0.01 mg/kg (default)",
      sourceUrl: "https://www.mhlw.go.jp/english/topics/foodsafety/positivelist.html",
    },
    {
      country: "Japan",
      requirementType: "phytosanitary",
      description: "Japan Plant Protection Law — Phytosanitary Certificate",
      currentValue: "Required — issued by Indonesian Ministry of Agriculture",
      sourceUrl: "https://www.maff.go.jp/e/policies/plant/",
    },
    {
      country: "Japan",
      requirementType: "customs",
      description: "Japan import duty for vanilla beans (HS Code 0905.10)",
      currentValue: "0% (EPA Indonesia-Japan)",
      sourceUrl: "https://www.customs.go.jp/english/tariff/",
    },
    {
      country: "Japan",
      requirementType: "organic_cert",
      description: "JAS Organic Certification for organic vanilla exports to Japan",
      currentValue: "JAS-accredited certifier required or equivalency agreement",
      sourceUrl: "https://www.maff.go.jp/e/policies/standard/jas/",
    },
  ];

  await prisma.complianceItem.createMany({ data: complianceItems });

  console.log(`✅ ComplianceItems seeded (${complianceItems.length} items)`);

  // ---------------------------------------------------------------------------
  // 7. Sample Buyers
  // ---------------------------------------------------------------------------
  const buyers = [
    {
      companyName: "McCormick & Company",
      country: "United States",
      sector: BuyerSector.FOOD_BEVERAGE,
      leadScore: 92,
      emailBusiness: "procurement@mccormick.com",
      emailVerified: true,
      importVolumeHistorical: 450.0,
    },
    {
      companyName: "Symrise AG",
      country: "Germany",
      sector: BuyerSector.FOOD_BEVERAGE,
      leadScore: 88,
      emailBusiness: "vanilla@symrise.com",
      emailVerified: true,
      importVolumeHistorical: 320.0,
    },
    {
      companyName: "Vanilla Food Company",
      country: "Australia",
      sector: BuyerSector.IMPORTER,
      leadScore: 74,
      emailBusiness: null,
      emailVerified: false,
      importVolumeHistorical: 85.0,
    },
    {
      companyName: "Takasago International",
      country: "Japan",
      sector: BuyerSector.DISTRIBUTOR,
      leadScore: 81,
      emailBusiness: "ingredients@takasago.com",
      emailVerified: true,
      importVolumeHistorical: 210.0,
    },
    {
      companyName: "Givaudan SA",
      country: "Netherlands",
      sector: BuyerSector.FOOD_BEVERAGE,
      leadScore: 95,
      emailBusiness: "sourcing@givaudan.com",
      emailVerified: true,
      importVolumeHistorical: 580.0,
    },
  ];

  for (const buyer of buyers) {
    await prisma.buyer.upsert({
      where: {
        // Use a composite check via findFirst pattern — upsert on companyName+country
        id: (await prisma.buyer.findFirst({ where: { companyName: buyer.companyName, country: buyer.country } }))?.id ?? "new",
      },
      update: buyer,
      create: buyer,
    });
  }

  console.log(`✅ Buyers seeded (${buyers.length} records)`);

  // ---------------------------------------------------------------------------
  // 8. Initial AgentRunLog entries
  // ---------------------------------------------------------------------------
  await prisma.agentRunLog.createMany({
    data: [
      {
        agentType: AgentType.MARKET_AGENT,
        status: RunStatus.SUCCESS,
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
        completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 45000),
        metadata: { recordsProcessed: 12, sourcesHit: ["worldbank", "fao"] },
      },
      {
        agentType: AgentType.LEAD_AGENT,
        status: RunStatus.SUCCESS,
        startedAt: new Date(Date.now() - 18 * 60 * 60 * 1000), // 18h ago
        completedAt: new Date(Date.now() - 18 * 60 * 60 * 1000 + 120000),
        metadata: { buyersFound: 5, buyersUpdated: 3 },
      },
      {
        agentType: AgentType.COMPLIANCE_AGENT,
        status: RunStatus.SUCCESS,
        startedAt: new Date(Date.now() - 36 * 60 * 60 * 1000), // 36h ago
        completedAt: new Date(Date.now() - 36 * 60 * 60 * 1000 + 90000),
        metadata: { regulationsChecked: 12, changesDetected: 0, freightRatesUpdated: 15 },
      },
    ],
  });

  console.log("✅ AgentRunLog seeded");

  console.log("\n🎉 Database seed completed successfully!");
  console.log("\nTest credentials (all passwords: Password123!):");
  console.log("  Eksekutif:          eksekutif@veip.internal");
  console.log("  Sales Manager:      sales@veip.internal");
  console.log("  Direktur Keuangan:  finance@veip.internal");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
