import type { PackagingLineInput, PackagingRow } from "@/components/packaging/types";

export type RecipePackagingTotals = {
  rows: PackagingRow[];
  grandTotal: number;
  costPerKg: number;
  costPerUnit: number;
};

export type FinishedProductPackagingTotals = {
  rows: PackagingRow[];
  grandTotal: number;
  costPerUnit: number;
  costPerPack: number;
};

export function calculateRecipePackaging(
  lines: PackagingLineInput[],
  batchGrams: number,
  units: number
): RecipePackagingTotals {
  const batchKg = batchGrams / 1000;
  const rows = lines.map((line) => {
    const effectiveCostGbp =
      line.code === "SACH100G" ? (batchKg >= 100 ? 0.1 : 0.2) : line.costGbp;
    let quantity = 0;
    if (line.code === "SACH100G") {
      quantity = batchKg / 0.1;
    } else if (line.code === "PAIL" || line.code === "PAILLAB") {
      quantity = batchKg / 10;
    } else if (line.basis === "per_kg") quantity = batchKg;
    else if (line.basis === "per_set") quantity = units;
    else {
      const unitsPerSet = line.unitsPerPack && line.unitsPerPack > 0 ? line.unitsPerPack : 1;
      quantity = units * unitsPerSet;
    }
    const multiplier = line.quantityMultiplier && line.quantityMultiplier > 0 ? line.quantityMultiplier : 1;
    quantity *= multiplier;
    const total = quantity * effectiveCostGbp;
    const costPerSet = units > 0 ? total / units : 0;
    return {
      ...line,
      effectiveCostGbp,
      quantity,
      total,
      costPerSet,
      costPerUnit: costPerSet,
      costPerPack: 0,
    };
  });
  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);
  return {
    rows,
    grandTotal,
    costPerKg: batchGrams > 0 ? grandTotal / (batchGrams / 1000) : 0,
    costPerUnit: units > 0 ? grandTotal / units : 0,
  };
}

export function calculateFinishedProductPackaging(
  lines: PackagingLineInput[],
  units: number,
  unitsPerPack: number
): FinishedProductPackagingTotals {
  const packs = unitsPerPack > 0 ? Math.ceil(units / unitsPerPack) : 0;
  const rows = lines.map((line) => {
    const multiplier = line.quantityMultiplier && line.quantityMultiplier > 0 ? line.quantityMultiplier : 1;
    const baseQuantity = line.basis === "per_pack" ? packs : units;
    const quantity = baseQuantity * multiplier;
    const total = quantity * line.costGbp;
    return {
      ...line,
      effectiveCostGbp: line.costGbp,
      quantity,
      total,
      costPerSet: units > 0 ? total / units : 0,
      costPerUnit: units > 0 ? total / units : 0,
      costPerPack: packs > 0 ? total / packs : 0,
    };
  });
  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);
  return {
    rows,
    grandTotal,
    costPerUnit: units > 0 ? grandTotal / units : 0,
    costPerPack: packs > 0 ? grandTotal / packs : 0,
  };
}
