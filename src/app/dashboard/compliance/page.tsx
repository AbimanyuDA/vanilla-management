import { ShieldCheck } from "lucide-react";

export default function CompliancePage() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: "#ECA134" }}
        >
          <ShieldCheck size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Compliance & Cost</h1>
          <p className="text-sm text-muted-foreground">
            Daftar periksa regulasi dan kalkulator biaya ekspor FOB–CIF
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
        <ShieldCheck size={32} className="mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">
          Modul Compliance & Cost
        </p>
        <p className="text-xs text-muted-foreground">
          Akan diimplementasi pada Task 13–16
        </p>
      </div>
    </div>
  );
}
