import type { RecipeWithLines } from "./db";

export type FillerMode = "fixed" | "ratio" | "remainder";

export type LineInput = {
  lineId: number;
  ingredientId: number;
  ingredientName: string;
  ingredientCode: string | null;
  isBacteria: boolean;
  costPerKgGbp: number;
  targetTotalCfu: number;
  defaultGrams: number;
  fillerMode: FillerMode;
  fillerRatio: number;
  sortOrder: number;
  /** Selected CFU option id (for bacteria); undefined = use default option */
  selectedCfuOptionId?: number;
  /** Recipe-line-level default CFU option id (overrides ingredient-wide default) */
  defaultCfuOptionId?: number | null;
  cfuOptions: { id: number; label: string; cfu_per_gram: number; is_default: boolean; price_gbp: number | null }[];
};

export type LineResult = {
  lineId: number;
  sortOrder: number;
  ingredientId: number;
  ingredientName: string;
  ingredientCode: string | null;
  isBacteria: boolean;
  costPerKgGbp: number;
  targetTotalCfu: number;
  grams: number;
  percent: number;
  cfuPerGram: number; // selected (for bacteria) or 0
  totalCfu: number;
  finalCfuPerGram: number; // totalCfu / totalBatchGrams
  costInProduct: number;
  fillerMode: FillerMode;
  fillerRatio: number;
  warning?: string;
  /** true when this bacteria line contributes to a batch overflow */
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

export function getDefaultCfuOption(
  options: LineInput["cfuOptions"],
  preferredId?: number | null
): { id: number; cfu_per_gram: number } | undefined {
  if (preferredId != null) {
    const p = options.find((o) => o.id === preferredId);
    if (p) return { id: p.id, cfu_per_gram: p.cfu_per_gram };
  }
  const d = options.find((o) => o.is_default);
  if (d) return { id: d.id, cfu_per_gram: d.cfu_per_gram };
  return options[0] ? { id: options[0].id, cfu_per_gram: options[0].cfu_per_gram } : undefined;
}

export function calculate(
  totalBatchGrams: number,
  defaultBatchGrams: number,
  lines: LineInput[],
  selectedCfuByLineId: Map<number, number>
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
      const optId = selectedCfuByLineId.get(line.lineId) ?? getDefaultCfuOption(line.cfuOptions)?.id;
      const opt =
        line.cfuOptions.find((o) => o.id === optId) ??
        getDefaultCfuOption(line.cfuOptions, line.defaultCfuOptionId);
      const cfuPerG = opt ? opt.cfu_per_gram : 0;
      const scaledTargetTotalCfu = line.targetTotalCfu * scale;
      let grams = 0;
      let warning: string | undefined;
      if (cfuPerG <= 0) {
        warning = "Stock CFU/g is zero — cannot calculate grams. Select a valid stock option.";
        zeroCfuNames.push(line.ingredientName);
      } else {
        grams = scaledTargetTotalCfu / cfuPerG;
      }
      const totalCfu = scaledTargetTotalCfu;
      const finalCfuPerGram = totalBatchGrams > 0 ? totalCfu / totalBatchGrams : 0;
      const costInProduct = (line.costPerKgGbp * grams) / 1000;
      const percent = totalBatchGrams > 0 ? grams / totalBatchGrams : 0;
      const res: LineResult = {
        lineId: line.lineId,
        sortOrder: line.sortOrder,
        ingredientId: line.ingredientId,
        ingredientName: line.ingredientName,
        ingredientCode: line.ingredientCode,
        isBacteria: true,
        costPerKgGbp: line.costPerKgGbp,
        targetTotalCfu: scaledTargetTotalCfu,
        grams,
        percent,
        cfuPerGram: cfuPerG,
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
        const costInProduct = (line.costPerKgGbp * grams) / 1000;
        results.push({
          lineId: line.lineId,
          sortOrder: line.sortOrder,
          ingredientId: line.ingredientId,
          ingredientName: line.ingredientName,
          ingredientCode: line.ingredientCode,
          isBacteria: false,
          costPerKgGbp: line.costPerKgGbp,
          targetTotalCfu: 0,
          grams,
          percent,
          cfuPerGram: 0,
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

  // Even when the formula is invalid, push ratio/remainder rows (at 0g if overflow)
  // so the UI can display them dimmed rather than hiding them entirely.
  const effectiveRemaining = batchOverflow ? 0 : remaining;
  const sumRatioRatios = ratioLines.reduce((s, l) => s + l.fillerRatio, 0);
  const ratioDenom = sumRatioRatios > 0 ? sumRatioRatios : 1;

  let ratioGramsSum = 0;
  for (const line of ratioLines) {
    const grams = effectiveRemaining * (line.fillerRatio / ratioDenom);
    ratioGramsSum += grams;
    const percent = totalBatchGrams > 0 ? grams / totalBatchGrams : 0;
    const costInProduct = (line.costPerKgGbp * grams) / 1000;
    results.push({
      lineId: line.lineId,
      sortOrder: line.sortOrder,
      ingredientId: line.ingredientId,
      ingredientName: line.ingredientName,
      ingredientCode: line.ingredientCode,
      isBacteria: false,
      costPerKgGbp: line.costPerKgGbp,
      targetTotalCfu: 0,
      grams,
      percent,
      cfuPerGram: 0,
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
    const costInProduct = (remainderLine.costPerKgGbp * remainderGrams) / 1000;
    results.push({
      lineId: remainderLine.lineId,
      sortOrder: remainderLine.sortOrder,
      ingredientId: remainderLine.ingredientId,
      ingredientName: remainderLine.ingredientName,
      ingredientCode: remainderLine.ingredientCode,
      isBacteria: false,
      costPerKgGbp: remainderLine.costPerKgGbp,
      targetTotalCfu: 0,
      grams: remainderGrams,
      percent,
      cfuPerGram: 0,
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
    error = `Bacteria + fixed fillers require ${fmtG(needed)} but batch size is only ${fmtG(totalBatchGrams)}. Formula exceeds batch by ${fmtG(excess)}. Increase batch size or choose stronger stock.`;
  }
  if (hasZeroCfu) {
    const zeroMsg = `Stock CFU/g is zero for: ${zeroCfuNames.join(", ")}. Cannot calculate until a valid stock is selected.`;
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
    ingredientCode: l.ingredient.code,
    isBacteria: l.ingredient.is_bacteria,
    costPerKgGbp: l.cost_per_kg_gbp,
    targetTotalCfu: l.target_total_cfu,
    defaultGrams: l.default_grams,
    fillerMode: l.filler_mode,
    fillerRatio: Number(l.filler_ratio),
    sortOrder: l.sort_order,
    defaultCfuOptionId: l.default_cfu_option_id ?? undefined,
    cfuOptions: l.cfu_options.map((o) => ({
      id: o.id,
      label: o.label,
      cfu_per_gram: o.cfu_per_gram,
      is_default: o.is_default,
      price_gbp: o.price_gbp ?? null,
    })),
  }));
}
