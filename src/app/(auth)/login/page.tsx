"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { loginAction } from "./_actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-2.5 px-4 rounded-lg font-semibold text-white text-sm transition-opacity disabled:opacity-60"
      style={{ backgroundColor: "#ECA134" }}
    >
      {pending ? "Masuk..." : "Masuk"}
    </button>
  );
}

function SessionExpiredBanner() {
  const params = useSearchParams();
  if (params.get("reason") !== "session_expired") return null;
  return (
    <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
      Sesi Anda telah berakhir karena tidak aktif selama 30 menit. Silakan masuk kembali.
    </div>
  );
}

export default function LoginPage() {
  const [error, formAction] = useFormState(loginAction, null);

  return (
    <div className="w-full max-w-sm">
      {/* Logo / Brand */}
      <div className="text-center mb-8">
        <div
          className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
          style={{ backgroundColor: "#ECA134" }}
          aria-hidden="true"
        >
          <span className="text-white font-bold text-lg">V</span>
        </div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">
          Vanilla Export Intelligence
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform internal VEIP
        </p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-foreground mb-5">
          Masuk ke akun Anda
        </h2>

        <Suspense>
          <SessionExpiredBanner />
        </Suspense>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="nama@veip.internal"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
              style={{ "--tw-ring-color": "#ECA134" } as React.CSSProperties}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
              style={{ "--tw-ring-color": "#ECA134" } as React.CSSProperties}
            />
          </div>

          <SubmitButton />
        </form>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-6">
        Akses terbatas — hanya untuk pengguna terdaftar VEIP
      </p>
    </div>
  );
}
