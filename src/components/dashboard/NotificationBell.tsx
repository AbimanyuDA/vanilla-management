"use client";

import { Bell } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const [open, setOpen] = useState(false);

  const { data: gapAlerts = [] } = trpc.market.getGapAlerts.useQuery(
    { includeAcknowledged: false },
    { refetchInterval: 30_000 }
  );

  const { data: regulationAlerts = [] } =
    trpc.compliance.getRegulationNotifications.useQuery(
      { includeAcknowledged: false },
      { refetchInterval: 60_000 }
    );

  const totalUnread = gapAlerts.length + regulationAlerts.length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifikasi — ${totalUnread} belum dibaca`}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-gray-100 transition-colors"
      >
        <Bell size={17} />
        {totalUnread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 rounded-full text-[10px] font-bold text-white px-1"
            style={{ backgroundColor: "#ECA134" }}
          >
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-10 z-50 w-80 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-foreground">
                Notifikasi
              </p>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
              {gapAlerts.length === 0 && regulationAlerts.length === 0 && (
                <p className="px-4 py-6 text-sm text-center text-muted-foreground">
                  Tidak ada notifikasi baru
                </p>
              )}

              {gapAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="mt-0.5 flex-shrink-0 w-2 h-2 rounded-full"
                      style={{ backgroundColor: "#ECA134" }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">
                        Celah Pasar Terdeteksi
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {alert.targetCountry}: permintaan +
                        {alert.demandSurgePct.toFixed(1)}%, suplai{" "}
                        {alert.competitorCountry} −{alert.supplyDropPct.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {regulationAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex-shrink-0 w-2 h-2 rounded-full bg-blue-500" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">
                        Regulasi Berubah — {alert.country}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {alert.regulationName}: {alert.oldValue} →{" "}
                        {alert.newValue}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
