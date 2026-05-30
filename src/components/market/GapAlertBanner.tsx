"use client";

import { AlertTriangle, X } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

export function GapAlertBanner() {
  const utils = trpc.useUtils();

  const { data: alerts = [], isLoading } = trpc.market.getGapAlerts.useQuery(
    { includeAcknowledged: false },
    { staleTime: 60_000 }
  );

  const markRead = trpc.market.markAlertRead.useMutation({
    onSuccess: () => {
      utils.market.getGapAlerts.invalidate();
    },
  });

  if (isLoading || alerts.length === 0) return null;

  return (
    <div
      className="mb-5 rounded-xl border overflow-hidden"
      style={{ borderColor: "#ECA134" }}
      role="alert"
      aria-label="Notifikasi celah pasar"
    >
      {/* Header strip */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ backgroundColor: "#ECA134" }}
      >
        <AlertTriangle size={15} className="text-white flex-shrink-0" />
        <p className="text-white text-sm font-semibold">
          {alerts.length} Celah Pasar Terdeteksi
        </p>
      </div>

      {/* Alert rows */}
      <div className="bg-orange-50 divide-y divide-orange-100">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between px-4 py-3 gap-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                <span className="font-semibold">{alert.targetCountry}</span>
                {" — "}Permintaan naik{" "}
                <span className="font-mono font-semibold" style={{ color: "#ECA134" }}>
                  +{alert.demandSurgePct.toFixed(1)}%
                </span>
                , pasokan{" "}
                <span className="font-semibold">{alert.competitorCountry}</span>{" "}
                turun{" "}
                <span className="font-mono font-semibold text-red-600">
                  -{alert.supplyDropPct.toFixed(1)}%
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Terdeteksi{" "}
                {new Date(alert.detectedAt).toLocaleString("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>

            <button
              onClick={() => markRead.mutate({ alertId: alert.id })}
              disabled={markRead.isPending}
              aria-label={`Tutup notifikasi untuk ${alert.targetCountry}`}
              className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-orange-100 transition-colors disabled:opacity-50"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
