import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PDFDocument } from "pdf-lib";
import type { LineResult } from "./calc";
import {
  formatGrams,
  formatKg,
  formatCfu,
  formatPercent,
  formatCurrency,
  type CurrencyCode,
} from "./format";

export type PackagingPdfRow = {
  item: string;
  quantity: number;
  costGbp: number;
  costPerSetGbp: number;
  totalGbp: number;
};

type SelectedLabelAsset = {
  fileName: string;
  mimeType: "image/jpeg" | "image/png" | "application/pdf";
  blobUrl: string;
};

type DocWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

function formatPdfCurrency(
  gbpValue: number,
  currency: CurrencyCode,
  gbpToCurrencyRate: number
): string {
  const rate = Number.isFinite(gbpToCurrencyRate) && gbpToCurrencyRate > 0 ? gbpToCurrencyRate : 1;
  return formatCurrency(gbpValue * rate, currency);
}

function tableEndY(doc: jsPDF, fallback: number): number {
  return (doc as DocWithAutoTable).lastAutoTable?.finalY ?? fallback;
}

function triggerPdfDownload(bytes: Uint8Array, fileName: string): void {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function fitImageInA4(imageWidth: number, imageHeight: number) {
  const pageWidth = 595.28; // A4 portrait width in points
  const pageHeight = 841.89; // A4 portrait height in points
  const margin = 24;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;
  const ratio = Math.min(maxWidth / imageWidth, maxHeight / imageHeight);
  const width = imageWidth * ratio;
  const height = imageHeight * ratio;
  return {
    pageWidth,
    pageHeight,
    width,
    height,
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
  };
}

async function appendLabelPages(
  basePdfBuffer: ArrayBuffer,
  label: SelectedLabelAsset
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(basePdfBuffer);
  const response = await fetch(label.blobUrl);
  if (!response.ok) {
    throw new Error(`Failed to load label asset (${response.status})`);
  }
  const labelBuffer = await response.arrayBuffer();

  if (label.mimeType === "application/pdf") {
    const labelPdf = await PDFDocument.load(labelBuffer);
    const pages = await doc.copyPages(labelPdf, labelPdf.getPageIndices());
    pages.forEach((page) => doc.addPage(page));
    return doc.save();
  }

  const image =
    label.mimeType === "image/jpeg"
      ? await doc.embedJpg(labelBuffer)
      : await doc.embedPng(labelBuffer);
  const frame = fitImageInA4(image.width, image.height);
  const page = doc.addPage([frame.pageWidth, frame.pageHeight]);
  page.drawImage(image, { x: frame.x, y: frame.y, width: frame.width, height: frame.height });
  return doc.save();
}

/**
 * Either save the PDF directly, or merge the selected label asset on top and
 * trigger a browser download. Falls back to saving the base PDF on error.
 */
async function saveOrAppendLabel(
  doc: jsPDF,
  fileName: string,
  selectedLabel: SelectedLabelAsset | undefined
): Promise<void> {
  if (!selectedLabel) {
    doc.save(fileName);
    return;
  }
  try {
    const basePdfBuffer = doc.output("arraybuffer") as ArrayBuffer;
    const mergedBytes = await appendLabelPages(basePdfBuffer, selectedLabel);
    triggerPdfDownload(mergedBytes, fileName);
  } catch (error) {
    console.error("Failed to append label pages, downloading base PO only:", error);
    doc.save(fileName);
  }
}

/**
 * Render a labelled summary block (heading + key/value table) at the current
 * cursor and advance `state.y` past it.
 */
function drawSummaryBlock(
  doc: jsPDF,
  state: { y: number },
  title: string,
  rowsData: string[][]
): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(title, 14, state.y);
  state.y += 2;
  doc.setFont("helvetica", "normal");
  autoTable(doc, {
    startY: state.y,
    body: rowsData,
    styles: { fontSize: 8, cellPadding: 1.8 },
    margin: { left: 14 },
    tableWidth: 90,
    theme: "grid",
    columnStyles: {
      0: { cellWidth: 52, fontStyle: "bold" },
      1: { cellWidth: 38, halign: "right" },
    },
  });
  state.y = tableEndY(doc, state.y) + 6;
}

