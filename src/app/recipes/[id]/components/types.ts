import type { RecipeWithLines } from "@/lib/db";

export type PackagingBasis = "per_set" | "per_kg" | "per_unit";

export type PackagingLineInput = {
  id: string;
  code: string;
  item: string;
  basis: PackagingBasis;
  costGbp: number;
  unitsPerPack?: number;
  quantitySource?: "sets" | "kg";
  quantityMultiplier?: number;
};

export type PackagingRow = PackagingLineInput & {
  effectiveCostGbp: number;
  quantity: number;
  total: number;
  costPerSet: number;
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
