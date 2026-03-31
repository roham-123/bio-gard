import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { LineResult } from "./calc";
import { formatGrams, formatKg, formatCfu, formatPercent, formatCurrency } from "./format";

export function generateRecipePdf(
  recipeName: string,
  batchGrams: number,
  units: number,
  results: LineResult[],
  totals: { totalGrams: number; totalCfu: number; totalCost: number; costPerKg: number; costPerUnit?: number }
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm" });
  let y = 16;

  doc.setFontSize(16);
  doc.text("Purchase Order", 14, y);
  y += 10;

  doc.setFontSize(12);
  doc.text(`Formula: ${recipeName}`, 14, y);
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

  doc.setFontSize(10);
  doc.text(`Total final CFU/g: ${formatCfu(totals.totalCfu)}`, 14, y);
  y += 6;
  doc.text(`Total cost: ${formatCurrency(totals.totalCost)}`, 14, y);
  y += 6;
  doc.text(`Cost per kg: ${formatCurrency(totals.costPerKg)}`, 14, y);
  if (totals.costPerUnit != null) {
    y += 6;
    doc.text(`Cost per set: ${formatCurrency(totals.costPerUnit)}`, 14, y);
  }

  doc.save(`formula-${recipeName.replace(/[^a-z0-9]/gi, "-")}-${batchGrams}g.pdf`);
}
