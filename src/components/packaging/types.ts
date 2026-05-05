import type { FinishedProductWithPackagingLines, RecipeWithLines } from "@/lib/db";

export type FormulaPackagingBasis = "per_set" | "per_kg" | "per_unit";
export type FinishedProductPackagingBasis = "per_unit" | "per_pack";
export type PackagingBasis = FormulaPackagingBasis | FinishedProductPackagingBasis;

export type PackagingLineInput = {
  id: string;
  code: string;
  item: string;
  basis: PackagingBasis;
  costGbp: number;
  unitsPerPack?: number;
  quantitySource?: "sets" | "kg" | "units" | "packs";
  quantityMultiplier?: number;
};

export type PackagingRow = PackagingLineInput & {
  effectiveCostGbp: number;
  quantity: number;
  total: number;
  costPerSet: number;
  costPerUnit: number;
  costPerPack: number;
};

export function recipeToPackagingInputs(recipe: RecipeWithLines): PackagingLineInput[] {
  return (recipe.packaging_lines ?? []).map((line) => ({
    id: String(line.id),
    code: line.packaging_item_code,
    item: line.packaging_item_name,
    basis: line.usage_basis,
    costGbp: Number(line.cost_gbp),
    unitsPerPack: line.units_per_pack ?? undefined,
    quantitySource: line.quantity_source,
    quantityMultiplier: Number(line.quantity_multiplier),
  }));
}

export function finishedProductToPackagingInputs(
  product: FinishedProductWithPackagingLines
): PackagingLineInput[] {
  return (product.packaging_lines ?? []).map((line) => ({
    id: String(line.id),
    code: line.packaging_item_code,
    item: line.packaging_item_name,
    basis: line.usage_basis,
    costGbp: Number(line.cost_gbp),
    unitsPerPack: line.units_per_pack ?? undefined,
    quantitySource: line.usage_basis === "per_pack" ? "packs" : "units",
    quantityMultiplier: Number(line.quantity_multiplier),
  }));
}
