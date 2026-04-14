"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Ingredient, RecipeWithLines } from "@/lib/db";
import { parseScientific, formatCfu } from "@/lib/format";
import { calculate, type LineInput } from "@/lib/calc";
import {
  createRecipeAction,
  updateRecipeAction,
  createIngredientAction,
  updateIngredientCostPerKgAction,
} from "@/app/actions";

type FillerMode = "fixed" | "ratio" | "remainder";

type BuilderLine = {
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

function emptyLine(): BuilderLine {
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

function lineFromRecipeLine(
  rl: RecipeWithLines["lines"][number]
): BuilderLine {
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

type Props = {
  ingredients: Ingredient[];
  existingRecipe?: RecipeWithLines;
};

export default function RecipeBuilder({ ingredients: initialIngredients, existingRecipe }: Props) {
  const router = useRouter();
  const isEditMode = !!existingRecipe;

  const [recipeName, setRecipeName] = useState(existingRecipe?.name ?? "");
  const [batchSizeKg, setBatchSizeKg] = useState(
    existingRecipe ? String(existingRecipe.default_batch_grams / 1000) : ""
  );
  const [defaultKgPerSet, setDefaultKgPerSet] = useState(
    existingRecipe ? String(existingRecipe.default_kg_per_set) : "1"
  );
  const [lines, setLines] = useState<BuilderLine[]>(
    existingRecipe && existingRecipe.lines.length > 0
      ? existingRecipe.lines.map(lineFromRecipeLine)
      : [emptyLine()]
  );
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [costDraftByLineUid, setCostDraftByLineUid] = useState<Record<string, string>>({});
  const previewBatchKg = parseScientific(batchSizeKg);
  const previewBatchGrams = !Number.isNaN(previewBatchKg) && previewBatchKg > 0 ? previewBatchKg * 1000 : 0;

  const previewLineInputs = useMemo<LineInput[]>(
    () =>
      lines
        .filter((line) => line.ingredientId != null)
        .map((line, idx) => {
          const targetCfu = parseScientific(line.targetTotalCfu) || 0;
          const defaultGrams = line.isBacteria
            ? line.stockCfuPerG > 0
              ? targetCfu / line.stockCfuPerG
              : 0
            : parseScientific(line.defaultGrams) || 0;
          return {
            lineId: idx + 1,
            ingredientId: line.ingredientId!,
            ingredientName: line.ingredientName,
            isBacteria: line.isBacteria,
            stockCfuPerG: line.stockCfuPerG,
            costPerKgGbp: line.costPerKgGbp,
            targetTotalCfu: targetCfu,
            defaultGrams,
            fillerMode: line.fillerMode,
            fillerRatio: line.fillerMode === "ratio" ? parseScientific(line.fillerRatio) || 0 : 0,
            sortOrder: idx + 1,
          };
        }),
    [lines]
  );

  const previewResult = useMemo(
    () =>
      previewBatchGrams > 0 && previewLineInputs.length > 0
        ? calculate(previewBatchGrams, previewBatchGrams, previewLineInputs)
        : null,
    [previewBatchGrams, previewLineInputs]
  );

  const previewResultByLineId = useMemo(() => {
    const map = new Map<number, ReturnType<typeof calculate>["results"][number]>();
    previewResult?.results.forEach((res) => map.set(res.lineId, res));
    return map;
  }, [previewResult]);

  const previewTotalFinalCfuPerGram = useMemo(
    () =>
      previewResult
        ? previewResult.results.reduce((sum, res) => sum + (res.isBacteria ? res.finalCfuPerGram : 0), 0)
        : 0,
    [previewResult]
  );

  function updateLine(lineUid: string, patch: Partial<BuilderLine>) {
    setLines((prev) => prev.map((l) => (l.uid === lineUid ? { ...l, ...patch } : l)));
  }

  function handleIngredientSelect(lineUid: string, value: string) {
    if (value === "__new__") {
      updateLine(lineUid, { showNewIngredient: true, ingredientId: null, ingredientName: "" });
      return;
    }
    const ing = ingredients.find((i) => i.id === value);
    if (!ing) return;
    const isBacteria = ing.stock_cfu_per_g > 0;
    updateLine(lineUid, {
      ingredientId: ing.id,
      ingredientName: ing.name,
      isBacteria,
      stockCfuPerG: ing.stock_cfu_per_g,
      costPerKgGbp: ing.cost_per_kg_gbp,
      fillerMode: isBacteria ? "fixed" : "fixed",
      showNewIngredient: false,
    });
  }

  async function handleCreateIngredient(line: BuilderLine) {
    const id = line.newIngId.trim();
    const name = line.newIngName.trim();
    if (!id) { setError("Ingredient ID is required."); return; }
    if (!name) { setError("Ingredient name is required."); return; }
    const stockCfu = parseScientific(line.newIngStockCfu) || 0;
    const costPerKg = parseScientific(line.newIngCostPerKg) || 0;
    try {
      const ing = await createIngredientAction(id, name, stockCfu, costPerKg);
      setIngredients((prev) => [...prev, ing].sort((a, b) => a.name.localeCompare(b.name)));
      const isBacteria = ing.stock_cfu_per_g > 0;
      updateLine(line.uid, {
        ingredientId: ing.id,
        ingredientName: ing.name,
        isBacteria,
        stockCfuPerG: ing.stock_cfu_per_g,
        costPerKgGbp: ing.cost_per_kg_gbp,
        fillerMode: isBacteria ? "fixed" : "fixed",
        showNewIngredient: false,
        newIngId: "",
        newIngName: "",
        newIngStockCfu: "",
        newIngCostPerKg: "",
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create ingredient");
    }
  }

  async function persistIngredientCost(ingredientId: string, rawValue: string) {
    const parsed = parseScientific(rawValue);
    if (Number.isNaN(parsed) || parsed < 0) {
      setError("Cost/kg must be a valid non-negative number.");
      return;
    }
    try {
      const updated = await updateIngredientCostPerKgAction(ingredientId, parsed);
      if (!updated) return;
      setIngredients((prev) =>
        prev.map((ing) => (ing.id === ingredientId ? { ...ing, cost_per_kg_gbp: parsed } : ing))
      );
      setLines((prev) =>
        prev.map((l) => (l.ingredientId === ingredientId ? { ...l, costPerKgGbp: parsed } : l))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update ingredient cost");
    }
  }

  function beginCostEdit(lineUid: string, currentValue: number) {
    setCostDraftByLineUid((prev) => ({ ...prev, [lineUid]: String(currentValue) }));
  }

  function setCostDraft(lineUid: string, rawValue: string) {
    setCostDraftByLineUid((prev) => ({ ...prev, [lineUid]: rawValue }));
  }

  async function commitCostEdit(line: BuilderLine) {
    const raw = costDraftByLineUid[line.uid] ?? String(line.costPerKgGbp);
    const parsed = parseScientific(raw);
    if (Number.isNaN(parsed) || parsed < 0) {
      setError("Cost/kg must be a valid non-negative number.");
      setCostDraftByLineUid((prev) => {
        const next = { ...prev };
        delete next[line.uid];
        return next;
      });
      return;
    }
    updateLine(line.uid, { costPerKgGbp: parsed });
    await persistIngredientCost(line.ingredientId!, raw);
    setCostDraftByLineUid((prev) => {
      const next = { ...prev };
      delete next[line.uid];
      return next;
    });
  }

  const addRow = useCallback(() => setLines((prev) => [...prev, emptyLine()]), []);
  const removeRow = useCallback(
    (uid: string) => setLines((prev) => prev.filter((l) => l.uid !== uid)),
    []
  );

  async function handleSave() {
    setError(null);
    const name = recipeName.trim();
    if (!name) { setError("Recipe name is required."); return; }
    const batchKg = parseScientific(batchSizeKg);
    if (Number.isNaN(batchKg) || batchKg <= 0) { setError("Default batch size must be a positive number."); return; }
    const batchGrams = batchKg * 1000;
    const kgPerSet = parseScientific(defaultKgPerSet);
    if (Number.isNaN(kgPerSet) || kgPerSet <= 0) { setError("Default kg per set must be a positive number."); return; }
    const validLines = lines.filter((l) => l.ingredientId != null);
    if (validLines.length === 0) { setError("Add at least one ingredient row."); return; }

    const lineInputs = validLines.map((l, idx) => {
      const targetCfu = parseScientific(l.targetTotalCfu) || 0;
      let defaultGrams = 0;
      if (l.isBacteria) {
        defaultGrams = l.stockCfuPerG > 0 ? targetCfu / l.stockCfuPerG : 0;
      } else {
        defaultGrams = parseScientific(l.defaultGrams) || 0;
      }
      return {
        ingredientId: l.ingredientId!,
        sortOrder: idx + 1,
        targetTotalCfu: targetCfu,
        defaultGrams,
        fillerMode: l.fillerMode as "fixed" | "ratio" | "remainder",
        fillerRatio: l.fillerMode === "ratio" ? parseScientific(l.fillerRatio) || 0 : 0,
      };
    });

    setSaving(true);
    try {
      if (isEditMode) {
        await updateRecipeAction(existingRecipe!.id, name, batchGrams, lineInputs, kgPerSet);
        router.push(`/recipes/${existingRecipe!.id}`);
      } else {
        const result = await createRecipeAction(name, batchGrams, lineInputs, kgPerSet);
        router.push(`/recipes/${result.id}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : isEditMode ? "Failed to update recipe" : "Failed to create recipe");
      setSaving(false);
    }
  }

  const inputCls =
    "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100";
  const selectCls =
    "rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm font-medium focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100";
  const btnPrimary =
    "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed";
  const btnSecondary =
    "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600";
  const btnDanger =
    "rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-700 dark:bg-zinc-700 dark:text-red-300 dark:hover:bg-zinc-600";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-600 dark:bg-zinc-800/50">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Formula Name
            </label>
            <input
              type="text"
              placeholder="e.g. RBC 500 WW10"
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              className={`${inputCls} w-72`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Default Batch Size (kg)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="e.g. 10"
                value={batchSizeKg}
                onChange={(e) => setBatchSizeKg(e.target.value)}
                className={`${inputCls} w-32`}
              />
              {(() => {
                const g = parseScientific(batchSizeKg);
                return !Number.isNaN(g) && g > 0 ? (
                  <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    = {(g * 1000).toLocaleString("en-GB")} g
                  </span>
                ) : null;
              })()}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Default kg per set
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="e.g. 2 or 0.15"
                value={defaultKgPerSet}
                onChange={(e) => setDefaultKgPerSet(e.target.value)}
                className={`${inputCls} w-32`}
              />
              {(() => {
                const kg = parseScientific(defaultKgPerSet);
                return !Number.isNaN(kg) && kg > 0 ? (
                  <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    = {(kg * 1000).toLocaleString("en-GB", { maximumFractionDigits: 2 })} g
                  </span>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border-2 border-red-300 bg-red-50 px-5 py-4 shadow-sm dark:border-red-800 dark:bg-red-950"
        >
          <p className="text-sm font-bold text-red-800 dark:text-red-200">Error</p>
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border-2 border-zinc-200 bg-white shadow-md dark:border-zinc-600 dark:bg-zinc-800">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-600">
          <thead>
            <tr className="bg-zinc-100 dark:bg-zinc-700/80">
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">#</th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Ingredient</th>
              <th className="px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Type</th>
              <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Stock CFU/g</th>
              <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Cost/kg</th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Mode</th>
              <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Ratio</th>
              <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Target CFU</th>
              <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Default g</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-600">
            {lines.map((line, idx) => (
              <tr key={line.uid} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/40">
                <td className="whitespace-nowrap px-3 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {idx + 1}
                </td>

                <td className="px-3 py-3 text-sm">
                  <div className="space-y-2">
                    <select
                      value={line.showNewIngredient ? "__new__" : line.ingredientId ?? ""}
                      onChange={(e) => handleIngredientSelect(line.uid, e.target.value)}
                      className={`${selectCls} min-w-[200px]`}
                    >
                      <option value="">Select ingredient...</option>
                      <option value="__new__">+ Create new ingredient</option>
                      {ingredients.map((i) => (
                        <option key={i.id} value={i.id} className="font-semibold">
                          {i.stock_cfu_per_g > 0 ? "\u{1F9EC} " : ""}[{i.id}] {i.name}
                        </option>
                      ))}
                    </select>
                    {line.showNewIngredient && (
                      <div className="space-y-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-600 dark:bg-zinc-700/50">
                        <input placeholder="ID (e.g. PRO0235-1E11)" value={line.newIngId}
                          onChange={(e) => updateLine(line.uid, { newIngId: e.target.value })}
                          className={`${inputCls} w-full`} />
                        <input placeholder="Name" value={line.newIngName}
                          onChange={(e) => updateLine(line.uid, { newIngName: e.target.value })}
                          className={`${inputCls} w-full`} />
                        <input placeholder="Stock CFU/g (0 for filler)" value={line.newIngStockCfu}
                          onChange={(e) => updateLine(line.uid, { newIngStockCfu: e.target.value })}
                          className={`${inputCls} w-full`} />
                        <input placeholder="Cost/kg (£)" value={line.newIngCostPerKg}
                          onChange={(e) => updateLine(line.uid, { newIngCostPerKg: e.target.value })}
                          className={`${inputCls} w-full`} />
                        <div className="flex gap-1.5">
                          <button type="button" onClick={() => handleCreateIngredient(line)} className={btnPrimary}>Create</button>
                          <button type="button" onClick={() => updateLine(line.uid, { showNewIngredient: false, newIngId: "", newIngName: "" })} className={btnSecondary}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                </td>

                <td className="px-3 py-3 text-center text-xs font-semibold">
                  {line.ingredientId ? (
                    line.isBacteria ? (
                      <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                        Bacteria
                      </span>
                    ) : (
                      <span className="rounded bg-zinc-200 px-2 py-1 text-zinc-600 dark:bg-zinc-600 dark:text-zinc-300">
                        Filler
                      </span>
                    )
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>

                <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                  {line.ingredientId && line.isBacteria ? formatCfu(line.stockCfuPerG) : "—"}
                </td>

                <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                  {line.ingredientId ? (
                    isEditMode ? (
                      <input
                        type="text"
                        value={costDraftByLineUid[line.uid] ?? String(line.costPerKgGbp)}
                        onFocus={() => beginCostEdit(line.uid, line.costPerKgGbp)}
                        onChange={(e) => setCostDraft(line.uid, e.target.value)}
                        onBlur={() => void commitCostEdit(line)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          }
                        }}
                        className={`${inputCls} w-24 text-right`}
                      />
                    ) : (
                      `£${line.costPerKgGbp.toFixed(2)}`
                    )
                  ) : "—"}
                </td>

                <td className="px-3 py-3 text-sm">
                  <select value={line.fillerMode} disabled={line.isBacteria}
                    onChange={(e) => updateLine(line.uid, { fillerMode: e.target.value as FillerMode })}
                    className={`${selectCls} w-28 ${line.isBacteria ? "opacity-40 cursor-not-allowed" : ""}`}>
                    <option value="fixed">Fixed</option>
                    <option value="ratio">Ratio</option>
                    <option value="remainder">Remainder</option>
                  </select>
                </td>

                <td className="px-3 py-3 text-right">
                  <input type="text" placeholder="\u2014" value={line.fillerRatio}
                    disabled={line.fillerMode !== "ratio"}
                    onChange={(e) => updateLine(line.uid, { fillerRatio: e.target.value })}
                    className={`${inputCls} w-20 text-right ${line.fillerMode !== "ratio" ? "opacity-40 cursor-not-allowed" : ""}`} />
                </td>

                <td className="px-3 py-3 text-right">
                  <input type="text" placeholder={line.isBacteria ? "e.g. 1e13" : "\u2014"}
                    value={line.targetTotalCfu} disabled={!line.isBacteria}
                    onChange={(e) => updateLine(line.uid, { targetTotalCfu: e.target.value })}
                    className={`${inputCls} w-24 text-right ${!line.isBacteria ? "opacity-40 cursor-not-allowed" : ""}`} />
                </td>

                <td className="px-3 py-3 text-right">
                  {!line.isBacteria && line.fillerMode === "fixed" ? (
                    <input type="text" placeholder="g"
                      value={line.defaultGrams}
                      onChange={(e) => updateLine(line.uid, { defaultGrams: e.target.value })}
                      className={`${inputCls} w-24 text-right`} />
                  ) : (
                    <span className="text-xs text-zinc-400">{line.isBacteria ? "auto" : "\u2014"}</span>
                  )}
                </td>

                <td className="px-3 py-3">
                  {lines.length > 1 && (
                    <button type="button" onClick={() => removeRow(line.uid)} className={btnDanger} title="Remove row">Remove</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={addRow} className={btnSecondary}>+ Add Row</button>
        {isEditMode && existingRecipe ? (
          <Link href={`/recipes/${existingRecipe.id}`} className={btnSecondary}>
            Cancel
          </Link>
        ) : (
          <Link href="/recipes" className={btnSecondary}>
            Cancel
          </Link>
        )}
        <button type="button" onClick={handleSave} disabled={saving} className={btnPrimary}>
          {saving ? "Saving..." : isEditMode ? "Update Formula" : "Save Formula"}
        </button>
      </div>

      <div className="rounded-xl border-2 border-zinc-200 bg-white shadow-md dark:border-zinc-600 dark:bg-zinc-800">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-600">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            Live preview
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Updates automatically while you edit this formula.
          </p>
        </div>
        {previewBatchGrams <= 0 ? (
          <p className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">
            Enter a valid default batch size to see preview values.
          </p>
        ) : previewLineInputs.length === 0 ? (
          <p className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">
            Select at least one ingredient row to see preview values.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-600">
                <thead>
                  <tr className="bg-zinc-100 dark:bg-zinc-700/80">
                    <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">#</th>
                    <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">ID</th>
                    <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Ingredient</th>
                    <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">g</th>
                    <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">%</th>
                    <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Stock CFU/g</th>
                    <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Target CFU/g</th>
                    <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Final CFU/g</th>
                    <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-600">
                  {previewLineInputs.map((line, idx) => {
                    const res = previewResultByLineId.get(idx + 1);
                    return (
                      <tr key={line.lineId} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/40">
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                          {idx + 1}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm font-mono text-zinc-700 dark:text-zinc-300">
                          {line.ingredientId}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                          {line.ingredientName || line.ingredientId}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                          {res ? res.grams.toLocaleString("en-GB", { maximumFractionDigits: 3 }) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                          {res ? `${(res.percent * 100).toFixed(2)}%` : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                          {line.isBacteria ? formatCfu(line.stockCfuPerG) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                          {line.isBacteria && res && previewBatchGrams > 0
                            ? formatCfu(res.targetTotalCfu / previewBatchGrams)
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                          {res && res.isBacteria ? formatCfu(res.finalCfuPerGram) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                          {res ? `£${res.costInProduct.toFixed(2)}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 border-t border-zinc-200 px-4 py-3 text-sm sm:grid-cols-3 dark:border-zinc-600">
              <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-700/40">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Total grams
                </p>
                <p className="mt-1 text-right font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {previewResult
                    ? previewResult.totalGrams.toLocaleString("en-GB", { maximumFractionDigits: 2 })
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-700/40">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Total final CFU/g
                </p>
                <p className="mt-1 text-right font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {previewResult ? formatCfu(previewTotalFinalCfuPerGram) : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-700/40">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Total cost
                </p>
                <p className="mt-1 text-right font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {previewResult ? `£${previewResult.totalCost.toFixed(2)}` : "—"}
                </p>
              </div>
            </div>
            {previewResult?.error && (
              <div className="border-t border-zinc-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-zinc-600 dark:bg-red-950/40 dark:text-red-300">
                {previewResult.error}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
