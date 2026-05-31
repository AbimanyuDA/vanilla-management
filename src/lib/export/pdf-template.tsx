/**
 * PDF Export Template — Vanilla Export Intelligence Platform (VEIP)
 *
 * Generates a professional costing matrix PDF using @react-pdf/renderer.
 * Runs server-side only (Node.js). Returns a Buffer.
 *
 * Design: GSM design system — #FFFFFF background, #ECA134 accent gold.
 * References: design.md section 6.4, requirements.md Requirement 6 AC6
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Font,
} from "@react-pdf/renderer";

// ─── Types (mirror from tRPC compliance router) ───────────────────────────────

export interface CostingPdfInput {
  volumeKg: number;
  destinationCountry: string;
  containerType: "20ft" | "40ft" | "LCL";
  hppPerKg: number;
}

export interface CostingPdfResult {
  input: CostingPdfInput;
  domestic: {
    vanillaHPP: number;
    dryingCost: number;
    vacuumPackagingCost: number;
    truckToPortCost: number;
    emklCost: number;
    localDocumentCost: number;
    subtotal: number;
  };
  freight: {
    oceanFreightRate: number;
    marineInsurance: number;
    subtotal: number;
  };
  destination: {
    importDuty: number;
    portTax: number;
    customsClearance: number;
    subtotal: number;
  };
  fob: number;
  cfr: number;
  cif: number;
  calculatedAt: Date | string;
  freightRateUpdatedAt: Date | string;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const GOLD = "#ECA134";
const DARK = "#171717";
const GRAY = "#6B7280";
const LIGHT_GRAY = "#F8F9FA";
const WHITE = "#FFFFFF";
const BLUE_BG = "#EFF6FF";
const TEAL_BG = "#F0FDFA";
const VIOLET_BG = "#F5F3FF";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: WHITE,
    padding: 40,
    fontSize: 9,
    color: DARK,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: GOLD,
    paddingBottom: 12,
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: DARK,
  },
  companyTagline: {
    fontSize: 8,
    color: GRAY,
    marginTop: 2,
  },
  docTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    textAlign: "right",
  },
  docDate: {
    fontSize: 7,
    color: GRAY,
    textAlign: "right",
    marginTop: 2,
  },

  // ── Input summary box ────────────────────────────────────────────────────────
  paramBox: {
    backgroundColor: LIGHT_GRAY,
    borderRadius: 4,
    padding: 10,
    marginBottom: 16,
    flexDirection: "row",
    gap: 20,
  },
  paramGroup: {
    flex: 1,
  },
  paramLabel: {
    fontSize: 7,
    color: GRAY,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  paramValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: DARK,
  },

  // ── Section headers ──────────────────────────────────────────────────────────
  sectionHeader: {
    padding: 6,
    paddingHorizontal: 8,
    borderRadius: 3,
    marginBottom: 1,
  },
  sectionHeaderText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // ── Cost line items ──────────────────────────────────────────────────────────
  costLine: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
  },
  costLineLabel: {
    flex: 1,
    fontSize: 8,
    color: GRAY,
  },
  costLineValue: {
    fontSize: 8,
    fontFamily: "Helvetica",
    color: DARK,
    textAlign: "right",
    minWidth: 80,
  },
  costLineSubtotal: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#F3F4F6",
    borderTopWidth: 0.5,
    borderTopColor: "#D1D5DB",
    marginBottom: 10,
  },
  costLineSubtotalLabel: {
    flex: 1,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: DARK,
  },
  costLineSubtotalValue: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    textAlign: "right",
    minWidth: 80,
  },

  // ── FOB/CFR/CIF summary ──────────────────────────────────────────────────────
  summaryBox: {
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: GOLD,
    borderRadius: 4,
    overflow: "hidden",
  },
  summaryHeader: {
    backgroundColor: GOLD,
    padding: 8,
  },
  summaryHeaderText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: WHITE,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryGrid: {
    flexDirection: "row",
    backgroundColor: WHITE,
    padding: 12,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: GRAY,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    marginTop: 2,
  },
  summaryDesc: {
    fontSize: 6,
    color: GRAY,
    marginTop: 1,
  },
  summaryDivider: {
    width: 0.5,
    backgroundColor: "#E5E7EB",
    marginVertical: 4,
  },

  // ── Footer ───────────────────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
    flexDirection: "row",
  },
  footerLeft: {
    flex: 1,
    fontSize: 6,
    color: GRAY,
  },
  footerRight: {
    fontSize: 6,
    color: GRAY,
    textAlign: "right",
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUSD(n: number): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CostSection({
  title,
  bgColor,
  textColor,
  lines,
  subtotal,
}: {
  title: string;
  bgColor: string;
  textColor: string;
  lines: { label: string; value: number }[];
  subtotal: number;
}) {
  return (
    <View>
      <View style={[styles.sectionHeader, { backgroundColor: bgColor }]}>
        <Text style={[styles.sectionHeaderText, { color: textColor }]}>
          {title}
        </Text>
      </View>
      {lines.map((line, i) => (
        <View key={i} style={styles.costLine}>
          <Text style={styles.costLineLabel}>{line.label}</Text>
          <Text style={styles.costLineValue}>{formatUSD(line.value)}</Text>
        </View>
      ))}
      <View style={styles.costLineSubtotal}>
        <Text style={styles.costLineSubtotalLabel}>Subtotal</Text>
        <Text style={styles.costLineSubtotalValue}>{formatUSD(subtotal)}</Text>
      </View>
    </View>
  );
}

// ─── Main PDF Document ────────────────────────────────────────────────────────

function CostingPdfDocument({ data }: { data: CostingPdfResult }) {
  const containerLabel =
    data.input.containerType === "20ft"
      ? "20 FT FCL"
      : data.input.containerType === "40ft"
        ? "40 FT FCL"
        : "LCL";

  return (
    <Document
      title={`Costing Matrix — ${data.input.destinationCountry}`}
      author="Vanilla Export Intelligence Platform"
      subject="Export Cost Analysis FOB to CIF"
    >
      <Page size="A4" style={styles.page}>
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>Vanilla Royal</Text>
            <Text style={styles.companyTagline}>
              Export Intelligence Platform (VEIP)
            </Text>
          </View>
          <View>
            <Text style={styles.docTitle}>Costing Matrix</Text>
            <Text style={styles.docDate}>
              Dibuat: {formatDate(data.calculatedAt)}
            </Text>
          </View>
        </View>

        {/* ── Parameter summary ── */}
        <View style={styles.paramBox}>
          <View style={styles.paramGroup}>
            <Text style={styles.paramLabel}>Volume Pengiriman</Text>
            <Text style={styles.paramValue}>
              {data.input.volumeKg.toLocaleString("en-US")} kg
            </Text>
          </View>
          <View style={styles.paramGroup}>
            <Text style={styles.paramLabel}>Negara Tujuan</Text>
            <Text style={styles.paramValue}>{data.input.destinationCountry}</Text>
          </View>
          <View style={styles.paramGroup}>
            <Text style={styles.paramLabel}>Jenis Kontainer</Text>
            <Text style={styles.paramValue}>{containerLabel}</Text>
          </View>
          <View style={styles.paramGroup}>
            <Text style={styles.paramLabel}>HPP Vanilla</Text>
            <Text style={styles.paramValue}>
              {formatUSD(data.input.hppPerKg)}/kg
            </Text>
          </View>
        </View>

        {/* ── Domestic costs ── */}
        <CostSection
          title="Biaya Domestik"
          bgColor={BLUE_BG}
          textColor="#1D4ED8"
          lines={[
            { label: "HPP Vanilla", value: data.domestic.vanillaHPP },
            {
              label: "Biaya Pengeringan (5% HPP)",
              value: data.domestic.dryingCost,
            },
            {
              label: "Pengemasan Vakum ($2/kg)",
              value: data.domestic.vacuumPackagingCost,
            },
            {
              label: "Truk ke Tanjung Priok",
              value: data.domestic.truckToPortCost,
            },
            { label: "Biaya EMKL / Undername", value: data.domestic.emklCost },
            {
              label: "Penerbitan Dokumen Lokal",
              value: data.domestic.localDocumentCost,
            },
          ]}
          subtotal={data.domestic.subtotal}
        />

        {/* ── Freight costs ── */}
        <CostSection
          title="Biaya Perjalanan (Freight)"
          bgColor={TEAL_BG}
          textColor="#0F766E"
          lines={[
            {
              label: "Tarif Ocean Freight",
              value: data.freight.oceanFreightRate,
            },
            {
              label: "Asuransi Laut (0.5%)",
              value: data.freight.marineInsurance,
            },
          ]}
          subtotal={data.freight.subtotal}
        />

        {/* ── Destination costs ── */}
        <CostSection
          title="Biaya Negara Tujuan (Estimasi)"
          bgColor={VIOLET_BG}
          textColor="#7C3AED"
          lines={[
            {
              label: "Estimasi Import Duty (5%)",
              value: data.destination.importDuty,
            },
            { label: "Pajak Pelabuhan", value: data.destination.portTax },
            {
              label: "Biaya Kliring Bea Cukai",
              value: data.destination.customsClearance,
            },
          ]}
          subtotal={data.destination.subtotal}
        />

        {/* ── FOB/CFR/CIF summary ── */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryHeaderText}>
              Ringkasan Harga Ekspor
            </Text>
          </View>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>FOB</Text>
              <Text style={styles.summaryValue}>{formatUSD(data.fob)}</Text>
              <Text style={styles.summaryDesc}>Free On Board</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>CFR</Text>
              <Text style={styles.summaryValue}>{formatUSD(data.cfr)}</Text>
              <Text style={styles.summaryDesc}>Cost &amp; Freight</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>CIF</Text>
              <Text style={styles.summaryValue}>{formatUSD(data.cif)}</Text>
              <Text style={styles.summaryDesc}>
                Cost, Insurance &amp; Freight
              </Text>
            </View>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>
            Tarif freight diperbarui:{" "}
            {formatDate(data.freightRateUpdatedAt)} — Dokumen ini bersifat
            estimasi dan dapat berubah.
          </Text>
          <Text style={styles.footerRight}>
            VEIP © {new Date().getFullYear()} Vanilla Royal
          </Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── Export function ──────────────────────────────────────────────────────────

/**
 * Generate a PDF Buffer for the given costing result.
 * Call this server-side only.
 */
export async function generateCostingPdf(
  data: CostingPdfResult
): Promise<Buffer> {
  const buffer = await renderToBuffer(
    <CostingPdfDocument data={data} />
  );
  return Buffer.from(buffer);
}
