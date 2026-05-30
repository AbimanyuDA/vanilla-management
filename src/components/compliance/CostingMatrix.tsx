"use client";

import { useState, useEffect } from "react";
import {
  Calculator,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { cn } from "@/lib/utils";

// ─── Countries with freight rates (from DB) + extras that will show "unavailable" ─

const DESTINATION_COUNTRIES = [
  // Has rates
  { value: "United States", label: "🇺🇸 Amerika Serikat", hasRate: true },
  { value: "Japan", label: "🇯🇵 Jepang", hasRate: true },
  { value: "Australia", label: "🇦🇺 Australia", hasRate: true },
  { value: "Netherlands", label: "🇳🇱 Belanda (Rotterdam)", hasRate: true },
  { value: "Germany", label: "🇩🇪 Jerman (Hamburg)", hasRate: true },
  { value: "Singapore", label: "🇸🇬 Singapura", hasRate: true },
  { value: "South Korea", label: "🇰🇷 Korea Selatan", hasRate: true },
  // May not have rates → triggers "unavailable" state
  { value: "United Kingdom", label: "🇬🇧 Inggris", hasRate: false },
  { value: "France", label: "🇫🇷 Prancis", hasRate: false },
  { value: "Canada", label: "🇨🇦 Kanada", hasRate: false },
  { value: "Switzerland", label: "🇨🇭 Swiss", hasRate: false },
  { value: "China", label: "🇨🇳 Tiongkok", hasRate: false },
] as const;

const CONTAINER_OPTIONS = [
  { value: "20ft" as const, label: "20 FT FCL" },
  { value: "40ft" as const, label: "40 FT FCL" },
  { value: "LCL" as const, label: "LCL" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUSD(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── Result line item ─────────────────────────────────────────────────────────

function CostLine({
  label,
  value,
  isSubtotal,
}: {
  label: string;
  value: number;
  isSubtotal?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-2 px-3",
        isSubtotal && "border-t border-gray-200 mt-1 font-semibold bg-gray-50"
      )}
    >
      <span className={cn("text-sm", isSubtotal ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
      <span
        className={cn(
          "font-numeric text-sm",
          isSubtotal ? "text-foreground font-semibold" : "text-foreground"
        )}
      >
        {formatUSD(value)}
      </span>
    </div>
  );
}

// ─── Cost group card ──────────────────────────────────────────────────────────

function CostGroup({
  title,
  color,
  lines,
  subtotal,
}: {
  title: string;
  color: string;
  lines: { label: string; value: number }[];
  subtotal: number;
}) {
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className={cn("px-3 py-2 text-xs font-semibold uppercase tracking-wide", color)}>
        {title}
      </div>
      <div className="divide-y divide-gray-50">
        {lines.map((l) => (
          <CostLine key={l.label} label={l.label} value={l.value} />
        ))}
        <CostLine label="Subtotal" value={subtotal} isSubtotal />
      </div>
    </div>
  );
}

// ─── FOB/CFR/CIF summary ──────────────────────────────────────────────────────

function FobCifSummary({
  fob,
  cfr,
  cif,
}: {
  fob: number;
  cfr: number;
  cif: number;
}) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#ECA134" }}>
      <div
        className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white"
        style={{ backgroundColor: "#ECA134" }}
      >
        Ringkasan Harga Ekspor
      </div>
      <div className="bg-white px-4 py-4 grid grid-cols-3 gap-4">
        {[
          { label: "FOB", value: fob, desc: "Free On Board" },
          { label: "CFR", value: cfr, desc: "Cost & Freight" },
          { label: "CIF", value: cif, desc: "Cost, Insurance & Freight" },
        ].map(({ label, value, desc }) => (
          <div key={label} className="text-center">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">
              {label}
            </p>
            <p
              className="font-numeric text-xl font-bold mt-1"
              style={{ color: "#ECA134" }}
            >
              {formatUSD(value)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── "Tarif tidak tersedia" state (Requirement 6.7) ──────────────────────────

function UnavailableBanner({
  message,
  alternatives,
  onSelectAlternative,
}: {
  message: string;
  alternatives: {
    containerTypes: { containerType: string; rateUsd: number; destinationPort: string }[];
    nearbyCountries: string[];
  };
  onSelectAlternative: (country: string) => void;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-800">{message}</p>

          {alternatives.containerTypes.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">
                Jenis kontainer tersedia untuk negara ini:
              </p>
              <div className="flex flex-wrap gap-2">
                {alternatives.containerTypes.map((alt) => (
                  <span
                    key={alt.containerType}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-white border border-amber-200 rounded-lg text-amber-800"
                  >
                    {alt.containerType} — {alt.destinationPort} ({formatUSD(alt.rateUsd)})
                  </span>
                ))}
              </div>
            </div>
          )}

          {alternatives.nearbyCountries.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">
                Rute alternatif terdekat:
              </p>
              <div className="flex flex-wrap gap-2">
                {alternatives.nearbyCountries.map((country) => (
                  <button
                    key={country}
                    onClick={() => onSelectAlternative(country)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-white border border-amber-300 rounded-lg text-amber-800 hover:bg-amber-100 transition-colors"
                  >
                    {country}
                    <ChevronRight size={10} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main CostingMatrix component ─────────────────────────────────────────────

export function CostingMatrix() {
  // Input state
  const [volumeKg, setVolumeKg] = useState<number>(100);
  const [destinationCountry, setDestinationCountry] = useState("United States");
  const [containerType, setContainerType] = useState<"20ft" | "40ft" | "LCL">("20ft");
  const [hppPerKg, setHppPerKg] = useState<number>(250);

  // Debounced inputs (500ms — Requirement 6.5: auto-recalculate)
  const [debounced, setDebounced] = useState({
    volumeKg,
    destinationCountry,
    containerType,
    hppPerKg,
  });

  useEffect(() => {
    const t = setTimeout(
      () => setDebounced({ volumeKg, destinationCountry, containerType, hppPerKg }),
      500
    );
    return () => clearTimeout(t);
  }, [volumeKg, destinationCountry, containerType, hppPerKg]);

  const isValid = debounced.volumeKg > 0 && debounced.hppPerKg > 0;

  const { data, isLoading, isFetching, error } = trpc.compliance.calculateCost.useQuery(
    debounced,
    {
      enabled: isValid,
      staleTime: 30_000,
    }
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-5">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <Calculator size={15} className="text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">Kalkulator Biaya Ekspor FOB – CIF</p>
        {(isLoading || isFetching) && (
          <RefreshCw size={12} className="ml-auto animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Input form (left) ───────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Parameter Kalkulasi
          </p>

          {/* Volume */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Volume Pengiriman (kg)
            </label>
            <input
              type="number"
              min={1}
              step={10}
              value={volumeKg}
              onChange={(e) => setVolumeKg(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-numeric focus:outline-none focus:ring-2"
              style={{ "--tw-ring-color": "#ECA134" } as React.CSSProperties}
              aria-label="Volume dalam kilogram"
            />
          </div>

          {/* Destination country */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Negara Tujuan
            </label>
            <select
              value={destinationCountry}
              onChange={(e) => setDestinationCountry(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
              style={{ "--tw-ring-color": "#ECA134" } as React.CSSProperties}
              aria-label="Negara tujuan ekspor"
            >
              {DESTINATION_COUNTRIES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Container type */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Jenis Kontainer
            </label>
            <div
              className="flex rounded-lg border border-gray-200 overflow-hidden"
              role="group"
              aria-label="Pilih jenis kontainer"
            >
              {CONTAINER_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setContainerType(value)}
                  aria-pressed={containerType === value}
                  className={cn(
                    "flex-1 py-2 text-xs font-medium transition-colors",
                    containerType === value
                      ? "text-white"
                      : "text-muted-foreground hover:bg-gray-50"
                  )}
                  style={containerType === value ? { backgroundColor: "#ECA134" } : {}}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* HPP per kg */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              HPP Vanilla (USD/kg)
            </label>
            <input
              type="number"
              min={1}
              step={10}
              value={hppPerKg}
              onChange={(e) => setHppPerKg(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-numeric focus:outline-none focus:ring-2"
              style={{ "--tw-ring-color": "#ECA134" } as React.CSSProperties}
              aria-label="Harga Pokok Produksi per kilogram"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Harga Pokok Produksi vanilla per kg (USD)
            </p>
          </div>

          {/* Freight rate timestamp */}
          {data?.available && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <RefreshCw size={9} />
              Tarif diperbarui{" "}
              {new Date(data.freightRateUpdatedAt).toLocaleDateString("id-ID", {
                dateStyle: "medium",
              })}
            </p>
          )}
        </div>

        {/* ── Results (right) ─────────────────────────────────────────────── */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* Loading skeleton */}
          {isLoading && !data && (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 bg-gray-100 rounded-xl" />
              ))}
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error.message}
            </div>
          )}

          {/* Tarif tidak tersedia (Requirement 6.7) */}
          {data && !data.available && (
            <UnavailableBanner
              message={data.message}
              alternatives={data.alternatives}
              onSelectAlternative={(country) => setDestinationCountry(country)}
            />
          )}

          {/* Calculation result */}
          {data?.available && (
            <>
              {/* Three cost groups (Requirement 6.2) — Roboto Mono numbers */}
              <CostGroup
                title="Biaya Domestik"
                color="bg-blue-50 text-blue-700"
                lines={[
                  { label: "HPP Vanilla", value: data.domestic.vanillaHPP },
                  { label: "Biaya Pengeringan (5% HPP)", value: data.domestic.dryingCost },
                  { label: "Pengemasan Vakum ($2/kg)", value: data.domestic.vacuumPackagingCost },
                  { label: "Truk ke Tanjung Priok", value: data.domestic.truckToPortCost },
                  { label: "Biaya EMKL / Undername", value: data.domestic.emklCost },
                  { label: "Penerbitan Dokumen Lokal", value: data.domestic.localDocumentCost },
                ]}
                subtotal={data.domestic.subtotal}
              />

              <CostGroup
                title="Biaya Perjalanan (Freight)"
                color="bg-teal-50 text-teal-700"
                lines={[
                  { label: "Tarif Ocean Freight", value: data.freight.oceanFreightRate },
                  { label: "Asuransi Laut (0.5%)", value: data.freight.marineInsurance },
                ]}
                subtotal={data.freight.subtotal}
              />

              <CostGroup
                title="Biaya Negara Tujuan (Estimasi)"
                color="bg-violet-50 text-violet-700"
                lines={[
                  { label: "Estimasi Import Duty (5%)", value: data.destination.importDuty },
                  { label: "Pajak Pelabuhan", value: data.destination.portTax },
                  { label: "Biaya Kliring Bea Cukai", value: data.destination.customsClearance },
                ]}
                subtotal={data.destination.subtotal}
              />

              {/* Arrow connector */}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span>FOB</span>
                <ArrowRight size={12} />
                <span>+Ocean Freight</span>
                <ArrowRight size={12} />
                <span>CFR</span>
                <ArrowRight size={12} />
                <span>+Insurance</span>
                <ArrowRight size={12} />
                <span>CIF</span>
              </div>

              {/* FOB / CFR / CIF summary (Requirement 6.3) */}
              <FobCifSummary fob={data.fob} cfr={data.cfr} cif={data.cif} />
            </>
          )}

          {/* Empty state */}
          {!isLoading && !data && !error && (
            <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-gray-200 py-12 text-center">
              <div>
                <Calculator size={28} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Isi parameter di kiri untuk menghitung biaya ekspor
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
