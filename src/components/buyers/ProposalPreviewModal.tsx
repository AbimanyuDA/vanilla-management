"use client";

import { useEffect, useState, useCallback } from "react";
import {
  X,
  Send,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Mail,
  FileText,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Pre-generated proposal data passed from BuyerDirectory after the mutation resolves. */
export interface GeneratedProposalData {
  id: string;
  emailSubject: string;
  emailBody: string;
  quotationSheetDraft: string;
}

interface Props {
  buyerName: string;
  buyerEmail: string | null;
  /** null = still generating; defined = generation complete */
  proposalData: GeneratedProposalData | null;
  /** truthy string = generation failed with this message */
  generationError: string | null;
  /** True while the parent's generateProposal mutation is in-flight */
  isGenerating: boolean;
  onClose: () => void;
  onRetryGenerate: () => void;
  onProposalSent?: () => void;
}

type Tab = "email" | "quotation";
type SendStatus = "idle" | "sending" | "success" | "failed";

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton({ buyerName }: { buyerName: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-6">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ backgroundColor: "#FFF8EE" }}
      >
        <Loader2 size={28} className="animate-spin" style={{ color: "#ECA134" }} />
      </div>
      <div>
        <p className="text-base font-semibold text-foreground">Membuat Proposal...</p>
        <p className="text-sm text-muted-foreground mt-1">
          AI Agent sedang menyusun email dan quotation sheet
          <br />
          yang dipersonalisasi untuk{" "}
          <span className="font-medium">{buyerName}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-3">
          Proses ini biasanya selesai dalam 5–15 detik (maks. 30 detik)
        </p>
      </div>
      <div className="w-64 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full animate-pulse"
          style={{ backgroundColor: "#ECA134", width: "60%" }}
        />
      </div>
    </div>
  );
}

// ─── Status banner ────────────────────────────────────────────────────────────

function StatusBanner({
  status,
  error,
  buyerEmail,
}: {
  status: SendStatus;
  error: string;
  buyerEmail: string | null;
}) {
  if (status === "idle" || status === "sending") return null;
  return (
    <div
      className={cn(
        "flex items-start gap-3 px-5 py-4 border-t",
        status === "success" ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"
      )}
    >
      {status === "success" ? (
        <>
          <CheckCircle size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-800">Proposal Terkirim!</p>
            <p className="text-xs text-green-700 mt-0.5">
              Email berhasil dikirim ke{" "}
              <span className="font-medium">{buyerEmail}</span>
            </p>
          </div>
        </>
      ) : (
        <>
          <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-red-800">Pengiriman Gagal</p>
            <p className="text-xs text-red-600 mt-0.5 break-words">{error}</p>
            <p className="text-xs text-red-500 mt-1">
              Draft tersimpan — Anda dapat mencoba kirim ulang.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function ProposalPreviewModal({
  buyerName,
  buyerEmail,
  proposalData,
  generationError,
  isGenerating,
  onClose,
  onRetryGenerate,
  onProposalSent,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("email");
  const [emailSubject, setEmailSubject] = useState(proposalData?.emailSubject ?? "");
  const [emailBody, setEmailBody] = useState(proposalData?.emailBody ?? "");
  const [quotationSheet, setQuotationSheet] = useState(proposalData?.quotationSheetDraft ?? "");
  const [sendStatus, setSendStatus] = useState<SendStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const utils = trpc.useUtils();

  // Sync editable fields when proposalData arrives
  useEffect(() => {
    if (proposalData) {
      setEmailSubject(proposalData.emailSubject);
      setEmailBody(proposalData.emailBody);
      setQuotationSheet(proposalData.quotationSheetDraft);
    }
  }, [proposalData?.id]); // only re-sync when a new proposal is generated

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && sendStatus !== "sending") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, sendStatus]);

  const sendMutation = trpc.buyers.sendProposal.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setSendStatus("success");
        onProposalSent?.();
        if (proposalData?.id) {
          utils.buyers.getProposals.invalidate();
          utils.buyers.getProposalHistory.invalidate();
        }
      } else {
        setSendStatus("failed");
        setErrorMessage(data.error ?? "Terjadi kesalahan tidak diketahui");
      }
    },
    onError: (err) => {
      setSendStatus("failed");
      setErrorMessage(err.message);
    },
  });

  const handleSend = useCallback(() => {
    if (!proposalData?.id) return;
    setSendStatus("sending");
    setErrorMessage("");
    sendMutation.mutate({
      proposalId: proposalData.id,
      emailDraftOverride: JSON.stringify({ subject: emailSubject, body: emailBody }),
      quotationDraftOverride: quotationSheet,
    });
  }, [proposalData?.id, emailSubject, emailBody, quotationSheet, sendMutation]);

  const isGenerated = !!proposalData && !isGenerating;
  const isSending = sendStatus === "sending";
  const isSent = sendStatus === "success";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && sendStatus !== "sending") onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="proposal-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 id="proposal-modal-title" className="text-base font-semibold text-foreground">
              Pratinjau Proposal — {buyerName}
            </h2>
            {buyerEmail ? (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Mail size={10} />
                {buyerEmail}
              </p>
            ) : (
              <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                <AlertTriangle size={10} />
                Email buyer tidak tersedia — tidak dapat mengirim
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={isSending}
            aria-label="Tutup modal"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-gray-100 transition-colors disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Loading */}
          {isGenerating && (
            <div className="flex-1">
              <LoadingSkeleton buyerName={buyerName} />
            </div>
          )}

          {/* Generation error */}
          {generationError && !isGenerating && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
              <AlertCircle size={36} className="text-red-400" />
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Gagal Membuat Proposal</p>
                <p className="text-xs text-muted-foreground mt-1">{generationError}</p>
              </div>
              <button
                onClick={onRetryGenerate}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: "#ECA134" }}
              >
                <RefreshCw size={13} />
                Coba Lagi
              </button>
            </div>
          )}

          {/* Generated content with tabs (Requirement 4.4) */}
          {isGenerated && (
            <>
              {/* Tabs */}
              <div className="flex gap-0 border-b border-gray-100 px-6 pt-4">
                {(["email", "quotation"] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                      activeTab === tab
                        ? "text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                    style={activeTab === tab ? { borderBottomColor: "#ECA134" } : {}}
                    aria-selected={activeTab === tab}
                    role="tab"
                  >
                    {tab === "email" ? (
                      <><Mail size={13} />Email Preview</>
                    ) : (
                      <><FileText size={13} />Quotation Sheet</>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content — editable areas (Requirement 4.4) */}
              <div className="flex-1 min-h-0 overflow-auto px-6 py-4">
                {activeTab === "email" ? (
                  <div className="flex flex-col gap-3 h-full">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                        Subjek Email
                      </label>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        disabled={isSending || isSent}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 disabled:bg-gray-50 disabled:text-muted-foreground"
                        style={{ "--tw-ring-color": "#ECA134" } as React.CSSProperties}
                        placeholder="Subjek email..."
                      />
                    </div>
                    <div className="flex-1 flex flex-col min-h-0">
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                        Isi Email
                      </label>
                      <textarea
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        disabled={isSending || isSent}
                        className="flex-1 w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 disabled:bg-gray-50 disabled:text-muted-foreground font-sans leading-relaxed"
                        style={
                          { "--tw-ring-color": "#ECA134", minHeight: "260px" } as React.CSSProperties
                        }
                        placeholder="Isi email..."
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 h-full">
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Quotation Sheet (Markdown)
                    </label>
                    <textarea
                      value={quotationSheet}
                      onChange={(e) => setQuotationSheet(e.target.value)}
                      disabled={isSending || isSent}
                      className="flex-1 w-full px-3 py-2.5 text-xs border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 disabled:bg-gray-50 disabled:text-muted-foreground font-mono leading-relaxed"
                      style={
                        { "--tw-ring-color": "#ECA134", minHeight: "300px" } as React.CSSProperties
                      }
                      placeholder="Quotation sheet content..."
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Format Markdown — akan dilampirkan dalam email sebagai quotation sheet.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Status banner */}
          {isGenerated && (
            <StatusBanner status={sendStatus} error={errorMessage} buyerEmail={buyerEmail} />
          )}
        </div>

        {/* Footer */}
        {isGenerated && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
            {!isSent ? (
              <button
                onClick={onClose}
                disabled={isSending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <Save size={14} />
                Simpan Draft
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              {isSent ? (
                <button
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-lg text-white"
                  style={{ backgroundColor: "#22C55E" }}
                >
                  <CheckCircle size={14} />
                  Selesai
                </button>
              ) : (
                <>
                  {sendStatus === "failed" && (
                    <button
                      onClick={() => setSendStatus("idle")}
                      className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Edit ulang
                    </button>
                  )}
                  <button
                    onClick={handleSend}
                    disabled={isSending || !buyerEmail || !proposalData?.id}
                    title={!buyerEmail ? "Email buyer tidak tersedia" : ""}
                    className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: "#ECA134" }}
                  >
                    {isSending ? (
                      <><RefreshCw size={14} className="animate-spin" />Mengirim...</>
                    ) : (
                      <><Send size={14} />Kirim Sekarang</>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
