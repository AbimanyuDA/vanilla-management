"use client";

import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── 10+ target export countries for vanilla (Requirement 5.1) ───────────────

export const EXPORT_COUNTRIES = [
  { value: "United States", label: "🇺🇸 Amerika Serikat" },
  { value: "European Union", label: "🇪🇺 Uni Eropa" },
  { value: "Japan", label: "🇯🇵 Jepang" },
  { value: "Australia", label: "🇦🇺 Australia" },
  { value: "Germany", label: "🇩🇪 Jerman" },
  { value: "Netherlands", label: "🇳🇱 Belanda" },
  { value: "Singapore", label: "🇸🇬 Singapura" },
  { value: "South Korea", label: "🇰🇷 Korea Selatan" },
  { value: "Canada", label: "🇨🇦 Kanada" },
  { value: "United Kingdom", label: "🇬🇧 Inggris" },
  { value: "France", label: "🇫🇷 Prancis" },
  { value: "Switzerland", label: "🇨🇭 Swiss" },
] as const;

export type ExportCountry = (typeof EXPORT_COUNTRIES)[number]["value"];

interface Props {
  value: ExportCountry;
  onChange: (country: ExportCountry) => void;
  disabled?: boolean;
}

export function CountrySelector({ value, onChange, disabled }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Globe size={15} className="text-muted-foreground flex-shrink-0" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ExportCountry)}
        disabled={disabled}
        aria-label="Pilih negara tujuan ekspor"
        className={cn(
          "text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-foreground",
          "focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed",
          "min-w-[220px]"
        )}
        style={{ "--tw-ring-color": "#ECA134" } as React.CSSProperties}
      >
        {EXPORT_COUNTRIES.map(({ value: v, label }) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
