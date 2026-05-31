/**
 * Buyer Directory page — loading skeleton
 *
 * Rendered by Next.js App Router while the page is loading.
 * Matches the real layout: BuyerDirectory table with score badges and actions.
 */

import {
  SkeletonBox,
  SkeletonPageHeader,
  SkeletonTable,
} from "@/components/ui/Skeleton";

export default function BuyersLoading() {
  return (
    <div className="p-6 space-y-4" aria-label="Memuat Buyer Directory..." aria-busy="true">
      {/* Page header */}
      <SkeletonPageHeader />

      {/* Search + filter toolbar */}
      <div className="flex items-center gap-3">
        <SkeletonBox className="h-9 flex-1 rounded-lg" />
        <SkeletonBox className="h-9 w-32 rounded-lg" />
        <SkeletonBox className="h-9 w-32 rounded-lg" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4"
          >
            <SkeletonBox className="h-10 w-10 flex-shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <SkeletonBox className="h-3 w-16" />
              <SkeletonBox className="h-5 w-10" />
            </div>
          </div>
        ))}
      </div>

      {/* Buyer table — 6 columns: Company, Country, Sector, Score, Volume, Actions */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <SkeletonBox className="h-4 w-28" />
          <SkeletonBox className="h-7 w-24 rounded-lg" />
        </div>
        <SkeletonTable rows={8} cols={6} />
      </div>
    </div>
  );
}
