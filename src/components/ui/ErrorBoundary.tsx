/**
 * Error Boundary — Vanilla Export Intelligence Platform (VEIP)
 *
 * React class-based error boundary for graceful module failure handling.
 * Wraps individual dashboard modules so one failing component doesn't
 * crash the entire page.
 *
 * Usage:
 *   <ErrorBoundary moduleName="Market Intelligence">
 *     <ImportQuotaTable />
 *   </ErrorBoundary>
 *
 * References: requirements.md Requirement 8, tasks.md Task 18
 */

"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Module name shown in the fallback UI */
  moduleName?: string;
  /** Optional custom fallback component */
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ─── Class-based Error Boundary ───────────────────────────────────────────────

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[ErrorBoundary] ${this.props.moduleName ?? "Module"} crashed:`,
      error.message,
      info.componentStack
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ModuleErrorFallback
          moduleName={this.props.moduleName}
          error={this.state.error}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

// ─── Fallback UI ──────────────────────────────────────────────────────────────

function ModuleErrorFallback({
  moduleName,
  error,
  onReset,
}: {
  moduleName?: string;
  error: Error | null;
  onReset: () => void;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex min-h-[180px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-red-100 bg-red-50 px-6 py-8 text-center"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
        <AlertTriangle className="h-5 w-5 text-red-500" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-semibold text-red-800">
          {moduleName ? `${moduleName} tidak dapat dimuat` : "Terjadi kesalahan"}
        </p>
        <p className="mt-1 text-xs text-red-600">
          {error?.message ?? "Terjadi kesalahan yang tidak terduga. Coba muat ulang halaman."}
        </p>
      </div>
      <button
        onClick={onReset}
        aria-label={`Coba muat ulang ${moduleName ?? "modul"}`}
        className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
      >
        <RefreshCw className="h-3 w-3" aria-hidden="true" />
        Coba Lagi
      </button>
    </div>
  );
}

// ─── Convenience wrapper with module name ─────────────────────────────────────

/**
 * Wraps a module in an error boundary with a consistent fallback UI.
 * Use this around tRPC-powered components to gracefully handle API errors.
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  moduleName: string
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary moduleName={moduleName}>
      <Component {...props} />
    </ErrorBoundary>
  );
  WrappedComponent.displayName = `withErrorBoundary(${moduleName})`;
  return WrappedComponent;
}
