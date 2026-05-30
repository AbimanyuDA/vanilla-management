import { cn } from "@/lib/utils";

interface Props {
  score: number;
  showLabel?: boolean;
}

export function LeadScoreBadge({ score, showLabel = false }: Props) {
  const tier =
    score >= 70
      ? { label: "Tinggi", bg: "bg-green-50", text: "text-green-700", border: "border-green-200", dot: "bg-green-500" }
      : score >= 40
        ? { label: "Sedang", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" }
        : { label: "Rendah", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold border font-numeric",
        tier.bg,
        tier.text,
        tier.border
      )}
      aria-label={`Lead Score ${score} — ${tier.label}`}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", tier.dot)} />
      {score}
      {showLabel && <span className="font-normal">· {tier.label}</span>}
    </span>
  );
}
