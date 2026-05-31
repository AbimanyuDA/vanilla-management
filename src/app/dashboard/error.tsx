/**
 * Dashboard-level error page — Next.js App Router error.tsx
 *
 * Catches unhandled errors thrown during rendering within the /dashboard/* routes.
 * This is the fallback of last resort; individual modules have their own ErrorBoundary.
 *
 * References: requirements.md Requirement 8
 */

"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard/error]", error.message, error.digest);
  }, [error]);

  return (
    <div
      className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center px-6 py-16 text-center"
      role="alert"
      aria-live="assertive"
    >
      {/* Icon */}
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2"
        style={{ borderColor: "#ECA134", backgroundColor: "#FFF8EE" }}
        aria-hidden="true"
      >
        <AlertTriangle className="h-8 w-8" style={{ color: "#ECA134" }} />
      </div>

      {/* Message */}
      <h1 className="mb-2 text-xl font-bold text-foreground">
        Terjadi Kesalahan
      </h1>
      <p className="mb-1 text-sm text-muted-foreground">
        Halaman tidak dapat dimuat karena terjadi kesalahan yang tidak terduga.
      </p>
      {error.digest && (
        <p className="mb-6 font-mono text-xs text-muted-foreground/60">
          Error ID: {error.digest}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          aria-label="Coba muat ulang halaman"
          className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2"
          style={{ backgroundColor: "#ECA134" }}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Coba Lagi
        </button>
        <Link
          href="/dashboard"
          aria-label="Kembali ke halaman utama dashboard"
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          Ke Dashboard
        </Link>
      </div>
    </div>
  );
}
