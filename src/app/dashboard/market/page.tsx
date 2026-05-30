import { TrendingUp } from "lucide-react";
import { GapAlertBanner } from "@/components/market/GapAlertBanner";
import { ImportQuotaTable } from "@/components/market/ImportQuotaTable";

export default function MarketPage() {
  return (
    <div className="p-6 space-y-0">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: "#ECA134" }}
        >
          <TrendingUp size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Market Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Analisis kuota impor dan pemantauan kompetitor global
          </p>
        </div>
      </div>

      {/* Gap alert banner — renders above table when unread alerts exist (Requirement 1.3) */}
      <GapAlertBanner />

      {/* Import quota table with filters (Requirements 1.1, 1.2, 1.6) */}
      <ImportQuotaTable />
    </div>
  );
}
