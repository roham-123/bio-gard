"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import type { RecipeWithLines } from "@/lib/db";
import {
  calculate,
  recipeToLineInputs,
  type LineInput,
  type LineResult,
} from "@/lib/calc";
import {
  formatGrams,
  formatKg,
  formatCfu,
  formatPercent,
  formatCurrency,
  formatNumber,
  parseScientific,
  type CurrencyCode,
} from "@/lib/format";
import { generateRecipePdf } from "@/lib/pdf";

type Props = {
  recipe: RecipeWithLines;
  currency: CurrencyCode;
  gbpToCurrencyRate: number;
};

type PackagingBasis = "per_set" | "per_kg" | "per_unit";

type PackagingLineInput = {
  id: string;
  item: string;
  basis: PackagingBasis;
  costGbp: number;
  unitsPerPack?: number;
};

function getDefaultPackagingLines(recipeName: string): PackagingLineInput[] {
  if (recipeName.trim() === "FTD Cellex TourTurf Thatch") {
    return [
      { id: "pakonap-service", item: "Pakonap Service per set", basis: "per_set", costGbp: 2.61 },
      { id: "white-box", item: "White Box per set", basis: "per_set", costGbp: 1.14 },
      { id: "box-label", item: "Box Label", basis: "per_set", costGbp: 0.31 },
      { id: "leaflet", item: "Leaflet", basis: "per_set", costGbp: 0.07 },
      { id: "alu-pouch-1kg", item: "Alu Pouch 1kg", basis: "per_kg", costGbp: 0.1 },
      { id: "outer-box-8-sets", item: "Outer box for 8 sets", basis: "per_unit", costGbp: 0.51, unitsPerPack: 8 },
    ];
  }
  return [];
}

