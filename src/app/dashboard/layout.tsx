import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AgentStatusBar } from "@/components/dashboard/AgentStatusBar";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Serialize only what Client Components need — avoids passing non-serializable values
  const user = {
    name: session.user.name ?? null,
    role: session.user.role,
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface min-w-[1280px] overflow-x-auto">
      <AgentStatusBar user={user} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar role={session.user.role} userName={session.user.name ?? null} />

        <main className="flex-1 overflow-auto bg-surface">
          <ErrorBoundary moduleName="Modul Dashboard">
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
