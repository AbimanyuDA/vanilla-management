"use client";

import { trpc } from "@/lib/trpc-client";
import { NotificationBell } from "./NotificationBell";
import { cn } from "@/lib/utils";
import type { Role } from "@/generated/prisma/enums";
import type { AgentType } from "@/generated/prisma/enums";

type AgentMeta = {
  type: AgentType;
  label: string;
};

const AGENTS: AgentMeta[] = [
  { type: "MARKET_AGENT", label: "Market" },
  { type: "LEAD_AGENT", label: "Lead" },
  { type: "COMPLIANCE_AGENT", label: "Compliance" },
];

function formatRelativeTime(date: Date | null): string {
  if (!date) return "Belum pernah berjalan";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Baru saja";
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} jam lalu`;
  return `${Math.floor(diffH / 24)} hari lalu`;
}

type UserInfo = {
  name: string | null;
  role: Role;
};

export function AgentStatusBar({ user }: { user: UserInfo }) {
  const { data: agentStatuses = [], isLoading } =
    trpc.agents.getAgentStatus.useQuery(undefined, {
      refetchInterval: 30_000,
      staleTime: 25_000,
    });

  return (
    <header className="sticky top-0 z-40 h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4">
      {/* Left: VEIP wordmark */}
      <div className="flex items-center gap-2 flex-shrink-0 w-52">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: "#ECA134" }}
        >
          <span className="text-white font-bold text-xs">V</span>
        </div>
        <span className="font-semibold text-sm text-foreground hidden sm:block">
          VEIP
        </span>
      </div>

      {/* Center: Agent status pills */}
      <div
        className="flex items-center gap-2 flex-1 justify-center"
        role="status"
        aria-label="Status AI Agent"
      >
        {isLoading
          ? AGENTS.map((a) => (
              <span
                key={a.type}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium border-gray-200 text-gray-400 bg-gray-50 animate-pulse"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                {a.label}
              </span>
            ))
          : AGENTS.map((agent) => {
              const status = agentStatuses.find(
                (s) => s.agentType === agent.type
              );
              const isActive = status?.isActive ?? false;
              const hasFailed = !!status?.lastError;
              const lastRun = status?.lastRunAt
                ? new Date(status.lastRunAt)
                : null;

              const colorClass = isActive
                ? "border-[#ECA134] text-[#ECA134] bg-orange-50"
                : hasFailed
                  ? "border-red-300 text-red-600 bg-red-50"
                  : "border-gray-200 text-gray-500 bg-gray-50";

              const dotColor = isActive
                ? "#ECA134"
                : hasFailed
                  ? "#EF4444"
                  : "#9CA3AF";

              return (
                <span
                  key={agent.type}
                  title={
                    isActive
                      ? `${agent.label} Agent sedang berjalan`
                      : hasFailed
                        ? `${agent.label} Agent gagal: ${status?.lastError}`
                        : `${agent.label} Agent idle — ${formatRelativeTime(lastRun)}`
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-colors cursor-default select-none",
                    colorClass
                  )}
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full flex-shrink-0",
                      isActive && "animate-pulse"
                    )}
                    style={{ backgroundColor: dotColor }}
                  />
                  {agent.label}
                </span>
              );
            })}
      </div>

      {/* Right: Notification bell + user */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <NotificationBell />
        <div className="hidden sm:block text-right">
          <p className="text-xs font-medium text-foreground leading-tight">
            {user.name ?? "Pengguna"}
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight">
            {user.role.replace(/_/g, " ")}
          </p>
        </div>
      </div>
    </header>
  );
}
