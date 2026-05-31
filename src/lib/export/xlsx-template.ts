/**
 * XLSX Export Builder — Vanilla Export Intelligence Platform (VEIP)
 *
 * Builds a formatted Excel workbook (.xlsx) for the costing matrix result.
 * Uses the `xlsx` (SheetJS) library.
 *
 * Sheet layout:
 *  - Sheet "Costing Matrix": all cost line items with labels and USD values
 *  - Sheet "Parameters":     input parameters used for this calculation
 *
 * References: design.md section 6.4, requirements.md Requirement 6 AC6
 */

import * as XLSX from "xlsx";

// ─── Types (mirror from pdf-template.tsx) ─────────────────────────────────────

export interface CostingXlsxInput {
  volumeKg: number;
  destinationCountry: string;
  containerType: "20ft" | "40ft" | "LCL";
  hppPerKg: number;
}

export interface CostingXlsxResult {
  input: CostingXlsxInput;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function containerLabel(ct: string): string {
  if (ct === "20ft") return "20 FT FCL";
  if (ct === "40ft") return "40 FT FCL";
  return "LCL";
}

// ─── Row builders ─────────────────────────────────────────────────────────────

interface Row {
  kategori: string;
  item: string;
  nilai_usd: number | string;
  keterangan?: string;
}

function buildRows(data: CostingXlsxResult): Row[] {
  const rows: Row[] = [];

  // Header rows (labels only)
  rows.push({
    kategori: "BIAYA DOMESTIK",
    item: "",
    nilai_usd: "",
    keterangan: "",
  });
  rows.push({
    kategori: "",
    item: "HPP Vanilla",
    nilai_usd: data.domestic.vanillaHPP,
    keterangan: `${data.input.hppPerKg} USD/kg × ${data.input.volumeKg} kg`,
  });
  rows.push({
    kategori: "",
    item: "Biaya Pengeringan",
    nilai_usd: data.domestic.dryingCost,
    keterangan: "5% dari HPP",
  });
  rows.push({
    kategori: "",
    item: "Pengemasan Vakum",
    nilai_usd: data.domestic.vacuumPackagingCost,
    keterangan: "$2 per kg",
  });
  rows.push({
    kategori: "",
    item: "Truk ke Tanjung Priok",
    nilai_usd: data.domestic.truckToPortCost,
    keterangan: "Biaya tetap",
  });
  rows.push({
    kategori: "",
    item: "Biaya EMKL / Undername",
    nilai_usd: data.domestic.emklCost,
    keterangan: "Biaya tetap",
  });
  rows.push({
    kategori: "",
    item: "Penerbitan Dokumen Lokal",
    nilai_usd: data.domestic.localDocumentCost,
    keterangan: "Phytosanitary + dokumen ekspor",
  });
  rows.push({
    kategori: "SUBTOTAL DOMESTIK (FOB)",
    item: "",
    nilai_usd: data.domestic.subtotal,
    keterangan: "",
  });

  rows.push({ kategori: "", item: "", nilai_usd: "", keterangan: "" }); // spacer

  rows.push({
    kategori: "BIAYA PERJALANAN (FREIGHT)",
    item: "",
    nilai_usd: "",
    keterangan: "",
  });
  rows.push({
    kategori: "",
    item: "Tarif Ocean Freight",
    nilai_usd: data.freight.oceanFreightRate,
    keterangan: `${containerLabel(data.input.containerType)} — diperbarui ${formatDate(data.freightRateUpdatedAt)}`,
  });
  rows.push({
    kategori: "",
    item: "Asuransi Laut",
    nilai_usd: data.freight.marineInsurance,
    keterangan: "0.5% dari nilai kargo (FOB)",
  });
  rows.push({
    kategori: "SUBTOTAL FREIGHT (CFR - FOB)",
    item: "",
    nilai_usd: data.freight.subtotal,
    keterangan: "",
  });

  rows.push({ kategori: "", item: "", nilai_usd: "", keterangan: "" });

  rows.push({
    kategori: "BIAYA NEGARA TUJUAN (ESTIMASI)",
    item: "",
    nilai_usd: "",
    keterangan: "",
  });
  rows.push({
    kategori: "",
    item: "Estimasi Import Duty",
    nilai_usd: data.destination.importDuty,
    keterangan: "5% dari FOB (estimasi rata-rata)",
  });
  rows.push({
    kategori: "",
    item: "Pajak Pelabuhan",
    nilai_usd: data.destination.portTax,
    keterangan: "Biaya penanganan pelabuhan",
  });
  rows.push({
    kategori: "",
    item: "Biaya Kliring Bea Cukai",
    nilai_usd: data.destination.customsClearance,
    keterangan: "Biaya agen bea cukai",
  });
  rows.push({
    kategori: "SUBTOTAL TUJUAN",
    item: "",
    nilai_usd: data.destination.subtotal,
    keterangan: "",
  });

  rows.push({ kategori: "", item: "", nilai_usd: "", keterangan: "" });

  // Summary
  rows.push({
    kategori: "RINGKASAN",
    item: "FOB (Free On Board)",
    nilai_usd: data.fob,
    keterangan: "Semua biaya domestik",
  });
  rows.push({
    kategori: "",
    item: "CFR (Cost & Freight)",
    nilai_usd: data.cfr,
    keterangan: "FOB + Ocean Freight",
  });
  rows.push({
    kategori: "",
    item: "CIF (Cost, Insurance & Freight)",
    nilai_usd: data.cif,
    keterangan: "CFR + Asuransi Laut",
  });

  return rows;
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Generate an XLSX workbook Buffer for the given costing result.
 * Call this server-side only (or in edge runtime).
 */
export function generateCostingXlsx(data: CostingXlsxResult): Buffer {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Costing Matrix ────────────────────────────────────────────────
  const rows = buildRows(data);

  // Column headers
  const wsData: (string | number)[][] = [
    ["Vanilla Export Intelligence Platform (VEIP)"],
    [`Costing Matrix — ${data.input.destinationCountry}`],
    [`Dibuat: ${formatDate(data.calculatedAt)}`],
    [], // blank row
    ["Kategori", "Item Biaya", "Nilai (USD)", "Keterangan"],
    ...rows.map((r) => [r.kategori, r.item, r.nilai_usd, r.keterangan ?? ""]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws["!cols"] = [
    { wch: 36 }, // Kategori
    { wch: 30 }, // Item
    { wch: 16 }, // Nilai USD
    { wch: 45 }, // Keterangan
  ];

  // Merge title rows across all columns
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Costing Matrix");

  // ── Sheet 2: Parameters ────────────────────────────────────────────────────
  const paramData: (string | number)[][] = [
    ["Parameter Kalkulasi"],
    [],
    ["Parameter", "Nilai"],
    ["Volume Pengiriman", `${data.input.volumeKg.toLocaleString()} kg`],
    ["Negara Tujuan", data.input.destinationCountry],
    ["Jenis Kontainer", containerLabel(data.input.containerType)],
    ["HPP Vanilla", `$${data.input.hppPerKg}/kg`],
    [],
    ["Tarif Freight Diperbarui", formatDate(data.freightRateUpdatedAt)],
    ["Tanggal Kalkulasi", formatDate(data.calculatedAt)],
    [],
    [
      "Catatan",
      "Dokumen ini bersifat estimasi. Biaya aktual dapat berbeda berdasarkan kondisi pasar.",
    ],
  ];

  const wsParam = XLSX.utils.aoa_to_sheet(paramData);
  wsParam["!cols"] = [{ wch: 28 }, { wch: 40 }];
  wsParam["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];

  XLSX.utils.book_append_sheet(wb, wsParam, "Parameter");

  // Write to Buffer
  const xlsxBuffer = XLSX.write(wb, {
    type: "buffer",
    bookType: "xlsx",
    compression: true,
  });

  return Buffer.from(xlsxBuffer);
}