function drawPoHeader(doc: jsPDF, state: { y: number }, poReference: string): void {
  doc.setFontSize(16);
  doc.text("Purchase Order", 14, state.y);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(poReference, 196, state.y, { align: "right" });
  doc.setFont("helvetica", "normal");
  state.y += 10;
}

function safeFileNameSegment(name: string): string {
  return name.replace(/[^a-z0-9]/gi, "-");
}

export async function generateRecipePdf(
  recipeName: string,
  batchGrams: number,
  units: number,
  results: LineResult[],
  packagingRows: PackagingPdfRow[],
  totals: {
    totalGrams: number;
    totalCfu: number;
    formulaTotalCost: number;
    formulaCostPerKg: number;
    formulaCostPerSet?: number;
    packagingTotalCost: number;
    packagingCostPerSet?: number;
    finalTotalCost: number;
    finalCostPerKg: number;
    finalCostPerSet?: number;
  },
  poReference: string,
  currency: CurrencyCode,
  gbpToCurrencyRate: number,
  selectedLabel?: SelectedLabelAsset
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm" });
  const state = { y: 16 };
  const fmt = (gbp: number) => formatPdfCurrency(gbp, currency, gbpToCurrencyRate);

  drawPoHeader(doc, state, poReference);

  doc.setFontSize(12);
  doc.text(`Material: ${recipeName}`, 14, state.y);
  state.y += 6;
  doc.text(`Batch size: ${formatGrams(batchGrams)} g (${formatKg(batchGrams / 1000)} kg)`, 14, state.y);
  state.y += 6;
  const kgPerUnit = units > 0 ? batchGrams / 1000 / units : 0;
  doc.text(`kg per set: ${kgPerUnit > 0 ? `${formatKg(kgPerUnit)} kg` : "—"}`, 14, state.y);
  state.y += 6;
  doc.text(`Sets: ${units}`, 14, state.y);
  state.y += 10;

  const headers = [
    "ID",
    "Ingredient",
    "g",
    "kg",
    "g/set",
    "%",
    "Stock CFU/g",
    "Target CFU",
    "Final CFU/g",
    "Cost/kg",
    "Cost",
  ];
  const rows = results.map((r) => [
    r.ingredientId,
    r.ingredientName,
    formatGrams(r.grams),
    formatKg(r.grams / 1000),
    units > 0 ? formatGrams(r.grams / units) : "—",
    formatPercent(r.percent),
    r.isBacteria ? formatCfu(r.stockCfuPerG) : "—",
    r.isBacteria ? formatCfu(r.targetTotalCfu) : "—",
    r.isBacteria ? formatCfu(r.finalCfuPerGram) : "—",
    fmt(r.costPerKgGbp),
    fmt(r.costInProduct),
  ]);

  autoTable(doc, {
    startY: state.y,
    head: [headers],
    body: rows,
    styles: { fontSize: 7 },
    margin: { left: 14 },
    tableWidth: "auto",
  });
  state.y = tableEndY(doc, state.y) + 10;

  doc.setFontSize(11);
  doc.text("Service", 14, state.y);
  state.y += 4;

  const packagingHeaders = ["Item", "Quantity", "Cost", "Cost/Set", "Total Cost"];
  const packagingBody = packagingRows.map((row) => [
    row.item,
    String(Number(row.quantity.toFixed(2))),
    fmt(row.costGbp),
    units > 0 ? fmt(row.costPerSetGbp) : "—",
    fmt(row.totalGbp),
  ]);
  packagingBody.push([
    "Total",
    "",
    "",
    units > 0 ? fmt(totals.packagingCostPerSet ?? 0) : "—",
    fmt(totals.packagingTotalCost),
  ]);

  autoTable(doc, {
    startY: state.y,
    head: [packagingHeaders],
    body: packagingBody,
    styles: { fontSize: 8 },
    margin: { left: 14 },
    tableWidth: "auto",
  });
  state.y = tableEndY(doc, state.y) + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Summary", 14, state.y);
  state.y += 8;
  doc.setFont("helvetica", "normal");

  drawSummaryBlock(doc, state, "Material", [
    ["Total final CFU/g", formatCfu(totals.totalCfu)],
    ["Total cost", fmt(totals.formulaTotalCost)],
    ["Cost per kg", fmt(totals.formulaCostPerKg)],
    ["Cost per set", totals.formulaCostPerSet != null ? fmt(totals.formulaCostPerSet) : "—"],
  ]);

  drawSummaryBlock(doc, state, "Service", [
    ["Total cost", fmt(totals.packagingTotalCost)],
    ["Cost per set", totals.packagingCostPerSet != null ? fmt(totals.packagingCostPerSet) : "—"],
  ]);

  drawSummaryBlock(doc, state, "Final Product", [
    ["Total cost", fmt(totals.finalTotalCost)],
    ["Cost per kg", fmt(totals.finalCostPerKg)],
    ["Cost per set", totals.finalCostPerSet != null ? fmt(totals.finalCostPerSet) : "—"],
  ]);

  const fileName = `${poReference}-${safeFileNameSegment(recipeName)}-${batchGrams}g.pdf`;
  await saveOrAppendLabel(doc, fileName, selectedLabel);
}

