/**
 * Market Intelligence page — loading skeleton
 *
 * Rendered by Next.js App Router while the page is loading.
 * Matches the real layout: GapAlertBanner + ImportQuotaTable + CompetitorBoard.
 */

import {
  SkeletonBox,
  SkeletonPageHeader,
  SkeletonTable,
  SkeletonCard,
} from "@/components/ui/Skeleton";

export default function MarketLoading() {
  return (
    <div className="p-6 space-y-4" aria-label="Memuat Market Intelligence..." aria-busy="true">
      {/* Page header */}
      <SkeletonPageHeader />

      {/* GapAlertBanner skeleton */}
      <SkeletonBox className="h-12 w-full rounded-xl" />

      {/* ImportQuotaTable skeleton */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        {/* Table toolbar */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <SkeletonBox className="h-4 w-32" />
          <div className="flex gap-2">
            <SkeletonBox className="h-8 w-24 rounded-lg" />
            <SkeletonBox className="h-8 w-28 rounded-lg" />
          </div>
        </div>
        <SkeletonTable rows={6} cols={5} />
      </div>

      {/* CompetitorBoard skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i}>
            <div className="flex items-start justify-between mb-3">
              <div className="space-y-1.5 flex-1">
                <SkeletonBox className="h-4 w-28" />
                <SkeletonBox className="h-3 w-20" />
              </div>
              <SkeletonBox className="h-6 w-16 rounded-full" />
            </div>
            <SkeletonBox className="h-24 w-full rounded-lg" />
            <div className="mt-3 space-y-1.5">
              <SkeletonBox className="h-3 w-full" />
              <SkeletonBox className="h-3 w-3/4" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}
