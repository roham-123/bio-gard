import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PDFDocument } from "pdf-lib";
import type { LineResult } from "./calc";
import { formatGrams, formatKg, formatCfu, formatPercent, formatCurrency } from "./format";

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

async function appendLabelPages(basePdfBuffer: ArrayBuffer, label: SelectedLabelAsset): Promise<Uint8Array> {
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

  if (label.mimeType === "image/jpeg") {
    const jpg = await doc.embedJpg(labelBuffer);
    const frame = fitImageInA4(jpg.width, jpg.height);
    const page = doc.addPage([frame.pageWidth, frame.pageHeight]);
    page.drawImage(jpg, { x: frame.x, y: frame.y, width: frame.width, height: frame.height });
    return doc.save();
  }

  const png = await doc.embedPng(labelBuffer);
  const frame = fitImageInA4(png.width, png.height);
  const page = doc.addPage([frame.pageWidth, frame.pageHeight]);
  page.drawImage(png, { x: frame.x, y: frame.y, width: frame.width, height: frame.height });
  return doc.save();
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
  selectedLabel?: SelectedLabelAsset
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm" });
  let y = 16;

  doc.setFontSize(16);
  doc.text("Purchase Order", 14, y);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(poReference, 196, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 10;

  doc.setFontSize(12);
  doc.text(`Material: ${recipeName}`, 14, y);
  y += 6;
  doc.text(`Batch size: ${formatGrams(batchGrams)} g (${formatKg(batchGrams / 1000)} kg)`, 14, y);
  y += 6;
  const kgPerUnit = units > 0 ? batchGrams / 1000 / units : 0;
  doc.text(
    `kg per set: ${kgPerUnit > 0 ? `${formatKg(kgPerUnit)} kg` : "—"}`,
    14,
    y
  );
  y += 6;
  doc.text(`Sets: ${units}`, 14, y);
  y += 10;

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
    formatCurrency(r.costPerKgGbp),
    formatCurrency(r.costInProduct),
  ]);

  autoTable(doc, {
    startY: y,
    head: [headers],
    body: rows,
    styles: { fontSize: 7 },
    margin: { left: 14 },
    tableWidth: "auto",
  });

  const tableEndY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  y = tableEndY + 10;

  doc.setFontSize(11);
  doc.text("Service", 14, y);
  y += 4;

  const packagingHeaders = ["Item", "Quantity", "Cost", "Cost/Set", "Total Cost"];
  const packagingBody = packagingRows.map((row) => [
    row.item,
    String(Number(row.quantity.toFixed(2))),
    formatCurrency(row.costGbp),
    units > 0 ? formatCurrency(row.costPerSetGbp) : "—",
    formatCurrency(row.totalGbp),
  ]);
  packagingBody.push([
    "Total",
    "",
    "",
    units > 0 ? formatCurrency(totals.packagingCostPerSet ?? 0) : "—",
    formatCurrency(totals.packagingTotalCost),
  ]);

  autoTable(doc, {
    startY: y,
    head: [packagingHeaders],
    body: packagingBody,
    styles: { fontSize: 8 },
    margin: { left: 14 },
    tableWidth: "auto",
  });

  const packagingEndY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  y = packagingEndY + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Summary", 14, y);
  y += 8;
  doc.setFont("helvetica", "normal");

  const drawSummaryBlock = (title: string, rowsData: string[][]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title, 14, y);
    y += 2;
    doc.setFont("helvetica", "normal");
    autoTable(doc, {
      startY: y,
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
    y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 6;
  };

  drawSummaryBlock("Material", [
    ["Total final CFU/g", formatCfu(totals.totalCfu)],
    ["Total cost", formatCurrency(totals.formulaTotalCost)],
    ["Cost per kg", formatCurrency(totals.formulaCostPerKg)],
    ["Cost per set", totals.formulaCostPerSet != null ? formatCurrency(totals.formulaCostPerSet) : "—"],
  ]);

  drawSummaryBlock("Service", [
    ["Total cost", formatCurrency(totals.packagingTotalCost)],
    ["Cost per set", totals.packagingCostPerSet != null ? formatCurrency(totals.packagingCostPerSet) : "—"],
  ]);

  drawSummaryBlock("Final Product", [
    ["Total cost", formatCurrency(totals.finalTotalCost)],
    ["Cost per kg", formatCurrency(totals.finalCostPerKg)],
    ["Cost per set", totals.finalCostPerSet != null ? formatCurrency(totals.finalCostPerSet) : "—"],
  ]);

  const fileName = `${poReference}-${recipeName.replace(/[^a-z0-9]/gi, "-")}-${batchGrams}g.pdf`;
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
