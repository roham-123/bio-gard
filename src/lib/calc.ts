import type { RecipeWithLines } from "./db";

export type FillerMode = "fixed" | "ratio" | "remainder";

export type LineInput = {
  lineId: number;
  ingredientId: string;
  ingredientName: string;
  isBacteria: boolean;
  stockCfuPerG: number;
  costPerKgGbp: number;
  targetTotalCfu: number;
  defaultGrams: number;
  fillerMode: FillerMode;
  fillerRatio: number;
  sortOrder: number;
};

export type LineResult = {
  lineId: number;
  sortOrder: number;
  ingredientId: string;
  ingredientName: string;
  isBacteria: boolean;
  stockCfuPerG: number;
  costPerKgGbp: number;
  targetTotalCfu: number;
  grams: number;
  percent: number;
  designPercent: number;
  totalCfu: number;
  finalCfuPerGram: number;
  costInProduct: number;
  fillerMode: FillerMode;
  fillerRatio: number;
  warning?: string;
  overflow?: boolean;
};

export type CalcOutput = {
  results: LineResult[];
  totalGrams: number;
  totalCfu: number;
  totalCost: number;
  costPerKg: number;
  formulaValid: boolean;
  error?: string;
};

export function calculate(
  totalBatchGrams: number,
  defaultBatchGrams: number,
  lines: LineInput[]
): CalcOutput {
  const scale = defaultBatchGrams > 0 ? totalBatchGrams / defaultBatchGrams : 1;

  const results: LineResult[] = [];
  const bacteriaResults: LineResult[] = [];
  const fixedGrams: number[] = [];
  const ratioLines: LineInput[] = [];
  let remainderLine: LineInput | null = null;
  const zeroCfuNames: string[] = [];

  for (const line of lines) {
    if (line.isBacteria) {
      const cfuPerG = line.stockCfuPerG;
      const scaledTargetTotalCfu = line.targetTotalCfu * scale;
      let grams = 0;
      let warning: string | undefined;
      if (cfuPerG <= 0) {
        warning = "Stock CFU/g is zero — cannot calculate grams.";
        zeroCfuNames.push(line.ingredientName);
      } else {
        grams = scaledTargetTotalCfu / cfuPerG;
      }
      const totalCfu = scaledTargetTotalCfu;
      const finalCfuPerGram = totalBatchGrams > 0 ? totalCfu / totalBatchGrams : 0;
      const costInProduct = (line.costPerKgGbp * grams) / 1000;
      const percent = totalBatchGrams > 0 ? grams / totalBatchGrams : 0;
      const designPercent = defaultBatchGrams > 0 ? line.defaultGrams / defaultBatchGrams : 0;
      const res: LineResult = {
        lineId: line.lineId,
        sortOrder: line.sortOrder,
        ingredientId: line.ingredientId,
        ingredientName: line.ingredientName,
        isBacteria: true,
        stockCfuPerG: cfuPerG,
        costPerKgGbp: line.costPerKgGbp,
        targetTotalCfu: scaledTargetTotalCfu,
        grams,
        percent,
        designPercent,
        totalCfu,
        finalCfuPerGram,
        costInProduct,
        fillerMode: line.fillerMode,
        fillerRatio: line.fillerRatio,
        warning,
      };
      results.push(res);
      bacteriaResults.push(res);
    } else {
      if (line.fillerMode === "fixed") {
        const grams = line.defaultGrams * scale;
        fixedGrams.push(grams);
        const percent = totalBatchGrams > 0 ? grams / totalBatchGrams : 0;
        const designPercent = defaultBatchGrams > 0 ? line.defaultGrams / defaultBatchGrams : 0;
        const costInProduct = (line.costPerKgGbp * grams) / 1000;
        results.push({
          lineId: line.lineId,
          sortOrder: line.sortOrder,
          ingredientId: line.ingredientId,
          ingredientName: line.ingredientName,
          isBacteria: false,
          stockCfuPerG: 0,
          costPerKgGbp: line.costPerKgGbp,
          targetTotalCfu: 0,
          grams,
          percent,
          designPercent,
          totalCfu: 0,
          finalCfuPerGram: 0,
          costInProduct,
          fillerMode: line.fillerMode,
          fillerRatio: line.fillerRatio,
        });
      } else if (line.fillerMode === "ratio") {
        ratioLines.push(line);
      } else {
        remainderLine = line;
      }
    }
  }

  const sumBacteria = bacteriaResults.reduce((s, r) => s + r.grams, 0);
  const sumFixed = fixedGrams.reduce((a, b) => a + b, 0);
  const remaining = totalBatchGrams - sumBacteria - sumFixed;
  const hasZeroCfu = zeroCfuNames.length > 0;
  const batchOverflow = remaining < 0;

  if (batchOverflow) {
    for (const br of bacteriaResults) {
      if (br.grams > 0) br.overflow = true;
    }
  }

  const effectiveRemaining = batchOverflow ? 0 : remaining;
  const sumRatioRatios = ratioLines.reduce((s, l) => s + l.fillerRatio, 0);
  const ratioDenom = sumRatioRatios > 0 ? sumRatioRatios : 1;

  let ratioGramsSum = 0;
  for (const line of ratioLines) {
    const grams = effectiveRemaining * (line.fillerRatio / ratioDenom);
    ratioGramsSum += grams;
    const percent = totalBatchGrams > 0 ? grams / totalBatchGrams : 0;
    const designPercent = defaultBatchGrams > 0 ? line.defaultGrams / defaultBatchGrams : 0;
    const costInProduct = (line.costPerKgGbp * grams) / 1000;
    results.push({
      lineId: line.lineId,
      sortOrder: line.sortOrder,
      ingredientId: line.ingredientId,
      ingredientName: line.ingredientName,
      isBacteria: false,
      stockCfuPerG: 0,
      costPerKgGbp: line.costPerKgGbp,
      targetTotalCfu: 0,
      grams,
      percent,
      designPercent,
      totalCfu: 0,
      finalCfuPerGram: 0,
      costInProduct,
      fillerMode: line.fillerMode,
      fillerRatio: line.fillerRatio,
      warning: batchOverflow ? "Filler cannot be allocated — batch overflow" : undefined,
    });
  }

  const remainderGrams = effectiveRemaining - ratioGramsSum;
  if (remainderLine) {
    const percent = totalBatchGrams > 0 ? remainderGrams / totalBatchGrams : 0;
    const designPercent = defaultBatchGrams > 0 ? remainderLine.defaultGrams / defaultBatchGrams : 0;
    const costInProduct = (remainderLine.costPerKgGbp * remainderGrams) / 1000;
    results.push({
      lineId: remainderLine.lineId,
      sortOrder: remainderLine.sortOrder,
      ingredientId: remainderLine.ingredientId,
      ingredientName: remainderLine.ingredientName,
      isBacteria: false,
      stockCfuPerG: 0,
      costPerKgGbp: remainderLine.costPerKgGbp,
      targetTotalCfu: 0,
      grams: remainderGrams,
      percent,
      designPercent,
      totalCfu: 0,
      finalCfuPerGram: 0,
      costInProduct,
      fillerMode: remainderLine.fillerMode,
      fillerRatio: remainderLine.fillerRatio,
      warning: batchOverflow ? "Filler cannot be allocated — batch overflow" : undefined,
    });
  }

  results.sort((a, b) => a.sortOrder - b.sortOrder);

  const totalGrams = results.reduce((s, r) => s + r.grams, 0);
  const totalCfu = results.reduce((s, r) => s + r.totalCfu, 0);
  const totalCost = results.reduce((s, r) => s + r.costInProduct, 0);
  const formulaValid = !batchOverflow && !hasZeroCfu;
  const costPerKg = formulaValid && totalBatchGrams > 0 ? totalCost / (totalBatchGrams / 1000) : 0;

  let error: string | undefined;
  if (batchOverflow) {
    const needed = sumBacteria + sumFixed;
    const excess = needed - totalBatchGrams;
    error = `Bacteria + fixed fillers require ${fmtG(needed)} but batch size is only ${fmtG(totalBatchGrams)}. Formula exceeds batch by ${fmtG(excess)}. Increase batch size or choose a different ingredient.`;
  }
  if (hasZeroCfu) {
    const zeroMsg = `Stock CFU/g is zero for: ${zeroCfuNames.join(", ")}. Cannot calculate.`;
    error = error ? `${error}\n${zeroMsg}` : zeroMsg;
  }

  return { results, totalGrams, totalCfu, totalCost, costPerKg, formulaValid, error };
}

function fmtG(grams: number): string {
  return `${Math.round(grams).toLocaleString("en-GB")} g`;
}

export function recipeToLineInputs(recipe: RecipeWithLines): LineInput[] {
  return recipe.lines.map((l) => ({
    lineId: l.id,
    ingredientId: l.ingredient.id,
    ingredientName: l.ingredient.name,
    isBacteria: l.ingredient.stock_cfu_per_g > 0,
    stockCfuPerG: l.ingredient.stock_cfu_per_g,
    costPerKgGbp: l.ingredient.cost_per_kg_gbp,
    targetTotalCfu: l.target_total_cfu,
    defaultGrams: l.default_grams,
    fillerMode: l.filler_mode,
    fillerRatio: Number(l.filler_ratio),
    sortOrder: l.sort_order,
  }));
}
