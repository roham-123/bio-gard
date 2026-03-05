import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { LineResult } from "./calc";
import { formatNumber, formatCfu, formatPercent, formatCurrency } from "./format";

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
  doc.text("Bio Gard Recipe Calculator", 14, y);
  y += 10;

  doc.setFontSize(12);
  doc.text(`Recipe: ${recipeName}`, 14, y);
  y += 6;
  doc.text(`Batch size: ${formatNumber(batchGrams, { maxDecimals: 2 })} g (${formatNumber(batchGrams / 1000, { maxDecimals: 2 })} kg)`, 14, y);
  y += 6;
  doc.text(`Units: ${units}`, 14, y);
  y += 10;

  const headers = [
    "Ingredient",
    "g",
    "kg",
    "g per unit",
    "%",
    "Stock CFU/g",
    "Target CFU",
    "Total CFU",
    "Final CFU/g",
    "Cost/kg",
    "Cost",
  ];
  const rows = results.map((r) => [
    (r.ingredientCode ? `[${r.ingredientCode}] ` : "") + r.ingredientName,
    formatNumber(r.grams, { maxDecimals: 2 }),
    formatNumber(r.grams / 1000, { maxDecimals: 4 }),
    units > 0 ? formatNumber(r.grams / units, { maxDecimals: 2 }) : "—",
    formatPercent(r.percent),
    r.isBacteria ? formatCfu(r.cfuPerGram) : "—",
    r.isBacteria ? formatCfu(r.targetTotalCfu) : "—",
    r.isBacteria ? formatCfu(r.totalCfu) : "—",
    r.isBacteria ? formatCfu(r.finalCfuPerGram) : "—",
    formatCurrency(r.costPerKgGbp),
    formatCurrency(r.costInProduct),
  ]);

  autoTable(doc, {
    startY: y,
    head: [headers],
    body: rows,
    styles: { fontSize: 8 },
    margin: { left: 14 },
    tableWidth: "auto",
  });

  const tableEndY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  y = tableEndY + 10;

  doc.setFontSize(10);
  doc.text(`Total grams: ${formatNumber(totals.totalGrams, { maxDecimals: 2 })} g`, 14, y);
  y += 6;
  doc.text(`Total CFU: ${formatCfu(totals.totalCfu)}`, 14, y);
  y += 6;
  doc.text(`Total cost: ${formatCurrency(totals.totalCost)}`, 14, y);
  y += 6;
  doc.text(`Cost per kg: ${formatCurrency(totals.costPerKg)}`, 14, y);
  if (totals.costPerUnit != null) {
    y += 6;
    doc.text(`Cost per unit: ${formatCurrency(totals.costPerUnit)}`, 14, y);
  }

  doc.save(`recipe-${recipeName.replace(/[^a-z0-9]/gi, "-")}-${batchGrams}g.pdf`);
}
