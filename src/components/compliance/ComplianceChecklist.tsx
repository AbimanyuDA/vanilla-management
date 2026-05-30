"use client";

import { useState } from "react";
import {
  ShieldAlert,
  Leaf,
  Building2,
  Star,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Bell,
  X,
  Sparkles,
  Clock,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { cn } from "@/lib/utils";
import { CountrySelector, EXPORT_COUNTRIES } from "./CountrySelector";
import type { ExportCountry } from "./CountrySelector";

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const REQUIREMENT_CATEGORIES = [
  {
    key: "mrl" as const,
    label: "Batas Residu Maksimum (MRL)",
    icon: ShieldAlert,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-100",
  },
  {
    key: "phytosanitary" as const,
    label: "Sertifikat Phytosanitary",
    icon: Leaf,
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-100",
  },
  {
    key: "customs" as const,
    label: "Bea Cukai & Tarif Impor",
    icon: Building2,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-100",
  },
  {
    key: "organic_cert" as const,
    label: "Sertifikasi Organik",
    icon: Star,
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-100",
  },
] as const;

type RequirementType = (typeof REQUIREMENT_CATEGORIES)[number]["key"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "Hari ini";
  if (diffDays === 1) return "Kemarin";
  if (diffDays < 7) return `${diffDays} hari lalu`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} minggu lalu`;
  return date.toLocaleDateString("id-ID", { dateStyle: "medium" });
}

function isRecentlyUpdated(updatedAt: Date): boolean {
  return Date.now() - updatedAt.getTime() < SEVEN_DAYS_MS;
}

// ─── Stale agent warning banner ───────────────────────────────────────────────

function AgentStaleBanner() {
  const { data: agentStatuses = [] } = trpc.agents.getAgentStatus.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  const complianceAgent = agentStatuses.find((s) => s.agentType === "COMPLIANCE_AGENT");
  const lastSuccess = complianceAgent?.lastSuccessAt
    ? new Date(complianceAgent.lastSuccessAt)
    : null;

  const isStale = !lastSuccess || Date.now() - lastSuccess.getTime() > SEVEN_DAYS_MS;

  if (!isStale) return null;

  return (
    <div className="mb-4 flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
      <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-800">
          Data regulasi mungkin tidak terkini
        </p>
        <p className="text-xs text-amber-700 mt-0.5">
          {lastSuccess
            ? `Compliance Agent terakhir berhasil ${formatRelativeTime(lastSuccess)}. ` +
              "Regulasi mungkin belum diperbarui dalam 7 hari terakhir."
            : "Compliance Agent belum pernah berhasil dijalankan."}
        </p>
      </div>
    </div>
  );
}

// ─── Regulation change notification banner ────────────────────────────────────

function RegulationChangeBanner({ country }: { country: ExportCountry }) {
  const utils = trpc.useUtils();

  const { data: notifications = [] } = trpc.compliance.getRegulationNotifications.useQuery(
    { includeAcknowledged: false, country },
    { staleTime: 60_000 }
  );

  const markRead = trpc.compliance.markRegulationNotificationRead.useMutation({
    onSuccess: () => {
      utils.compliance.getRegulationNotifications.invalidate();
      utils.compliance.getChecklist.invalidate();
    },
  });

  if (notifications.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border overflow-hidden" style={{ borderColor: "#ECA134" }}>
      <div
        className="flex items-center gap-2 px-4 py-2"
        style={{ backgroundColor: "#ECA134" }}
      >
        <Bell size={13} className="text-white" />
        <p className="text-white text-sm font-semibold">
          {notifications.length} Perubahan Regulasi Terdeteksi
        </p>
      </div>
      <div className="bg-orange-50 divide-y divide-orange-100">
        {notifications.map((notif) => (
          <div key={notif.id} className="flex items-start gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">
                {notif.country} — {notif.regulationName}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-red-600 line-through">{notif.oldValue}</span>
                <span className="mx-2 text-muted-foreground">→</span>
                <span className="text-green-700 font-medium">{notif.newValue}</span>
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Terdeteksi {formatRelativeTime(new Date(notif.detectedAt))}
              </p>
            </div>
            <button
              onClick={() => markRead.mutate({ notificationId: notif.id })}
              disabled={markRead.isPending}
              aria-label="Tutup notifikasi"
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-orange-100 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Single checklist item ────────────────────────────────────────────────────

interface ChecklistItemData {
  id: string;
  description: string;
  currentValue: string;
  previousValue?: string | null;
  sourceUrl: string;
  updatedAt: Date | string;
}

function ChecklistItem({ item }: { item: ChecklistItemData }) {
  const updatedAt = new Date(item.updatedAt);
  const isNew = isRecentlyUpdated(updatedAt);

  return (
    <div className="flex items-start gap-3 py-3 px-4 hover:bg-gray-50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-foreground">{item.description}</p>
          {/* Requirement 5.6: show updatedAt timestamp on every item */}
          {/* "Baru Diperbarui" badge for items updated within 7 days */}
          {isNew && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
              <Sparkles size={8} />
              Baru Diperbarui
            </span>
          )}
        </div>

        {/* Current value — the threshold / rule */}
        <p className="text-sm font-semibold text-foreground mt-1 font-numeric">
          {item.currentValue}
        </p>

        {/* Previous value (if there was a change) */}
        {item.previousValue && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Sebelumnya:{" "}
            <span className="line-through text-red-500">{item.previousValue}</span>
          </p>
        )}

        {/* Last updated timestamp (Requirement 5.6) */}
        <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
          <Clock size={10} />
          Diperbarui {formatRelativeTime(updatedAt)}
        </p>
      </div>

      {/* Source URL link */}
      <a
        href={item.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Buka sumber regulasi"
        aria-label={`Buka sumber: ${item.sourceUrl}`}
        className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-gray-100 transition-colors"
      >
        <ExternalLink size={13} />
      </a>
    </div>
  );
}

// ─── Category group ───────────────────────────────────────────────────────────

function ChecklistGroup({
  category,
  items,
}: {
  category: (typeof REQUIREMENT_CATEGORIES)[number];
  items: ChecklistItemData[];
}) {
  const Icon = category.icon;

  return (
    <div className={cn("rounded-xl border overflow-hidden", category.border)}>
      {/* Group header */}
      <div className={cn("flex items-center gap-2 px-4 py-3", category.bg)}>
        <Icon size={14} className={category.color} />
        <p className={cn("text-sm font-semibold", category.color)}>{category.label}</p>
        <span className="ml-auto text-xs font-medium text-muted-foreground">
          {items.length} item
        </span>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="px-4 py-4 text-sm text-muted-foreground italic">
          Belum ada data untuk kategori ini.
        </div>
      ) : (
        <div className="bg-white divide-y divide-gray-50">
          {items.map((item) => (
            <ChecklistItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function NoDataState({ country }: { country: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center">
      <ShieldAlert size={28} className="mx-auto text-muted-foreground mb-3" />
      <p className="text-sm font-medium text-foreground">
        Tidak ada data regulasi untuk {country}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Jalankan Compliance Agent untuk mengambil data terbaru.
      </p>
    </div>
  );
}

// ─── Main ComplianceChecklist component ──────────────────────────────────────

export function ComplianceChecklist() {
  const [selectedCountry, setSelectedCountry] = useState<ExportCountry>(
    EXPORT_COUNTRIES[0].value
  );

  const {
    data: checklistItems = [],
    isLoading,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = trpc.compliance.getChecklist.useQuery(
    { country: selectedCountry },
    { staleTime: 5 * 60_000 }
  );

  // Group items by requirementType
  const grouped = REQUIREMENT_CATEGORIES.map((cat) => ({
    category: cat,
    items: checklistItems.filter(
      (item) => item.requirementType === cat.key
    ) as ChecklistItemData[],
  }));

  const hasData = checklistItems.length > 0;
  const lastUpdatedAt = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Country selector (Requirement 5.1: ≥10 countries) */}
        <CountrySelector
          value={selectedCountry}
          onChange={setSelectedCountry}
          disabled={isLoading}
        />

        <div className="flex-1" />

        {/* Last updated timestamp */}
        {lastUpdatedAt && hasData && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock size={11} />
            Data dimuat {formatRelativeTime(lastUpdatedAt)}
          </p>
        )}

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh data regulasi"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white border border-gray-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Stale agent warning (show when agent hasn't run in 7+ days) */}
      <AgentStaleBanner />

      {/* Regulation change notifications for selected country */}
      <RegulationChangeBanner country={selectedCountry} />

      {/* Checklist content */}
      {isLoading ? (
        <div className="space-y-3">
          {REQUIREMENT_CATEGORIES.map((cat) => (
            <div
              key={cat.key}
              className="rounded-xl border border-gray-100 bg-gray-50 animate-pulse h-28"
            />
          ))}
        </div>
      ) : !hasData ? (
        <NoDataState country={selectedCountry} />
      ) : (
        <div className="space-y-4" role="list" aria-label={`Daftar periksa kepatuhan ${selectedCountry}`}>
          {grouped.map(({ category, items }) => (
            <ChecklistGroup key={category.key} category={category} items={items} />
          ))}
        </div>
      )}
    </div>
  );
}
