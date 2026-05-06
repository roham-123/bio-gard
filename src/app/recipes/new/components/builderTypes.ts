import type { RecipeWithLines } from "@/lib/db";

export type FillerMode = "fixed" | "ratio" | "remainder";

export type BuilderLine = {
  uid: string;
  ingredientId: string | null;
  ingredientName: string;
  isBacteria: boolean;
  stockCfuPerG: number;
  costPerKgGbp: number;
  fillerMode: FillerMode;
  fillerRatio: string;
  targetTotalCfu: string;
  defaultGrams: string;
  showNewIngredient: boolean;
  newIngId: string;
  newIngName: string;
  newIngStockCfu: string;
  newIngCostPerKg: string;
};

function makeUid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyBuilderLine(): BuilderLine {
  return {
    uid: makeUid(),
    ingredientId: null,
    ingredientName: "",
    isBacteria: false,
    stockCfuPerG: 0,
    costPerKgGbp: 0,
    fillerMode: "fixed",
    fillerRatio: "",
    targetTotalCfu: "",
    defaultGrams: "",
    showNewIngredient: false,
    newIngId: "",
    newIngName: "",
    newIngStockCfu: "",
    newIngCostPerKg: "",
  };
}

export function builderLineFromRecipe(rl: RecipeWithLines["lines"][number]): BuilderLine {
  const isBacteria = rl.ingredient.stock_cfu_per_g > 0;
  return {
    uid: makeUid(),
    ingredientId: rl.ingredient.id,
    ingredientName: rl.ingredient.name,
    isBacteria,
    stockCfuPerG: rl.ingredient.stock_cfu_per_g,
    costPerKgGbp: rl.ingredient.cost_per_kg_gbp,
    fillerMode: rl.filler_mode,
    fillerRatio: rl.filler_ratio ? String(rl.filler_ratio) : "",
    targetTotalCfu: rl.target_total_cfu ? rl.target_total_cfu.toExponential() : "",
    defaultGrams: rl.default_grams ? String(rl.default_grams) : "",
    showNewIngredient: false,
    newIngId: "",
    newIngName: "",
    newIngStockCfu: "",
    newIngCostPerKg: "",
  };
}
