/**
 * Skeleton UI Primitives — Vanilla Export Intelligence Platform (VEIP)
 *
 * Reusable skeleton components for page-level and module-level loading states.
 * Uses CSS animation (shimmer) defined in globals.css.
 *
 * Usage:
 *   <SkeletonBox className="h-10 w-full rounded-lg" />
 *   <SkeletonText lines={3} />
 *   <SkeletonTable rows={5} cols={4} />
 *
 * References: requirements.md Requirement 8, design.md section 3
 */

import { cn } from "@/lib/utils";

// ─── Base skeleton block ──────────────────────────────────────────────────────

export function SkeletonBox({
  className,
  "aria-label": ariaLabel,
}: {
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-md bg-gray-200", className)}
      aria-hidden="true"
      aria-label={ariaLabel}
      role="presentation"
    />
  );
}

// ─── Skeleton text block (multiple lines) ─────────────────────────────────────

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true" role="presentation">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 && lines > 1 ? "w-3/4" : "w-full"
          )}
        />
      ))}
    </div>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

export function SkeletonCard({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-100 bg-white p-4 shadow-sm",
        className
      )}
      aria-hidden="true"
      role="presentation"
    >
      {children ?? (
        <>
          <SkeletonBox className="mb-3 h-5 w-1/3" />
          <SkeletonText lines={2} />
        </>
      )}
    </div>
  );
}

// ─── Skeleton table ───────────────────────────────────────────────────────────

export function SkeletonTable({
  rows = 5,
  cols = 4,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("w-full overflow-hidden rounded-xl border border-gray-100 bg-white", className)}
      aria-hidden="true"
      role="presentation"
    >
      {/* Header row */}
      <div className="flex gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBox
            key={i}
            className={cn("h-3.5", i === 0 ? "w-1/4" : "flex-1")}
          />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex gap-3 border-b border-gray-50 px-4 py-3 last:border-0"
        >
          {Array.from({ length: cols }).map((_, colIdx) => (
            <SkeletonBox
              key={colIdx}
              className={cn(
                "h-4",
                colIdx === 0 ? "w-1/4" : "flex-1",
                // Vary widths for a more natural look
                colIdx === 1 && rowIdx % 2 === 0 ? "opacity-70" : ""
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Skeleton stat card ───────────────────────────────────────────────────────

export function SkeletonStatCard({ className }: { className?: string }) {
  return (
    <SkeletonCard className={cn("flex items-start gap-3", className)}>
      <SkeletonBox className="h-10 w-10 flex-shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2">
        <SkeletonBox className="h-3 w-1/2" />
        <SkeletonBox className="h-6 w-1/3" />
        <SkeletonBox className="h-3 w-2/3" />
      </div>
    </SkeletonCard>
  );
}

// ─── Page-level header skeleton ───────────────────────────────────────────────

export function SkeletonPageHeader({ className }: { className?: string }) {
  return (
    <div
      className={cn("mb-5 flex items-center gap-3", className)}
      aria-hidden="true"
      role="presentation"
    >
      <SkeletonBox className="h-9 w-9 flex-shrink-0 rounded-lg" />
      <div className="space-y-1.5">
        <SkeletonBox className="h-5 w-48" />
        <SkeletonBox className="h-3.5 w-72" />
      </div>
    </div>
  );
}
