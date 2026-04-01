import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { LineResult } from "./calc";
import { formatGrams, formatKg, formatCfu, formatPercent, formatCurrency } from "./format";

export type PackagingPdfRow = {
  item: string;
  quantity: number;
  costGbp: number;
  costPerSetGbp: number;
  totalGbp: number;
};

export function generateRecipePdf(
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
  }
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm" });
  let y = 16;

  doc.setFontSize(16);
  doc.text("Purchase Order", 14, y);
  y += 10;

  doc.setFontSize(12);
  doc.text(`Microbial Formula: ${recipeName}`, 14, y);
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
  doc.text("Packaging", 14, y);
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

  drawSummaryBlock("Microbial Formula", [
    ["Total final CFU/g", formatCfu(totals.totalCfu)],
    ["Total cost", formatCurrency(totals.formulaTotalCost)],
    ["Cost per kg", formatCurrency(totals.formulaCostPerKg)],
    ["Cost per set", totals.formulaCostPerSet != null ? formatCurrency(totals.formulaCostPerSet) : "—"],
  ]);

  drawSummaryBlock("Packaging", [
    ["Total cost", formatCurrency(totals.packagingTotalCost)],
    ["Cost per set", totals.packagingCostPerSet != null ? formatCurrency(totals.packagingCostPerSet) : "—"],
  ]);

  drawSummaryBlock("Final Product", [
    ["Total cost", formatCurrency(totals.finalTotalCost)],
    ["Cost per kg", formatCurrency(totals.finalCostPerKg)],
    ["Cost per set", totals.finalCostPerSet != null ? formatCurrency(totals.finalCostPerSet) : "—"],
  ]);

  doc.save(`formula-microbial-${recipeName.replace(/[^a-z0-9]/gi, "-")}-${batchGrams}g.pdf`);
}