export default function RecipeCalculator({ recipe, currency, gbpToCurrencyRate }: Props) {
  const defaultBatchGrams = Number(recipe.default_batch_grams);
  const [batchGrams, setBatchGrams] = useState(defaultBatchGrams);
  const [batchInput, setBatchInput] = useState(String(defaultBatchGrams / 1000));
  const initialKgPerSet =
    Number.isFinite(Number(recipe.default_kg_per_set)) && Number(recipe.default_kg_per_set) > 0
      ? Number(recipe.default_kg_per_set)
      : 1;
  const [kgPerUnit, setKgPerUnit] = useState(initialKgPerSet);
  const [kgPerUnitInput, setKgPerUnitInput] = useState(String(initialKgPerSet));
  const [lineInputs] = useState<LineInput[]>(() => recipeToLineInputs(recipe));

  const [packagingLines, setPackagingLines] = useState<PackagingLineInput[]>(() =>
    getDefaultPackagingLines(recipe.name)
  );
  const [isEditingPackaging, setIsEditingPackaging] = useState(false);
  const [packagingSnapshot, setPackagingSnapshot] = useState<PackagingLineInput[]>(() =>
    getDefaultPackagingLines(recipe.name)
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

  const result = useMemo(() => {
    return calculate(batchGrams, defaultBatchGrams, lineInputs);
  }, [batchGrams, defaultBatchGrams, lineInputs]);

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

  const packagingData = useMemo(() => {
    const batchKg = batchGrams / 1000;
    const sets = units;
    const rows = packagingLines.map((line) => {
      let quantity = 0;
      if (line.basis === "per_kg") quantity = batchKg;
      else if (line.basis === "per_set") quantity = sets;
      else {
        const divisor = line.unitsPerPack && line.unitsPerPack > 0 ? line.unitsPerPack : 1;
        quantity = Math.ceil(sets / divisor);
      }
      const total = quantity * line.costGbp;
      const costPerSet = sets > 0 ? total / sets : 0;
      return { ...line, quantity, total, costPerSet };
    });
    const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);
    return { rows, grandTotal };
  }, [packagingLines, batchGrams, units]);

  const packagingTotalCost = packagingData.grandTotal;
  const packagingCostPerKg = batchGrams > 0 ? packagingTotalCost / (batchGrams / 1000) : 0;
  const packagingCostPerUnit = units > 0 ? packagingTotalCost / units : 0;

  const formulaTotalCost = result.totalCost;
  const formulaCostPerKg = batchGrams > 0 ? formulaTotalCost / (batchGrams / 1000) : 0;
  const formulaCostPerUnit = units > 0 ? formulaTotalCost / units : 0;

  const finalTotalCost = formulaTotalCost + packagingTotalCost;
  const finalCostPerKg = formulaCostPerKg + packagingCostPerKg;
  const finalCostPerUnit = formulaCostPerUnit + packagingCostPerUnit;

  const resultByLineId = useMemo(() => {
    const map = new Map<number, LineResult>();
    result.results.forEach((r) => map.set(r.lineId, r));
    return map;
  }, [result.results]);

  const displayRate =
    Number.isFinite(gbpToCurrencyRate) && gbpToCurrencyRate > 0 ? gbpToCurrencyRate : 1;
  const toDisplayCurrency = (gbpValue: number) => Number(gbpValue) * displayRate;
  const formatDisplayCurrency = (gbpValue: number) =>
    formatCurrency(toDisplayCurrency(Number(gbpValue)), currency);

  return (
    <div className="space-y-6">
      {/* Batch size + toolbar */}
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
                = {formatGrams(batchGrams)} g
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              kg per set
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
                ≈ {formatNumber(units, { maxDecimals: 2 })} sets
              </span>
            )}
          </div>
          <div className="h-6 w-px bg-zinc-300 dark:bg-zinc-600" />
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/recipes/${recipe.id}/edit`}
              className="rounded-lg border-2 border-emerald-500 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 dark:border-emerald-400 dark:bg-zinc-700 dark:text-emerald-300 dark:hover:bg-zinc-600 dark:focus:ring-offset-zinc-800"
            >
              Edit Formula
            </Link>
          </div>
        </div>
      </div>

      {/* Formula title */}
      <div className="mt-2">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {recipe.name}
        </h2>
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
              <th className="px-3 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                ID
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                Ingredient
              </th>
              <th className="px-3 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">g</th>
              <th className="px-3 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">kg</th>
              <th className="px-3 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">g/set</th>
              <th className="px-3 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">%</th>
              <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Stock CFU/g</th>
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
                        : isBacteria
                          ? "bg-emerald-50/50 dark:bg-emerald-950/10"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-700/40",
                  ].join(" ")}
                >
                  <td className="whitespace-nowrap px-3 py-3 text-sm font-mono text-zinc-500 dark:text-zinc-400">
                    {line.ingredientId}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">
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
                    {res ? formatGrams(res.grams) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {res ? formatKg(res.grams / 1000) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {res && units > 0 ? formatGrams(res.grams / units) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {res ? formatPercent(res.percent) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {isBacteria ? formatCfu(line.stockCfuPerG) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {isBacteria && res ? formatCfu(res.targetTotalCfu) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {res && res.isBacteria ? formatCfu(res.finalCfuPerGram) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {formatDisplayCurrency(line.costPerKgGbp)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {res ? formatDisplayCurrency(res.costInProduct) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Formula summary + PDF */}
      <div
        className={[
          "rounded-xl border-2 p-6 shadow-md",
          result.formulaValid
            ? "border-zinc-200 bg-zinc-50/80 dark:border-zinc-600 dark:bg-zinc-800/50"
            : "border-red-200 bg-red-50/60 dark:border-red-800 dark:bg-red-950/30",
        ].join(" ")}
      >
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
          Formula Summary
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
              {formatKg(result.totalGrams / 1000)} kg ({formatGrams(result.totalGrams)} g)
            </dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="font-medium text-zinc-600 dark:text-zinc-400">Total final CFU/g</dt>
            <dd className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatCfu(totalFinalCfuPerGram)}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="font-medium text-zinc-600 dark:text-zinc-400">Total cost</dt>
            <dd
              className={`font-semibold tabular-nums ${
                result.formulaValid ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {result.formulaValid
                ? formatDisplayCurrency(result.totalCost)
                : `~${formatDisplayCurrency(result.totalCost)} (partial)`}
            </dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="font-medium text-zinc-600 dark:text-zinc-400">Cost per kg</dt>
            <dd
              className={`font-semibold tabular-nums ${
                result.formulaValid ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {result.formulaValid ? formatDisplayCurrency(result.costPerKg) : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="font-medium text-zinc-600 dark:text-zinc-400">Cost per set</dt>
            <dd
              className={`font-semibold tabular-nums ${
                result.formulaValid ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {result.formulaValid && units > 0 ? formatDisplayCurrency(result.totalCost / units) : "—"}
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
                totalCfu: totalFinalCfuPerGram,
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

      {/* Packaging */}
      <div className="rounded-xl border-2 border-zinc-200 bg-white p-6 shadow-md dark:border-zinc-600 dark:bg-zinc-800">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
            Packaging
          </h2>
          <div className="flex items-center gap-2">
            {isEditingPackaging ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditingPackaging(false)}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-800"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPackagingLines(packagingSnapshot);
                    setIsEditingPackaging(false);
                  }}
                  className="rounded-lg border-2 border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 dark:focus:ring-offset-zinc-800"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPackagingSnapshot(packagingLines.map((line) => ({ ...line })));
                  setIsEditingPackaging(true);
                }}
                className="rounded-lg border-2 border-zinc-400 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600 dark:focus:ring-offset-zinc-800"
              >
                Edit
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-600">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-600">
            <thead>
              <tr className="bg-zinc-100 dark:bg-zinc-700/80">
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Item</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Quantity</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Cost</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Cost/Set</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Total Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-600">
              {packagingData.rows.map((row, idx) => (
                <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/40">
                  <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {isEditingPackaging ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={row.item}
                          onChange={(e) =>
                            setPackagingLines((prev) =>
                              prev.map((line, i) => (i === idx ? { ...line, item: e.target.value } : line))
                            )
                          }
                          className="w-52 rounded-lg border-2 border-zinc-300 bg-white px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100"
                        />
                        <select
                          value={row.basis}
                          onChange={(e) =>
                            setPackagingLines((prev) =>
                              prev.map((line, i) =>
                                i === idx ? { ...line, basis: e.target.value as PackagingBasis } : line
                              )
                            )
                          }
                          className="rounded-lg border-2 border-zinc-300 bg-white px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100"
                        >
                          <option value="per_set">/set</option>
                          <option value="per_kg">/kg</option>
                          <option value="per_unit">/unit</option>
                        </select>
                        {row.basis === "per_unit" && (
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={row.unitsPerPack ?? 1}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              setPackagingLines((prev) =>
                                prev.map((line, i) =>
                                  i === idx ? { ...line, unitsPerPack: !Number.isNaN(v) && v > 0 ? v : 1 } : line
                                )
                              );
                            }}
                            className="w-20 rounded-lg border-2 border-zinc-300 bg-white px-2 py-1 text-right text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100"
                            title="Units per pack"
                          />
                        )}
                      </div>
                    ) : (
                      row.item
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {formatNumber(row.quantity, { maxDecimals: row.basis === "per_unit" ? 0 : 2 })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums">
                    {isEditingPackaging ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={toDisplayCurrency(row.costGbp)}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!Number.isNaN(v) && v >= 0) {
                            setPackagingLines((prev) =>
                              prev.map((line, i) => (i === idx ? { ...line, costGbp: v / displayRate } : line))
                            );
                          }
                        }}
                        className="w-24 rounded-lg border-2 border-zinc-300 bg-white px-2 py-1 text-right text-sm font-medium tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100"
                      />
                    ) : (
                      <span className="text-zinc-700 dark:text-zinc-300">{formatDisplayCurrency(row.costGbp)}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {units > 0 ? formatDisplayCurrency(row.costPerSet) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                    {formatDisplayCurrency(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-50 dark:bg-zinc-700/50">
                <td colSpan={3} className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Total
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {units > 0 ? formatDisplayCurrency(packagingCostPerUnit) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {formatDisplayCurrency(packagingData.grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Final product summary */}
      <div
        className={[
          "rounded-xl border-2 p-6 shadow-md",
          result.formulaValid
            ? "border-zinc-200 bg-zinc-50/80 dark:border-zinc-600 dark:bg-zinc-800/50"
            : "border-red-200 bg-red-50/60 dark:border-red-800 dark:bg-red-950/30",
        ].join(" ")}
      >
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
          Final product summary
          {!result.formulaValid && (
            <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-bold uppercase text-red-700 dark:bg-red-900/50 dark:text-red-300">
              Invalid
            </span>
          )}
        </h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 sm:block">
            <dt className="font-medium text-zinc-600 dark:text-zinc-400">Total cost</dt>
            <dd
              className={`font-semibold tabular-nums ${
                result.formulaValid ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {result.formulaValid
                ? formatDisplayCurrency(finalTotalCost)
                : `~${formatDisplayCurrency(finalTotalCost)} (partial)`}
            </dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="font-medium text-zinc-600 dark:text-zinc-400">Cost per kg</dt>
            <dd
              className={`font-semibold tabular-nums ${
                result.formulaValid ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {batchGrams > 0
                ? result.formulaValid
                  ? formatDisplayCurrency(finalCostPerKg)
                  : `~${formatDisplayCurrency(finalCostPerKg)}`
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="font-medium text-zinc-600 dark:text-zinc-400">Cost per set</dt>
            <dd
              className={`font-semibold tabular-nums ${
                result.formulaValid ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {units > 0
                ? result.formulaValid
                  ? formatDisplayCurrency(finalCostPerUnit)
                  : `~${formatDisplayCurrency(finalCostPerUnit)}`
                : "—"}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
