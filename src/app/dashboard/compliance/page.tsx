import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import { ComplianceChecklist } from "@/components/compliance/ComplianceChecklist";
import { CostingMatrix } from "@/components/compliance/CostingMatrix";

export default async function CompliancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (!canAccess(session.user.role, "compliance", "read")) {
    redirect("/dashboard/market");
  }

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: "#ECA134" }}
        >
          <ShieldCheck size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Compliance & Cost</h1>
          <p className="text-sm text-muted-foreground">
            Daftar periksa regulasi ekspor vanilla per negara tujuan
          </p>
        </div>
      </div>

      {/* Compliance Checklist with country selector and change notifications */}
      <ComplianceChecklist />

      {/* Costing Matrix — FOB/CFR/CIF calculator (Requirements 6.1–6.7) */}
      <CostingMatrix />
    </div>
  );
}
