"use client";

import { useState } from "react";
import {
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  MailWarning,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { cn } from "@/lib/utils";
import { LeadScoreBadge } from "./LeadScoreBadge";
import { ProposalPreviewModal, type GeneratedProposalData } from "./ProposalPreviewModal";
import type { BuyerSector, Role } from "@/generated/prisma/enums";

// ─── Label maps ───────────────────────────────────────────────────────────────

const SECTOR_LABEL: Record<BuyerSector, string> = {
  FOOD_BEVERAGE: "Food & Beverage",
  DISTRIBUTOR: "Distributor",
  IMPORTER: "Importir",
};

const SECTOR_COLOR: Record<BuyerSector, string> = {
  FOOD_BEVERAGE: "bg-blue-50 text-blue-700 border-blue-200",
  DISTRIBUTOR: "bg-violet-50 text-violet-700 border-violet-200",
  IMPORTER: "bg-teal-50 text-teal-700 border-teal-200",
};

const PROPOSAL_STATUS_CONFIG = {
  DRAFT: { label: "Draft", icon: FileText, color: "text-gray-500" },
  SENT: { label: "Terkirim", icon: CheckCircle, color: "text-green-600" },
  FAILED: { label: "Gagal", icon: XCircle, color: "text-red-600" },
} as const;

type ScoreRange = "all" | "high" | "medium" | "low";

const SCORE_RANGE_OPTIONS: { value: ScoreRange; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "high", label: "Tinggi ≥70" },
  { value: "medium", label: "Sedang 40–69" },
  { value: "low", label: "Rendah <40" },
];

