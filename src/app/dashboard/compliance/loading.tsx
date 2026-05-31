/**
 * Compliance & Cost page — loading skeleton
 *
 * Rendered by Next.js App Router while the page is loading.
 * Matches real layout: ComplianceChecklist (left) + CostingMatrix (right).
 */

import { SkeletonBox, SkeletonPageHeader, SkeletonTable } from "@/components/ui/Skeleton";

export default function ComplianceLoading() {
  return (
    <div className="p-6 space-y-4" aria-label="Memuat Compliance & Cost..." aria-busy="true">
      {/* Page header */}
      <SkeletonPageHeader />

      {/* Two-column layout matching the compliance page */}
      <div className="flex gap-6 items-start">
        {/* Left — Compliance Checklist (wider) */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Country selector */}
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <SkeletonBox className="mb-3 h-4 w-32" />
            <SkeletonBox className="h-10 w-full rounded-lg" />
          </div>

          {/* Compliance items by category */}
          {["MRL", "Phytosanitary", "Customs", "Organic"].map((cat) => (
            <div key={cat} className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              {/* Category header */}
              <div className="flex items-center justify-between border-b border-gray-50 bg-gray-50 px-4 py-3">
                <SkeletonBox className="h-4 w-28" />
                <SkeletonBox className="h-5 w-8 rounded-full" />
              </div>
              {/* Items */}
              {[0, 1].map((i) => (
                <div key={i} className="flex gap-3 border-b border-gray-50 px-4 py-3 last:border-0">
                  <SkeletonBox className="mt-0.5 h-4 w-4 flex-shrink-0 rounded" />
                  <div className="flex-1 space-y-1.5">
                    <SkeletonBox className="h-3.5 w-3/4" />
                    <SkeletonBox className="h-3 w-1/2" />
                    <SkeletonBox className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Right — Costing Matrix (fixed width) */}
        <div className="w-80 flex-shrink-0 space-y-4">
          {/* Input form */}
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
            <SkeletonBox className="h-4 w-32" />
            <SkeletonBox className="h-10 w-full rounded-lg" />
            <SkeletonBox className="h-10 w-full rounded-lg" />
            <div className="grid grid-cols-2 gap-2">
              <SkeletonBox className="h-10 rounded-lg" />
              <SkeletonBox className="h-10 rounded-lg" />
            </div>
            <SkeletonBox className="h-10 w-full rounded-lg" />
          </div>

          {/* Cost sections */}
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <SkeletonBox className="h-9 w-full rounded-none" />
              {[0, 1, 2].map((j) => (
                <div key={j} className="flex justify-between border-b border-gray-50 px-3 py-2 last:border-0">
                  <SkeletonBox className="h-3.5 w-1/2" />
                  <SkeletonBox className="h-3.5 w-20" />
                </div>
              ))}
            </div>
          ))}

          {/* FOB/CFR/CIF summary */}
          <div className="rounded-xl border-2 border-[#ECA134]/30 bg-white p-4 space-y-3">
            <SkeletonBox className="h-4 w-full" />
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-1 text-center">
                  <SkeletonBox className="h-3 w-8 mx-auto" />
                  <SkeletonBox className="h-6 w-full" />
                  <SkeletonBox className="h-2.5 w-12 mx-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
