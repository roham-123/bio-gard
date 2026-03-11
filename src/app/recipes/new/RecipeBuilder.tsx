"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { Ingredient, CfuOption } from "@/lib/db";
import { parseScientific, formatCfu } from "@/lib/format";
import {
  createRecipeAction,
  createIngredientAction,
  getIngredientCfuOptionsAction,
  addCfuOption,
} from "@/app/actions";

type FillerMode = "fixed" | "ratio" | "remainder";

type BuilderLine = {
  uid: string;
  ingredientId: number | null;
  ingredientName: string;
  isBacteria: boolean;
  fillerMode: FillerMode;
  fillerRatio: string;
  targetTotalCfu: string;
  defaultGrams: string;
  selectedStockId: number | null;
  cfuOptions: CfuOption[];
  loadingOptions: boolean;
  showNewIngredient: boolean;
  newIngName: string;
  newIngCode: string;
  newIngIsBacteria: boolean;
  showAddStock: boolean;
  newStockLabel: string;
  newStockCfu: string;
  newStockPrice: string;
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
    fillerMode: "fixed",
    fillerRatio: "",
    targetTotalCfu: "",
    defaultGrams: "",
    selectedStockId: null,
    cfuOptions: [],
    loadingOptions: false,
    showNewIngredient: false,
    newIngName: "",
    newIngCode: "",
    newIngIsBacteria: false,
    showAddStock: false,
    newStockLabel: "",
    newStockCfu: "",
    newStockPrice: "",
  };
}

function stockOptionLabel(opt: CfuOption, isBacteria: boolean): string {
  if (isBacteria) {
    const parts = [opt.label, " \u2014 ", formatCfu(opt.cfu_per_gram)];
    if (opt.price_gbp != null) parts.push(` (\u00A3${opt.price_gbp})`);
    return parts.join("");
  }
  if (opt.price_gbp != null) return `${opt.label} \u2014 \u00A3${opt.price_gbp}/kg`;
  return opt.label;
}

type Props = { ingredients: Ingredient[] };