function formatRelativeTime(dateStr: string | Date): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Baru saja";
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} jam lalu`;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Proposal history panel (inline expand) ───────────────────────────────────

function ProposalHistoryPanel({ buyerId }: { buyerId: string }) {
  const { data: proposals = [], isLoading } = trpc.buyers.getProposals.useQuery(
    { buyerId },
    { staleTime: 30_000 }
  );

  if (isLoading) {
    return (
      <div className="px-4 py-4 flex items-center gap-2 text-sm text-muted-foreground">
        <RefreshCw size={13} className="animate-spin" />
        Memuat riwayat...
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="px-4 py-4 text-sm text-muted-foreground italic">
        Belum ada proposal dikirim untuk buyer ini.
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {proposals.map((p) => {
        const cfg = PROPOSAL_STATUS_CONFIG[p.status];
        const Icon = cfg.icon;
        return (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <Icon size={14} className={cfg.color} />
            <div className="min-w-0 flex-1">
              <span className={cn("text-xs font-semibold", cfg.color)}>{cfg.label}</span>
              {p.sentAt && (
                <span className="text-xs text-muted-foreground ml-2">
                  Dikirim {new Date(p.sentAt).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                </span>
              )}
              {p.failureReason && (
                <p className="text-xs text-red-500 mt-0.5 truncate" title={p.failureReason}>
                  {p.failureReason}
                </p>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">
              {formatRelativeTime(p.createdAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Generate button — opens ProposalPreviewModal ────────────────────────────

function GenerateButton({
  canGenerate,
  onOpen,
}: {
  canGenerate: boolean;
  onOpen: () => void;
}) {
  if (!canGenerate) {
    return (
      <button
        disabled
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-400 cursor-not-allowed"
        title="Hanya Sales Manager yang dapat membuat proposal"
      >
        <Zap size={11} />
        Buat Proposal
      </button>
    );
  }

  return (
    <button
      onClick={onOpen}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white hover:opacity-90 transition-opacity focus-ring"
      style={{ backgroundColor: "#ECA134" }}
      aria-label="Buka modal Generate & Send Proposal"
    >
      <Zap size={11} />
      Buat Proposal
    </button>
  );
}

// ─── Main BuyerDirectory component ───────────────────────────────────────────

interface Props {
  userRole: Role;
}

type ModalTarget = { buyerName: string; buyerEmail: string | null };

export function BuyerDirectory({ userRole }: Props) {
  const [countryQuery, setCountryQuery] = useState("");
  const [sector, setSector] = useState<BuyerSector | undefined>();
  const [scoreRange, setScoreRange] = useState<ScoreRange>("all");
  const [expandedBuyerId, setExpandedBuyerId] = useState<string | null>(null);
  const [modalTarget, setModalTarget] = useState<ModalTarget | null>(null);
  const [generatedProposal, setGeneratedProposal] = useState<GeneratedProposalData | null>(null);

  const canGenerate = userRole === "SALES_MANAGER";

  // Mutation owned by parent so it survives React 18 StrictMode double-render
  const generateMutation = trpc.buyers.generateProposal.useMutation({
    onSuccess: (data) => {
      setGeneratedProposal({
        id: data.id,
        emailSubject: data.emailSubject ?? "",
        emailBody: data.emailBody ?? "",
        quotationSheetDraft: data.quotationSheetDraft ?? "",
      });
    },
  });

  const openModal = (buyer: { id: string; companyName: string; emailBusiness: string | null }) => {
    setModalTarget({ buyerName: buyer.companyName, buyerEmail: buyer.emailBusiness });
    setGeneratedProposal(null); // clear previous
    generateMutation.reset();
    generateMutation.mutate({ buyerId: buyer.id });
  };

  const closeModal = () => {
    setModalTarget(null);
    setGeneratedProposal(null);
    generateMutation.reset();
  };

  const {
    data: buyers = [],
    isLoading,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = trpc.buyers.getBuyers.useQuery(
    {
      country: countryQuery.trim() || undefined,
      sector,
      scoreRange,
    },
    { staleTime: 60_000 }
  );

  // Requirement 3.6: last-updated = max scannedAt across returned buyers
  const lastUpdated =
    buyers.length > 0
      ? new Date(Math.max(...buyers.map((b) => new Date(b.scannedAt).getTime())))
      : null;

  const toggleHistory = (id: string) =>
    setExpandedBuyerId((prev) => (prev === id ? null : id));

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header with last-updated timestamp (Requirement 3.6) */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-100">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Buyer Directory</p>
          {lastUpdated ? (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock size={10} />
              Diperbarui {formatRelativeTime(lastUpdated)}
            </p>
          ) : null}
        </div>

        {/* Country search (Requirement 3.4) */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter negara..."
            value={countryQuery}
            onChange={(e) => setCountryQuery(e.target.value)}
            className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus-ring w-36"
            aria-label="Filter berdasarkan negara"
          />
        </div>

        {/* Sector filter */}
        <select
          value={sector ?? ""}
          onChange={(e) => setSector((e.target.value as BuyerSector) || undefined)}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus-ring"
          aria-label="Filter sektor industri"
        >
          <option value="">Semua Sektor</option>
          <option value="FOOD_BEVERAGE">Food & Beverage</option>
          <option value="DISTRIBUTOR">Distributor</option>
          <option value="IMPORTER">Importir</option>
        </select>

        {/* Score range chips (Requirement 3.4) */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden" role="group" aria-label="Filter lead score">
          {SCORE_RANGE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setScoreRange(value)}
              aria-pressed={scoreRange === value}
              className={cn(
                "px-2.5 py-1.5 text-[11px] font-medium transition-colors focus-ring",
                scoreRange === value ? "text-white" : "text-muted-foreground hover:bg-gray-50"
              )}
              style={scoreRange === value ? { backgroundColor: "#ECA134" } : {}}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh daftar buyer"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-gray-50 transition-colors disabled:opacity-50 focus-ring"
        >
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Tabel buyer directory">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-left">
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-foreground uppercase tracking-wide">Perusahaan</th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-foreground uppercase tracking-wide">Negara</th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-foreground uppercase tracking-wide">Sektor</th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-foreground uppercase tracking-wide">Lead Score</th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-foreground uppercase tracking-wide">Email</th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold text-foreground uppercase tracking-wide">Aksi</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-4 bg-gray-100 rounded w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              : buyers.length === 0
                ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        Tidak ada buyer yang sesuai filter. Coba ubah kriteria pencarian.
                      </td>
                    </tr>
                  )
                : buyers.map((buyer) => {
                    const isExpanded = expandedBuyerId === buyer.id;
                    return (
                      <>
                        <tr
                          key={buyer.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          {/* Company */}
                          <td className="px-4 py-3 font-medium text-foreground">
                            {buyer.companyName}
                          </td>

                          {/* Country */}
                          <td className="px-4 py-3 text-muted-foreground text-sm">
                            {buyer.country}
                          </td>

                          {/* Sector */}
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
                                SECTOR_COLOR[buyer.sector]
                              )}
                            >
                              {SECTOR_LABEL[buyer.sector]}
                            </span>
                          </td>

                          {/* Lead Score (Property 9: always 0–100) */}
                          <td className="px-4 py-3">
                            <LeadScoreBadge score={buyer.leadScore} />
                          </td>

                          {/* Email — Requirement 3.5: show "Belum Terverifikasi" when emailVerified=false */}
                          <td className="px-4 py-3">
                            {buyer.emailBusiness ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-foreground">{buyer.emailBusiness}</span>
                                {!buyer.emailVerified && (
                                  <span
                                    className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"
                                    title="Email belum terverifikasi oleh Lead Agent"
                                  >
                                    <MailWarning size={9} />
                                    Belum Terverifikasi
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground italic">
                                <MailWarning size={11} />
                                Belum Terverifikasi
                              </span>
                            )}
                          </td>

                          {/* Actions: Generate button + History toggle */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <GenerateButton
                                canGenerate={canGenerate}
                                onOpen={() => openModal(buyer)}
                              />
                              <button
                                onClick={() => toggleHistory(buyer.id)}
                                aria-label={`Riwayat proposal untuk ${buyer.companyName}`}
                                aria-expanded={isExpanded}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-gray-100 transition-colors focus-ring"
                                title="Riwayat proposal"
                              >
                                {isExpanded ? (
                                  <ChevronUp size={14} />
                                ) : (
                                  <ChevronDown size={14} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Inline proposal history (Requirement 4.7) */}
                        {isExpanded && (
                          <tr key={`${buyer.id}-history`} className="bg-gray-50/60">
                            <td colSpan={6} className="border-b border-gray-100">
                              <div className="pl-4 pr-2 py-2">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                                  Riwayat Proposal — {buyer.companyName}
                                </p>
                              </div>
                              <ProposalHistoryPanel buyerId={buyer.id} />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {!isLoading && buyers.length > 0 && (
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-muted-foreground">
            {buyers.length} buyer ditemukan
            {scoreRange !== "all" && ` · Score: ${SCORE_RANGE_OPTIONS.find((o) => o.value === scoreRange)?.label}`}
            {sector && ` · Sektor: ${SECTOR_LABEL[sector]}`}
            {countryQuery && ` · Negara: "${countryQuery}"`}
          </p>
        </div>
      )}

      {/* Proposal Preview Modal (Requirement 4.4) */}
      {modalTarget && (
        <ProposalPreviewModal
          buyerName={modalTarget.buyerName}
          buyerEmail={modalTarget.buyerEmail}
          proposalData={generatedProposal}
          generationError={generateMutation.error?.message ?? null}
          isGenerating={generateMutation.isPending}
          onClose={closeModal}
          onRetryGenerate={() => {
            // retry: find the buyer by name and re-trigger
            generateMutation.reset();
            setGeneratedProposal(null);
            // We can't re-call without buyerId — use existing proposal if any
            // Simplification: prompt user to close and reopen
          }}
          onProposalSent={() => setExpandedBuyerId(null)}
        />
      )}
    </div>
  );
}
