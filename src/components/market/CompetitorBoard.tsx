"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRICE_CHANGE_THRESHOLD = 5; // % — Requirement 2.3
const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 hours — Requirement 2.5

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcPriceChangePct(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Baru saja";
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} jam lalu`;
  return `${Math.floor(diffH / 24)} hari lalu`;
}

function formatAxisDate(isoString: string): string {
  const d = new Date(isoString);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Harvest quality badge ────────────────────────────────────────────────────

function HarvestBadge({ quality }: { quality: string }) {
  const cfg = {
    high: { label: "Tinggi", cls: "bg-green-50 text-green-700 border-green-200" },
    medium: { label: "Sedang", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    low: { label: "Rendah", cls: "bg-red-50 text-red-700 border-red-200" },
  }[quality] ?? { label: quality, cls: "bg-gray-50 text-gray-600 border-gray-200" };

  return (
    <span className={cn("inline-flex px-2 py-0.5 rounded-md text-xs font-medium border", cfg.cls)}>
      {cfg.label}
    </span>
  );
}

// ─── 30-day chart (only mounted when expanded) ────────────────────────────────

interface ChartPoint { recordedAt: string; spotPrice: number }

function SpotPriceChart({ country }: { country: string }) {
  const { data: history = [], isLoading } = trpc.market.getCompetitorHistory.useQuery(
    { country },
    { staleTime: 5 * 60_000 }
  );

  const chartData: ChartPoint[] = history.map((h) => ({
    recordedAt: new Date(h.recordedAt).toISOString(),
    spotPrice: h.spotPrice,
  }));

  const minPrice = Math.min(...chartData.map((d) => d.spotPrice), 0);
  const maxPrice = Math.max(...chartData.map((d) => d.spotPrice), 0);
  const yPadding = (maxPrice - minPrice) * 0.1 || 10;

  if (isLoading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <RefreshCw size={18} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        Tidak ada data riwayat untuk 30 hari terakhir
      </div>
    );
  }

  return (
    <div className="px-4 pb-4 pt-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Riwayat Harga Spot — {country} (30 Hari Terakhir)
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="recordedAt"
            tickFormatter={formatAxisDate}
            tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "#6B7280" }}
            tickLine={false}
            axisLine={{ stroke: "#E5E7EB" }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minPrice - yPadding, maxPrice + yPadding]}
            tickFormatter={(v) => `$${Math.round(v)}`}
            tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "#6B7280" }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip
            formatter={(value) => [`$${Number(value).toFixed(2)}/kg`, "Spot Price"]}
            labelFormatter={(label) => {
              if (!label) return "";
              const d = new Date(String(label));
              return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
            }}
            contentStyle={{
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              borderRadius: 8,
              border: "1px solid #E5E7EB",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
            }}
          />
          <Line
            type="monotone"
            dataKey="spotPrice"
            stroke="#ECA134"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#ECA134" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main CompetitorBoard ─────────────────────────────────────────────────────

export function CompetitorBoard() {
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);

  const { data: competitors = [], isLoading, isFetching, refetch } =
    trpc.market.getCompetitors.useQuery(undefined, { staleTime: 30_000 });

  // Property 22: highest spot-price row gets gold accent (Requirement 8.2)
  const maxSpotPrice = Math.max(...competitors.map((c) => c.spotPrice), 0);

  const toggle = (country: string) =>
    setExpandedCountry((prev) => (prev === country ? null : country));

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            Competitor Live Insight Board
          </p>
          <p className="text-[11px] text-muted-foreground">
            Madagaskar · Uganda · Papua Nugini — klik baris untuk riwayat harga
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh data kompetitor"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Tabel data kompetitor vanilla">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                Negara
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-foreground uppercase tracking-wide text-right">
                Spot Price (USD/kg)
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                Kualitas Panen
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                Isu Logistik
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-foreground uppercase tracking-wide">
                Diperbarui
              </th>
              <th className="w-8" />
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-4 bg-gray-100 rounded w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              : competitors.map((comp) => {
                  const priceChangePct = calcPriceChangePct(
                    comp.spotPrice,
                    comp.spotPricePrevious
                  );
                  const isHighestPrice = comp.spotPrice === maxSpotPrice && competitors.length > 0;
                  const isPriceUp = priceChangePct > PRICE_CHANGE_THRESHOLD;
                  const isPriceDown = priceChangePct < -PRICE_CHANGE_THRESHOLD;
                  const updatedAt = new Date(comp.updatedAt);
                  const isStale = Date.now() - updatedAt.getTime() > STALE_THRESHOLD_MS;
                  const isExpanded = expandedCountry === comp.country;

                  // Row background: gold > green > red > default
                  let rowBg = "";
                  let borderLeft = "3px solid transparent";
                  if (isHighestPrice) {
                    rowBg = "bg-orange-50/70";
                    borderLeft = "3px solid #ECA134";
                  } else if (isPriceUp) {
                    rowBg = "bg-green-50/60";
                  } else if (isPriceDown) {
                    rowBg = "bg-red-50/60";
                  }

                  const PriceIcon = isPriceUp
                    ? TrendingUp
                    : isPriceDown
                      ? TrendingDown
                      : Minus;
                  const priceIconColor = isPriceUp
                    ? "text-green-600"
                    : isPriceDown
                      ? "text-red-600"
                      : "text-gray-400";

                  return (
                    <>
                      <tr
                        key={comp.country}
                        onClick={() => toggle(comp.country)}
                        className={cn(
                          "cursor-pointer hover:opacity-90 transition-opacity",
                          rowBg,
                          isExpanded && "border-b-0"
                        )}
                        style={{ borderLeft }}
                        aria-expanded={isExpanded}
                      >
                        {/* Country */}
                        <td className="px-4 py-3 font-medium text-foreground">
                          {comp.country}
                          {isHighestPrice && (
                            <span
                              className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: "#ECA134", color: "#fff" }}
                            >
                              TERTINGGI
                            </span>
                          )}
                        </td>

                        {/* Spot Price */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <PriceIcon
                              size={13}
                              className={priceIconColor}
                              aria-label={
                                isPriceUp
                                  ? "Harga naik"
                                  : isPriceDown
                                    ? "Harga turun"
                                    : "Harga stabil"
                              }
                            />
                            <span
                              className="font-numeric font-semibold text-sm"
                              style={isHighestPrice ? { color: "#ECA134" } : {}}
                            >
                              ${comp.spotPrice.toFixed(2)}
                            </span>
                            {Math.abs(priceChangePct) > PRICE_CHANGE_THRESHOLD && (
                              <span
                                className={cn(
                                  "font-numeric text-[11px] font-medium",
                                  isPriceUp ? "text-green-600" : "text-red-600"
                                )}
                              >
                                ({priceChangePct > 0 ? "+" : ""}
                                {priceChangePct.toFixed(1)}%)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Harvest quality */}
                        <td className="px-4 py-3">
                          <HarvestBadge quality={comp.harvestQualityEstimate} />
                        </td>

                        {/* Logistics issue — Requirement 2.4 */}
                        <td className="px-4 py-3">
                          {comp.logisticsIssueActive ? (
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                                <AlertCircle size={11} />
                                Isu Aktif
                              </span>
                              {comp.logisticsIssueDescription && (
                                <span
                                  className="text-[11px] text-muted-foreground truncate max-w-[180px]"
                                  title={comp.logisticsIssueDescription}
                                >
                                  {comp.logisticsIssueDescription}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                              <CheckCircle size={11} />
                              Normal
                            </span>
                          )}
                        </td>

                        {/* Last updated + staleness — Requirement 2.5 */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "text-xs",
                                isStale ? "text-amber-600 font-medium" : "text-muted-foreground"
                              )}
                            >
                              {formatRelativeTime(updatedAt)}
                            </span>
                            {isStale && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"
                                aria-label="Data kedaluwarsa lebih dari 48 jam"
                              >
                                <AlertTriangle size={9} />
                                Kedaluwarsa
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Expand toggle */}
                        <td className="px-2 py-3 text-muted-foreground">
                          {isExpanded ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                        </td>
                      </tr>

                      {/* Expanded chart row — Property 7: 30-day window enforced in tRPC query */}
                      {isExpanded && (
                        <tr key={`${comp.country}-chart`} className={cn("border-b border-gray-100", rowBg)}>
                          <td
                            colSpan={6}
                            className="bg-gray-50/50"
                            style={{ borderLeft }}
                          >
                            <SpotPriceChart country={comp.country} />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {!isLoading && competitors.length === 0 && (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          Tidak ada data kompetitor. Jalankan Market Agent untuk memperbarui.
        </div>
      )}
    </div>
  );
}
