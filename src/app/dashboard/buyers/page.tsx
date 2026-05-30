import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { BuyerDirectory } from "@/components/buyers/BuyerDirectory";

export default async function BuyersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: "#ECA134" }}
        >
          <Users size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Buyer Directory</h1>
          <p className="text-sm text-muted-foreground">
            Direktori buyer potensial hasil pemindaian AI Lead Agent
          </p>
        </div>
      </div>

      {/* Directory table with filter, score badges, proposal actions */}
      <BuyerDirectory userRole={session.user.role} />
    </div>
  );
}
