import { TrendingUp } from "lucide-react";

export default function MarketPage() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
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

      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
        <TrendingUp size={32} className="mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">
          Modul Market Intelligence
        </p>
        <p className="text-xs text-muted-foreground">
          Akan diimplementasi pada Task 7 & 8
        </p>
      </div>
    </div>
  );
}