export async function generateFinishedProductPdf(
  productName: string,
  units: number,
  unitsPerPack: number,
  packagingRows: PackagingPdfRow[],
  totals: {
    packs: number;
    baseUnitCost: number;
    productTotalCost: number;
    packagingTotalCost: number;
    packagingCostPerUnit: number;
    packagingCostPerPack: number;
    finalTotalCost: number;
    finalCostPerUnit: number;
    finalCostPerPack: number;
  },
  poReference: string,
  currency: CurrencyCode,
  gbpToCurrencyRate: number,
  selectedLabel?: SelectedLabelAsset
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm" });
  const state = { y: 16 };
  const fmt = (gbp: number) => formatPdfCurrency(gbp, currency, gbpToCurrencyRate);

  drawPoHeader(doc, state, poReference);

  doc.setFontSize(12);
  doc.text(`Finished product: ${productName}`, 14, state.y);
  state.y += 6;
  doc.text(`Units: ${units}`, 14, state.y);
  state.y += 6;
  doc.text(`Units per pack: ${unitsPerPack}`, 14, state.y);
  state.y += 6;
  doc.text(`Packs: ${totals.packs}`, 14, state.y);
  state.y += 10;

  const packagingBody = packagingRows.map((row) => [
    row.item,
    String(Number(row.quantity.toFixed(2))),
    fmt(row.costGbp),
    fmt(row.costPerSetGbp),
    fmt(row.totalGbp),
  ]);
  packagingBody.push([
    "Total",
    "",
    "",
    fmt(totals.packagingCostPerUnit),
    fmt(totals.packagingTotalCost),
  ]);

  autoTable(doc, {
    startY: state.y,
    head: [["Packaging item", "Quantity", "Cost", "Cost/Unit", "Total Cost"]],
    body: packagingBody,
    styles: { fontSize: 8 },
    margin: { left: 14 },
    tableWidth: "auto",
  });
  state.y = tableEndY(doc, state.y) + 10;

  drawSummaryBlock(doc, state, "Product", [
    ["Cost per pack", fmt(totals.baseUnitCost)],
    ["Product total cost", fmt(totals.productTotalCost)],
  ]);

  drawSummaryBlock(doc, state, "Packaging", [
    ["Total cost", fmt(totals.packagingTotalCost)],
    ["Cost per unit", fmt(totals.packagingCostPerUnit)],
    ["Cost per pack", fmt(totals.packagingCostPerPack)],
  ]);

  drawSummaryBlock(doc, state, "Final Product", [
    ["Total cost", fmt(totals.finalTotalCost)],
    ["Cost per unit", fmt(totals.finalCostPerUnit)],
    ["Cost per pack", fmt(totals.finalCostPerPack)],
  ]);

  const fileName = `${poReference}-${safeFileNameSegment(productName)}-${units}units.pdf`;
  await saveOrAppendLabel(doc, fileName, selectedLabel);
}
