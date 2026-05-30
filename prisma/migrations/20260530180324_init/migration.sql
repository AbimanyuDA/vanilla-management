-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EKSEKUTIF', 'SALES_MANAGER', 'DIREKTUR_KEUANGAN');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('ASIA_PACIFIC', 'EUROPE', 'AMERICAS');

-- CreateEnum
CREATE TYPE "BuyerSector" AS ENUM ('FOOD_BEVERAGE', 'DISTRIBUTOR', 'IMPORTER');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('MARKET_AGENT', 'LEAD_AGENT', 'COMPLIANCE_AGENT');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_snapshots" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" "Region" NOT NULL,
    "importQuotaTons" DOUBLE PRECISION NOT NULL,
    "demandGrowthPct" DOUBLE PRECISION NOT NULL,
    "periodDays" INTEGER NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_data" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "spotPrice" DOUBLE PRECISION NOT NULL,
    "spotPricePrevious" DOUBLE PRECISION NOT NULL,
    "harvestQualityEstimate" TEXT NOT NULL,
    "logisticsIssueActive" BOOLEAN NOT NULL DEFAULT false,
    "logisticsIssueDescription" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitor_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spot_price_history" (
    "id" TEXT NOT NULL,
    "competitorCountry" TEXT NOT NULL,
    "spotPrice" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spot_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gap_alerts" (
    "id" TEXT NOT NULL,
    "targetCountry" TEXT NOT NULL,
    "demandSurgePct" DOUBLE PRECISION NOT NULL,
    "competitorCountry" TEXT NOT NULL,
    "supplyDropPct" DOUBLE PRECISION NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "gap_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyers" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "sector" "BuyerSector" NOT NULL,
    "leadScore" INTEGER NOT NULL,
    "emailBusiness" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "importVolumeHistorical" DOUBLE PRECISION,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "directoryUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buyers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "generatedById" TEXT,
    "quotationSheetDraft" TEXT NOT NULL,
    "emailDraft" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_items" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "requirementType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "currentValue" TEXT NOT NULL,
    "previousValue" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regulation_change_notifications" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "regulationName" TEXT NOT NULL,
    "oldValue" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "regulation_change_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freight_rates" (
    "id" TEXT NOT NULL,
    "originPort" TEXT NOT NULL,
    "destinationPort" TEXT NOT NULL,
    "destinationCountry" TEXT NOT NULL,
    "containerType" TEXT NOT NULL,
    "rateUsd" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "freight_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_run_logs" (
    "id" TEXT NOT NULL,
    "agentType" "AgentType" NOT NULL,
    "status" "RunStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB,

    CONSTRAINT "agent_run_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "market_snapshots_country_idx" ON "market_snapshots"("country");

-- CreateIndex
CREATE INDEX "market_snapshots_region_idx" ON "market_snapshots"("region");

-- CreateIndex
CREATE INDEX "market_snapshots_scannedAt_idx" ON "market_snapshots"("scannedAt");

-- CreateIndex
CREATE UNIQUE INDEX "competitor_data_country_key" ON "competitor_data"("country");

-- CreateIndex
CREATE INDEX "competitor_data_country_idx" ON "competitor_data"("country");

-- CreateIndex
CREATE INDEX "spot_price_history_competitorCountry_idx" ON "spot_price_history"("competitorCountry");

-- CreateIndex
CREATE INDEX "spot_price_history_recordedAt_idx" ON "spot_price_history"("recordedAt");

-- CreateIndex
CREATE INDEX "gap_alerts_targetCountry_idx" ON "gap_alerts"("targetCountry");

-- CreateIndex
CREATE INDEX "gap_alerts_acknowledged_idx" ON "gap_alerts"("acknowledged");

-- CreateIndex
CREATE INDEX "buyers_country_idx" ON "buyers"("country");

-- CreateIndex
CREATE INDEX "buyers_sector_idx" ON "buyers"("sector");

-- CreateIndex
CREATE INDEX "buyers_leadScore_idx" ON "buyers"("leadScore");

-- CreateIndex
CREATE INDEX "proposals_buyerId_idx" ON "proposals"("buyerId");

-- CreateIndex
CREATE INDEX "proposals_status_idx" ON "proposals"("status");

-- CreateIndex
CREATE INDEX "compliance_items_country_idx" ON "compliance_items"("country");

-- CreateIndex
CREATE INDEX "compliance_items_requirementType_idx" ON "compliance_items"("requirementType");

-- CreateIndex
CREATE INDEX "regulation_change_notifications_country_idx" ON "regulation_change_notifications"("country");

-- CreateIndex
CREATE INDEX "regulation_change_notifications_acknowledged_idx" ON "regulation_change_notifications"("acknowledged");

-- CreateIndex
CREATE INDEX "freight_rates_destinationCountry_idx" ON "freight_rates"("destinationCountry");

-- CreateIndex
CREATE INDEX "freight_rates_containerType_idx" ON "freight_rates"("containerType");

-- CreateIndex
CREATE UNIQUE INDEX "freight_rates_originPort_destinationPort_containerType_key" ON "freight_rates"("originPort", "destinationPort", "containerType");

-- CreateIndex
CREATE INDEX "agent_run_logs_agentType_idx" ON "agent_run_logs"("agentType");

-- CreateIndex
CREATE INDEX "agent_run_logs_status_idx" ON "agent_run_logs"("status");

-- CreateIndex
CREATE INDEX "agent_run_logs_startedAt_idx" ON "agent_run_logs"("startedAt");

-- AddForeignKey
ALTER TABLE "spot_price_history" ADD CONSTRAINT "spot_price_history_competitorCountry_fkey" FOREIGN KEY ("competitorCountry") REFERENCES "competitor_data"("country") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "buyers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
