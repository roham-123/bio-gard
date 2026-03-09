"use client";

import { useCallback, useMemo, useState } from "react";
import type { RecipeWithLines } from "@/lib/db";
import {
  calculate,
  recipeToLineInputs,
  getDefaultCfuOption,
  type LineInput,
  type LineResult,
} from "@/lib/calc";
import { formatNumber, formatCfu, formatPercent, formatCurrency, parseScientific } from "@/lib/format";
import { generateRecipePdf } from "@/lib/pdf";
import {
  addCfuOption,
  deleteCfuOption,
  updateRecipeLineCost,
  updateRecipeLineDefaultCfuOption,
} from "@/app/actions";

type Props = {
  recipe: RecipeWithLines;
};

export default function RecipeCalculator({ recipe }: Props) {
  const defaultBatchGrams = Number(recipe.default_batch_grams);
  const [batchGrams, setBatchGrams] = useState(defaultBatchGrams);
  const [batchInput, setBatchInput] = useState(String(defaultBatchGrams / 1000));
  const [kgPerUnit, setKgPerUnit] = useState(1);
  const [kgPerUnitInput, setKgPerUnitInput] = useState("1");
  const [selectedCfu, setSelectedCfu] = useState<Map<number, number>>(new Map());
  const [addCfuLineId, setAddCfuLineId] = useState<number | null>(null);
  const [newCfuLabel, setNewCfuLabel] = useState("");
  const [newCfuPerGram, setNewCfuPerGram] = useState("");
  const [newCfuPrice, setNewCfuPrice] = useState("");
  const [isEditingCosts, setIsEditingCosts] = useState(false);
  const [costSnapshot, setCostSnapshot] = useState<{ lineId: number; costPerKgGbp: number }[]>([]);
  const [lineInputs, setLineInputs] = useState<LineInput[]>(() =>
    recipeToLineInputs(recipe)
  );

  const syncBatchFromInput = useCallback(() => {
    const parsedKg = parseScientific(batchInput);
    if (!Number.isNaN(parsedKg) && parsedKg > 0) {
      const grams = parsedKg * 1000;
      setBatchGrams(grams);
      setBatchInput(String(parsedKg));
    }
  }, [batchInput]);

  const handleBatchBlur = () => syncBatchFromInput();

  const syncKgPerUnitFromInput = useCallback(() => {
    const parsed = parseScientific(kgPerUnitInput);
    if (!Number.isNaN(parsed) && parsed > 0) {
      setKgPerUnit(parsed);
      setKgPerUnitInput(String(parsed));
    }
  }, [kgPerUnitInput]);
  const handleKgPerUnitBlur = () => syncKgPerUnitFromInput();

  const selectedCfuMap = useMemo(() => {
    const m = new Map<number, number>();
    lineInputs.forEach((line) => {
      if (line.isBacteria && line.cfuOptions.length) {
        const optId =
          selectedCfu.get(line.lineId) ??
          getDefaultCfuOption(line.cfuOptions, line.defaultCfuOptionId)?.id;
        if (optId != null) m.set(line.lineId, optId);
      }
    });
    return m;
  }, [lineInputs, selectedCfu]);

  const result = useMemo(() => {
    return calculate(
      batchGrams,
      defaultBatchGrams,
      lineInputs,
      selectedCfuMap
    );
  }, [batchGrams, defaultBatchGrams, lineInputs, selectedCfuMap]);

  const totalFinalCfuPerGram = useMemo(
    () =>
      result.results.reduce(
        (sum, r) => sum + (r.isBacteria && typeof r.finalCfuPerGram === "number" ? r.finalCfuPerGram : 0),
        0
      ),
    [result.results]
  );

  const units = useMemo(
    () => (kgPerUnit > 0 ? batchGrams / 1000 / kgPerUnit : 0),
    [batchGrams, kgPerUnit]
  );

  const handleAddCfuOption = useCallback(
    async (lineId: number, ingredientId: number) => {
      const cfu = parseScientific(newCfuPerGram);
      if (!newCfuLabel.trim() || Number.isNaN(cfu) || cfu < 0) return;
      const price = newCfuPrice.trim() === "" ? null : parseScientific(newCfuPrice);
      const priceGbp = price != null && !Number.isNaN(price) && price >= 0 ? price : null;
      const added = await addCfuOption(ingredientId, newCfuLabel.trim(), cfu, priceGbp);
      if (added) {
        setLineInputs((prev) =>
          prev.map((l) => {
            if (l.lineId !== lineId) return l;
            return {
              ...l,
              cfuOptions: [
                ...l.cfuOptions,
                {
                  id: added.id,
                  label: added.label,
                  cfu_per_gram: added.cfu_per_gram,
                  is_default: false,
                  price_gbp: added.price_gbp,
                },
              ],
            };
          })
        );
        setSelectedCfu((m) => new Map(m).set(lineId, added.id));
        setAddCfuLineId(null);
        setNewCfuLabel("");
        setNewCfuPerGram("");
        setNewCfuPrice("");
      }
    },
    [newCfuLabel, newCfuPerGram, newCfuPrice]
  );

  const handleDeleteCfuOption = useCallback(
    async (lineId: number, optionId: number) => {
      const line = lineInputs.find((l) => l.lineId === lineId);
      if (!line || line.cfuOptions.length <= 1) return;
      const deleted = await deleteCfuOption(optionId);
      if (deleted) {
        const remaining = line.cfuOptions.filter((o) => o.id !== optionId);
        const newDefault = remaining.find((o) => o.is_default) ?? remaining[0];
        setLineInputs((prev) =>
          prev.map((l) => {
            if (l.lineId !== lineId) return l;
            return { ...l, cfuOptions: remaining };
          })
        );
        setSelectedCfu((m) => {
          const next = new Map(m);
          if (next.get(lineId) === optionId) next.set(lineId, newDefault?.id ?? 0);
          return next;
        });
      }
    },
    [lineInputs]
  );

  const resultByLineId = useMemo(() => {
    const map = new Map<number, LineResult>();
    result.results.forEach((r) => map.set(r.lineId, r));
    return map;
  }, [result.results]);

  const handleEditCostsStart = useCallback(() => {
    setCostSnapshot(lineInputs.map((l) => ({ lineId: l.lineId, costPerKgGbp: l.costPerKgGbp })));
    setIsEditingCosts(true);
  }, [lineInputs]);

  const handleEditCostsSave = useCallback(() => {
    lineInputs.forEach((l) => updateRecipeLineCost(l.lineId, l.costPerKgGbp));
    setAddCfuLineId(null);
    setNewCfuLabel("");
    setNewCfuPerGram("");
    setNewCfuPrice("");
    setIsEditingCosts(false);
  }, [lineInputs]);

  const handleEditCostsCancel = useCallback(() => {
    setLineInputs((prev) =>
      prev.map((l) => {
        const s = costSnapshot.find((x) => x.lineId === l.lineId);
        return s ? { ...l, costPerKgGbp: s.costPerKgGbp } : l;
      })
    );
    setAddCfuLineId(null);
    setNewCfuLabel("");
    setNewCfuPerGram("");
    setNewCfuPrice("");
    setIsEditingCosts(false);
  }, [costSnapshot]);

  const setLineCost = useCallback((lineId: number, value: number) => {
    if (Number.isNaN(value) || value < 0) return;
    setLineInputs((prev) =>
      prev.map((l) => (l.lineId === lineId ? { ...l, costPerKgGbp: value } : l))
    );
  }, []);

  return (
    <div className="space-y-6">
      {/* Batch size + Edit toolbar */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-600 dark:bg-zinc-800/50">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Batch size (kg)
            </label>
            <input
              type="text"
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              onBlur={handleBatchBlur}
              onKeyDown={(e) => e.key === "Enter" && syncBatchFromInput()}
              className="w-28 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium tabular-nums shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
            />
            {batchGrams > 0 && (
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                = {formatNumber(batchGrams, { maxDecimals: 2 })} g
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              kg per unit
            </label>
            <input
              type="text"
              value={kgPerUnitInput}
              onChange={(e) => setKgPerUnitInput(e.target.value)}
              onBlur={handleKgPerUnitBlur}
              onKeyDown={(e) => e.key === "Enter" && syncKgPerUnitFromInput()}
              className="w-24 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium tabular-nums shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
            />
            {kgPerUnit > 0 && batchGrams > 0 && (
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                ≈ {formatNumber(units, { maxDecimals: 2 })} units
              </span>
            )}
          </div>
          <div className="h-6 w-px bg-zinc-300 dark:bg-zinc-600" />
          {isEditingCosts ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleEditCostsSave}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-800"
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleEditCostsCancel}
                className="rounded-lg border-2 border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 dark:focus:ring-offset-zinc-800"
              >
                Cancel
              </button>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Edit cost/kg and CFU/g in the table below, then click Save.
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleEditCostsStart}
              className="rounded-lg border-2 border-zinc-400 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600 dark:focus:ring-offset-zinc-800"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {result.error && (
        <div
          role="alert"
          className="rounded-xl border-2 border-red-300 bg-red-50 px-5 py-4 shadow-sm dark:border-red-800 dark:bg-red-950"
        >
          <p className="mb-1 text-sm font-bold text-red-800 dark:text-red-200">Invalid Formula</p>
          {result.error.split("\n").map((msg, i) => (
            <p key={i} className="text-sm text-red-700 dark:text-red-300">{msg}</p>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border-2 border-zinc-200 bg-white shadow-md dark:border-zinc-600 dark:bg-zinc-800">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-600">
          <thead>
            <tr className="bg-zinc-100 dark:bg-zinc-700/80">
              <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                Ingredient
              </th>
              <th className="px-3 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">g</th>
              <th className="px-3 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">kg</th>
              <th className="px-3 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">g/unit</th>
              <th className="px-3 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">%</th>
              <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Stock CFU/g</th>
              <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Target CFU</th>
              <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Final CFU/g</th>
              <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Cost/kg</th>
              <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-600">
            {lineInputs.map((line) => {
              const res = resultByLineId.get(line.lineId);
              const isBacteria = line.isBacteria;
              const selectedOptId =
                selectedCfu.get(line.lineId) ??
                getDefaultCfuOption(line.cfuOptions, line.defaultCfuOptionId)?.id;
              const selectedOpt = line.cfuOptions.find((o) => o.id === selectedOptId);
              const showAddCfu = addCfuLineId === line.lineId;

              const isOverflow = res?.overflow;
              const isFillerInvalid = !result.formulaValid && !isBacteria && (line.fillerMode === "ratio" || line.fillerMode === "remainder");

              return (
                <tr
                  key={line.lineId}
                  className={[
                    "transition-colors",
                    isOverflow
                      ? "bg-red-50 dark:bg-red-950/40"
                      : isFillerInvalid
                        ? "bg-amber-50/60 opacity-60 dark:bg-amber-950/20"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-700/40",
                  ].join(" ")}
                >
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                    {line.ingredientCode && (
                      <span className="text-zinc-500">[{line.ingredientCode}] </span>
                    )}
                    {line.ingredientName}
                    {res?.warning && (
                      <span
                        className="ml-1 text-red-500"
                        title={res.warning}
                        aria-label={res.warning}
                      >
                        ⚠
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {res ? formatNumber(res.grams, { maxDecimals: 2 }) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {res ? formatNumber(res.grams / 1000, { maxDecimals: 4 }) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {res && units > 0 ? formatNumber(res.grams / units, { maxDecimals: 2 }) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {res ? formatPercent(res.percent) : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {isBacteria ? (
                      isEditingCosts ? (
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={selectedOptId ?? ""}
                              onChange={(e) => {
                                const optionId = Number(e.target.value);
                                setSelectedCfu((m) => new Map(m).set(line.lineId, optionId));
                                const opt = line.cfuOptions.find((o) => o.id === optionId);
                                if (opt?.price_gbp != null) {
                                  setLineInputs((prev) =>
                                    prev.map((l) =>
                                      l.lineId === line.lineId
                                        ? { ...l, costPerKgGbp: opt.price_gbp ?? l.costPerKgGbp }
                                        : l
                                    )
                                  );
                                  updateRecipeLineCost(line.lineId, opt.price_gbp);
                                }
                              }}
                              className="min-w-[160px] rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-1.5 text-sm font-medium focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:focus:bg-zinc-600"
                            >
                              {line.cfuOptions.map((o) => {
                                const isDefaultForLine =
                                  line.defaultCfuOptionId != null
                                    ? o.id === line.defaultCfuOptionId
                                    : o.is_default;
                                const label = isDefaultForLine
                                  ? `${o.label} (Default)`
                                  : o.label;
                                return (
                                  <option key={o.id} value={o.id}>
                                    {label} ({formatCfu(o.cfu_per_gram)})
                                  </option>
                                );
                              })}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                if (selectedOptId != null) {
                                  // Update local state so the "Default" badge moves immediately
                                  setLineInputs((prev) =>
                                    prev.map((l) =>
                                      l.lineId === line.lineId
                                        ? { ...l, defaultCfuOptionId: selectedOptId }
                                        : l
                                    )
                                  );
                                  void updateRecipeLineDefaultCfuOption(line.lineId, selectedOptId);
                                }
                              }}
                              className="rounded-lg border border-emerald-500 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-400 dark:bg-emerald-900/30 dark:text-emerald-200"
                            >
                              Make default
                            </button>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {line.cfuOptions.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  selectedOptId != null &&
                                  handleDeleteCfuOption(line.lineId, selectedOptId)
                                }
                                className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-500"
                              >
                                Delete option
                              </button>
                            )}
                            {!showAddCfu ? (
                              <button
                                type="button"
                                onClick={() => setAddCfuLineId(line.lineId)}
                                className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-500"
                              >
                                + Add option
                              </button>
                            ) : (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <input
                                  placeholder="Label"
                                  value={newCfuLabel}
                                  onChange={(e) => setNewCfuLabel(e.target.value)}
                                  className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-600 dark:text-zinc-100"
                                />
                                <input
                                  placeholder="CFU/g"
                                  value={newCfuPerGram}
                                  onChange={(e) => setNewCfuPerGram(e.target.value)}
                                  className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-600 dark:text-zinc-100"
                                />
                                <input
                                  placeholder="Price (£)"
                                  value={newCfuPrice}
                                  onChange={(e) => setNewCfuPrice(e.target.value)}
                                  className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-600 dark:text-zinc-100"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAddCfuOption(line.lineId, line.ingredientId)
                                  }
                                  className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAddCfuLineId(null);
                                    setNewCfuLabel("");
                                    setNewCfuPerGram("");
                                    setNewCfuPrice("");
                                  }}
                                  className="rounded-lg border border-zinc-300 bg-white px-3 py-1 text-xs font-medium dark:border-zinc-600 dark:bg-zinc-600 dark:text-zinc-200"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {selectedOpt ? (
                            <>
                              {selectedOpt.label}
                              {(line.defaultCfuOptionId != null
                                ? selectedOpt.id === line.defaultCfuOptionId
                                : selectedOpt.is_default) && (
                                <span className="ml-1 rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                                  Default
                                </span>
                              )}
                              <span className="ml-1 text-sm text-zinc-500 dark:text-zinc-400">
                                ({formatCfu(selectedOpt.cfu_per_gram)})
                              </span>
                            </>
                          ) : (
                            "—"
                          )}
                        </span>
                      )
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {isBacteria && res ? formatCfu(res.targetTotalCfu) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {res && res.isBacteria ? formatCfu(res.finalCfuPerGram) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums">
                    {isEditingCosts ? (
                      <input
                        type="text"
                        value={line.costPerKgGbp}
                        onChange={(e) =>
                          setLineCost(line.lineId, parseScientific(e.target.value))
                        }
                              className="w-24 rounded-lg border-2 border-zinc-300 bg-white px-2 py-1 text-right text-sm font-medium tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100"
                      />
                    ) : (
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {formatCurrency(line.costPerKgGbp)}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {res ? formatCurrency(res.costInProduct) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals + PDF */}
      <div
        className={[
          "rounded-xl border-2 p-6 shadow-md",
          result.formulaValid
            ? "border-zinc-200 bg-zinc-50/80 dark:border-zinc-600 dark:bg-zinc-800/50"
            : "border-red-200 bg-red-50/60 dark:border-red-800 dark:bg-red-950/30",
        ].join(" ")}
      >
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
          Summary
          {!result.formulaValid && (
            <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-bold uppercase text-red-700 dark:bg-red-900/50 dark:text-red-300">
              Invalid
            </span>
          )}
        </h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 sm:block">
            <dt className="font-medium text-zinc-600 dark:text-zinc-400">Total grams</dt>
            <dd className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {formatNumber(result.totalGrams / 1000, { maxDecimals: 2 })} kg (
              {formatNumber(result.totalGrams, { maxDecimals: 2 })} g)
            </dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="font-medium text-zinc-600 dark:text-zinc-400">Total final CFU/g</dt>
            <dd className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {formatCfu(totalFinalCfuPerGram)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="font-medium text-zinc-600 dark:text-zinc-400">Total cost</dt>
            <dd className={`font-semibold tabular-nums ${result.formulaValid ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"}`}>
              {result.formulaValid ? formatCurrency(result.totalCost) : `~${formatCurrency(result.totalCost)} (partial)`}
            </dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="font-medium text-zinc-600 dark:text-zinc-400">Cost per kg</dt>
            <dd className={`font-semibold tabular-nums ${result.formulaValid ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"}`}>
              {result.formulaValid ? formatCurrency(result.costPerKg) : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="font-medium text-zinc-600 dark:text-zinc-400">Cost per unit</dt>
            <dd className={`font-semibold tabular-nums ${result.formulaValid ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"}`}>
              {result.formulaValid && units > 0 ? formatCurrency(result.totalCost / units) : "—"}
            </dd>
          </div>
        </dl>
        <div className="mt-6">
          <button
            type="button"
            disabled={!result.formulaValid}
            onClick={() =>
              generateRecipePdf(recipe.name, batchGrams, units, result.results, {
                totalGrams: result.totalGrams,
                totalCfu: result.totalCfu,
                totalCost: result.totalCost,
                costPerKg: result.costPerKg,
                costPerUnit: units > 0 ? result.totalCost / units : undefined,
              })
            }
            className={[
              "rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2",
              result.formulaValid
                ? "bg-zinc-800 text-white hover:bg-zinc-700 focus:ring-zinc-500 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:ring-offset-zinc-800"
                : "cursor-not-allowed bg-zinc-300 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-500",
            ].join(" ")}
          >
            {result.formulaValid ? "Generate PDF" : "PDF unavailable — fix formula"}
          </button>
        </div>
      </div>
    </div>
  );
}
