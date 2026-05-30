"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { cn } from "@/lib/utils";
import type { Region } from "@/generated/prisma/enums";

// ─── Label maps ───────────────────────────────────────────────────────────────

const REGION_LABEL: Record<Region, string> = {
  AMERICAS: "Amerika",
  EUROPE: "Eropa",
  ASIA_PACIFIC: "Asia Pasifik",
};

const REGION_COLOR: Record<Region, string> = {
  AMERICAS: "bg-blue-50 text-blue-700 border-blue-200",
  EUROPE: "bg-purple-50 text-purple-700 border-purple-200",
  ASIA_PACIFIC: "bg-teal-50 text-teal-700 border-teal-200",
};

const PERIOD_OPTIONS = [
  { label: "30 Hari", value: 30 },
  { label: "90 Hari", value: 90 },
  { label: "1 Tahun", value: 365 },
] as const;

type PeriodDays = 30 | 90 | 365;

// ─── Demand status helpers ────────────────────────────────────────────────────

function getDemandStatus(pct: number) {
  if (pct >= 12) return { label: "Sangat Tinggi", color: "bg-red-50 text-red-700 border-red-200" };
  if (pct >= 8) return { label: "Tinggi", color: "bg-green-50 text-green-700 border-green-200" };
  if (pct >= 4) return { label: "Normal", color: "bg-gray-100 text-gray-600 border-gray-200" };
  return { label: "Rendah", color: "bg-sky-50 text-sky-700 border-sky-200" };
}

function DemandCell({ pct }: { pct: number }) {
  const Icon = pct > 1 ? TrendingUp : pct < -1 ? TrendingDown : Minus;
  const color = pct > 1 ? "text-green-600" : pct < -1 ? "text-red-600" : "text-gray-400";
  return (
    <span className={cn("inline-flex items-center gap-1 font-numeric text-sm", color)}>
      <Icon size={13} />
      {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-px">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-12 bg-gray-100 rounded" />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ImportQuotaTable() {
  const [selectedRegion, setSelectedRegion] = useState<Region | undefined>();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodDays>(30);

  const {
    data: snapshots = [],
    isLoading,
    isError,
    dataUpdatedAt,
    refetch,
    isFetching,
  } = trpc.market.getImportQuota.useQuery(
    { region: selectedRegion, periodDays: selectedPeriod },
    { staleTime: 60_000 }
  );

  // Gap alert countries for row highlighting (Requirement 1.3)
  const { data: gapAlerts = [] } = trpc.market.getGapAlerts.useQuery(
    { includeAcknowledged: false },
    { staleTime: 60_000 }
  );

  const alertCountries = new Set(gapAlerts.map((a) => a.targetCountry));

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-100">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Kuota Impor Vanilla per Negara
          </p>
          {dataUpdatedAt ? (
            <p className="text-[11px] text-muted-foreground">
              Diperbarui{" "}
              {new Date(dataUpdatedAt).toLocaleString("id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          ) : null}
        </div>

        {/* Region filter */}
        <select
          value={selectedRegion ?? ""}
          onChange={(e) =>
            setSelectedRegion(
              e.target.value ? (e.target.value as Region) : undefined
            )
          }
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-foreground focus:outline-none focus:ring-2"
          style={{ "--tw-ring-color": "#ECA134" } as React.CSSProperties}
          aria-label="Filter wilayah"
        >
          <option value="">Semua Wilayah</option>
          <option value="AMERICAS">Amerika</option>
          <option value="EUROPE">Eropa</option>
          <option value="ASIA_PACIFIC">Asia Pasifik</option>
        </select>

        {/* Period picker (Requirement 1.6) */}
        <div
          className="flex rounded-lg border border-gray-200 overflow-hidden"
          role="group"
          aria-label="Pilih rentang waktu"
        >
          {PERIOD_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setSelectedPeriod(value)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                selectedPeriod === value
                  ? "text-white"
                  : "text-muted-foreground hover:bg-gray-50"
              )}
              style={
                selectedPeriod === value
                  ? { backgroundColor: "#ECA134" }
                  : {}
              }
              aria-pressed={selectedPeriod === value}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh data"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Tabel kuota impor vanilla">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-left">
              <th className="px-4 py-3 font-semibold text-foreground text-xs uppercase tracking-wide">
                Negara Tujuan
              </th>
              <th className="px-4 py-3 font-semibold text-foreground text-xs uppercase tracking-wide">
                Wilayah
              </th>
              <th className="px-4 py-3 font-semibold text-foreground text-xs uppercase tracking-wide text-right">
                Kuota Impor (MT)
              </th>
              <th className="px-4 py-3 font-semibold text-foreground text-xs uppercase tracking-wide text-right">
                Pertumbuhan Permintaan
              </th>
              <th className="px-4 py-3 font-semibold text-foreground text-xs uppercase tracking-wide">
                Status
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6">
                  <TableSkeleton />
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-red-500">
                  Gagal memuat data. Silakan coba lagi.
                </td>
              </tr>
            ) : snapshots.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Tidak ada data untuk filter yang dipilih.
                </td>
              </tr>
            ) : (
              snapshots.map((row) => {
                const hasAlert = alertCountries.has(row.country);
                const demandStatus = getDemandStatus(row.demandGrowthPct);

                return (
                  <tr
                    key={`${row.country}-${row.periodDays}`}
                    className={cn(
                      "hover:bg-gray-50 transition-colors",
                      hasAlert && "bg-orange-50/40"
                    )}
                    style={
                      hasAlert
                        ? { borderLeft: "3px solid #ECA134" }
                        : { borderLeft: "3px solid transparent" }
                    }
                  >
                    {/* Country */}
                    <td className="px-4 py-3 font-medium text-foreground">
                      {row.country}
                    </td>

                    {/* Region badge */}
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
                          REGION_COLOR[row.region]
                        )}
                      >
                        {REGION_LABEL[row.region]}
                      </span>
                    </td>

                    {/* Import quota — Roboto Mono per design spec */}
                    <td className="px-4 py-3 text-right font-numeric text-foreground">
                      {row.importQuotaTons.toLocaleString("id-ID", {
                        maximumFractionDigits: 0,
                      })}
                    </td>

                    {/* Demand growth */}
                    <td className="px-4 py-3 text-right">
                      <DemandCell pct={row.demandGrowthPct} />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      {hasAlert ? (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border"
                          style={{
                            backgroundColor: "#FFF8EE",
                            color: "#ECA134",
                            borderColor: "#ECA134",
                          }}
                        >
                          Gap Terdeteksi
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
                            demandStatus.color
                          )}
                        >
                          {demandStatus.label}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      {!isLoading && snapshots.length > 0 && (
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-muted-foreground">
            Menampilkan {snapshots.length} negara
            {selectedRegion ? ` di ${REGION_LABEL[selectedRegion]}` : ""}
            {" · "}Data periode {PERIOD_OPTIONS.find((p) => p.value === selectedPeriod)?.label}
          </p>
        </div>
      )}
    </div>
  );
}