export default function RecipeBuilder({ ingredients: initialIngredients }: Props) {
  const router = useRouter();
  const [recipeName, setRecipeName] = useState("");
  const [batchSizeKg, setBatchSizeKg] = useState("");
  const [lines, setLines] = useState<BuilderLine[]>([emptyLine()]);
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLine(lineUid: string, patch: Partial<BuilderLine>) {
    setLines((prev) => prev.map((l) => (l.uid === lineUid ? { ...l, ...patch } : l)));
  }

  async function handleIngredientSelect(lineUid: string, value: string) {
    if (value === "__new__") {
      updateLine(lineUid, { showNewIngredient: true, ingredientId: null, ingredientName: "" });
      return;
    }
    const id = Number(value);
    const ing = ingredients.find((i) => i.id === id);
    if (!ing) return;
    updateLine(lineUid, {
      ingredientId: ing.id,
      ingredientName: ing.name,
      isBacteria: ing.is_bacteria,
      fillerMode: ing.is_bacteria ? "fixed" : "fixed",
      showNewIngredient: false,
      loadingOptions: true,
      cfuOptions: [],
      selectedStockId: null,
    });
    const options = await getIngredientCfuOptionsAction(ing.id);
    const defaultOpt = options.find((o) => o.is_default) ?? options[0] ?? null;
    updateLine(lineUid, {
      cfuOptions: options,
      loadingOptions: false,
      selectedStockId: defaultOpt?.id ?? null,
    });
  }

  async function handleCreateIngredient(line: BuilderLine) {
    const name = line.newIngName.trim();
    if (!name) return;
    try {
      const ing = await createIngredientAction(
        name,
        line.newIngIsBacteria,
        line.newIngCode.trim() || null,
        0
      );
      setIngredients((prev) => [...prev, ing].sort((a, b) => a.name.localeCompare(b.name)));
      updateLine(line.uid, {
        ingredientId: ing.id,
        ingredientName: ing.name,
        isBacteria: ing.is_bacteria,
        fillerMode: ing.is_bacteria ? "fixed" : "fixed",
        showNewIngredient: false,
        newIngName: "",
        newIngCode: "",
        newIngIsBacteria: false,
        cfuOptions: [],
        selectedStockId: null,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create ingredient");
    }
  }

  async function handleAddStock(line: BuilderLine) {
    if (!line.ingredientId) return;
    const label = line.newStockLabel.trim();
    if (!label) {
      setError("Stock option label is required.");
      return;
    }

    let cfuVal = 0;
    let priceGbp: number | null = null;

    if (line.isBacteria) {
      const cfu = parseScientific(line.newStockCfu);
      if (Number.isNaN(cfu) || cfu < 0) {
        setError("CFU/g must be a valid number.");
        return;
      }
      cfuVal = cfu;
      const price = line.newStockPrice.trim() === "" ? null : parseScientific(line.newStockPrice);
      priceGbp = price != null && !Number.isNaN(price) && price >= 0 ? price : null;
    } else {
      const price = parseScientific(line.newStockPrice);
      if (Number.isNaN(price) || price < 0) {
        setError("Cost/kg must be a valid number.");
        return;
      }
      priceGbp = price;
    }

    try {
      const added = await addCfuOption(line.ingredientId, label, cfuVal, priceGbp);
      if (added) {
        setLines((prev) =>
          prev.map((l) =>
            l.uid === line.uid
              ? {
                  ...l,
                  cfuOptions: [...l.cfuOptions, added],
                  selectedStockId: added.id,
                  showAddStock: false,
                  newStockLabel: "",
                  newStockCfu: "",
                  newStockPrice: "",
                }
              : l
          )
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add stock option");
    }
  }

  function handleIsBacteriaToggle(lineUid: string, checked: boolean) {
    updateLine(lineUid, {
      isBacteria: checked,
      fillerMode: checked ? "fixed" : "fixed",
      fillerRatio: "",
      targetTotalCfu: checked ? undefined : "",
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
    const validLines = lines.filter((l) => l.ingredientId != null);
    if (validLines.length === 0) { setError("Add at least one ingredient row."); return; }

    const lineInputs = validLines.map((l, idx) => {
      const targetCfu = parseScientific(l.targetTotalCfu) || 0;
      const selectedOpt = l.cfuOptions.find((o) => o.id === l.selectedStockId);
      let defaultGrams = 0;
      if (l.isBacteria) {
        const cfuPerG = selectedOpt?.cfu_per_gram ?? 0;
        defaultGrams = cfuPerG > 0 ? targetCfu / cfuPerG : 0;
      } else {
        defaultGrams = parseScientific(l.defaultGrams) || 0;
      }
      return {
        ingredientId: l.ingredientId!,
        sortOrder: idx + 1,
        targetTotalCfu: targetCfu,
        defaultGrams,
        fillerMode: l.fillerMode,
        fillerRatio: l.fillerMode === "ratio" ? parseScientific(l.fillerRatio) || 0 : 0,
        costPerKgGbp: selectedOpt?.price_gbp ?? null,
        defaultCfuOptionId: l.selectedStockId,
      };
    });

    setSaving(true);
    try {
      const result = await createRecipeAction(name, batchGrams, lineInputs);
      router.push(`/recipes/${result.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create recipe");
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
              <th className="px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Is Bacteria</th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Mode</th>
              <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Ratio</th>
              <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Target CFU</th>
              <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Default g</th>
              <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Stock Option</th>
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
                        <option key={i.id} value={i.id}>
                          {i.is_bacteria ? "\u{1F9EC} " : ""}{i.code ? `[${i.code}] ` : ""}{i.name}
                        </option>
                      ))}
                    </select>
                    {line.showNewIngredient && (
                      <div className="space-y-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-600 dark:bg-zinc-700/50">
                        <input placeholder="Ingredient name" value={line.newIngName}
                          onChange={(e) => updateLine(line.uid, { newIngName: e.target.value })}
                          className={`${inputCls} w-full`} />
                        <input placeholder="Code (optional)" value={line.newIngCode}
                          onChange={(e) => updateLine(line.uid, { newIngCode: e.target.value })}
                          className={`${inputCls} w-full`} />
                        <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          <input type="checkbox" checked={line.newIngIsBacteria}
                            onChange={(e) => updateLine(line.uid, { newIngIsBacteria: e.target.checked })}
                            className="size-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600" />
                          Bacteria
                        </label>
                        <div className="flex gap-1.5">
                          <button type="button" onClick={() => handleCreateIngredient(line)} className={btnPrimary}>Create</button>
                          <button type="button" onClick={() => updateLine(line.uid, { showNewIngredient: false, newIngName: "" })} className={btnSecondary}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                </td>

                <td className="px-3 py-3 text-center">
                  <input type="checkbox" checked={line.isBacteria}
                    onChange={(e) => handleIsBacteriaToggle(line.uid, e.target.checked)}
                    className="size-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600" />
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

                <td className="px-3 py-3 text-sm">
                  {line.ingredientId ? (
                    <div className="space-y-1.5">
                      {line.loadingOptions ? (
                        <span className="text-xs text-zinc-400">Loading...</span>
                      ) : line.cfuOptions.length > 0 ? (
                        <select value={line.selectedStockId ?? ""}
                          onChange={(e) => updateLine(line.uid, { selectedStockId: e.target.value ? Number(e.target.value) : null })}
                          className={`${selectCls} min-w-[180px]`}>
                          <option value="">No stock selected</option>
                          {line.cfuOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>{stockOptionLabel(opt, line.isBacteria)}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-zinc-400">No stock options</span>
                      )}
                      {line.showAddStock ? (
                        <div className="space-y-1 rounded border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-600 dark:bg-zinc-700/50">
                          <input placeholder="Label" value={line.newStockLabel}
                            onChange={(e) => updateLine(line.uid, { newStockLabel: e.target.value })}
                            className={`${inputCls} w-full !py-1 !text-xs`} />
                          {line.isBacteria && (
                            <input placeholder="CFU/g (e.g. 1e11)" value={line.newStockCfu}
                              onChange={(e) => updateLine(line.uid, { newStockCfu: e.target.value })}
                              className={`${inputCls} w-full !py-1 !text-xs`} />
                          )}
                          <input placeholder={line.isBacteria ? "Price \u00A3/kg (optional)" : "Cost \u00A3/kg"}
                            value={line.newStockPrice}
                            onChange={(e) => updateLine(line.uid, { newStockPrice: e.target.value })}
                            className={`${inputCls} w-full !py-1 !text-xs`} />
                          <div className="flex gap-1">
                            <button type="button" onClick={() => handleAddStock(line)}
                              className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700">Add</button>
                            <button type="button" onClick={() => updateLine(line.uid, { showAddStock: false })}
                              className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 dark:border-zinc-600 dark:text-zinc-300">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => updateLine(line.uid, { showAddStock: true })}
                          className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">
                          + Add stock option
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-400">Select ingredient first</span>
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
        <button type="button" onClick={handleSave} disabled={saving} className={btnPrimary}>
          {saving ? "Saving..." : "Save Formula"}
        </button>
      </div>
    </div>
  );
}
