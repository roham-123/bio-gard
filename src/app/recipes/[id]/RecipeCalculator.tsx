"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { RecipeWithLines, PackagingItem } from "@/lib/db";
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
import {
  saveRecipePackagingLinesAction,
  createPackagingItemAction,
  createPurchaseOrderAction,
  deleteRecipeLabelAction,
  uploadRecipeLabelAction,
} from "@/app/actions";

type Props = {
  recipe: RecipeWithLines;
  currency: CurrencyCode;
  gbpToCurrencyRate: number;
  packagingItems?: PackagingItem[];
};

type PackagingBasis = "per_set" | "per_kg" | "per_unit";

type PackagingLineInput = {
  id: string;
  code: string;
  item: string;
  basis: PackagingBasis;
  costGbp: number;
  unitsPerPack?: number;
  quantitySource?: "sets" | "kg";
  quantityMultiplier?: number;
};

function recipeToPackagingInputs(recipe: RecipeWithLines): PackagingLineInput[] {
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

export default function RecipeCalculator({ recipe, currency, gbpToCurrencyRate, packagingItems: initialPackagingItems = [] }: Props) {
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
    recipeToPackagingInputs(recipe)
  );
  const [labels, setLabels] = useState(recipe.labels ?? []);
  const [selectedLabelId, setSelectedLabelId] = useState<number | null>(null);
  const [isUploadingLabel, setIsUploadingLabel] = useState(false);
  const [labelUploadError, setLabelUploadError] = useState<string | null>(null);
  const [isLabelsModalOpen, setIsLabelsModalOpen] = useState(false);
  const [labelToDelete, setLabelToDelete] = useState<(typeof labels)[number] | null>(null);
  const [isDeletingLabel, setIsDeletingLabel] = useState(false);
  const [isEditingPackaging, setIsEditingPackaging] = useState(false);
  const [packagingSnapshot, setPackagingSnapshot] = useState<PackagingLineInput[]>(() =>
    recipeToPackagingInputs(recipe)
  );
  const [masterItems, setMasterItems] = useState<PackagingItem[]>(initialPackagingItems);
  const [isSavingPackaging, setIsSavingPackaging] = useState(false);
  const [isGeneratingPo, setIsGeneratingPo] = useState(false);
  const [showAddLine, setShowAddLine] = useState(false);
  const [addMode, setAddMode] = useState<"existing" | "new">("existing");
  const [selectedMasterCode, setSelectedMasterCode] = useState("");
  const [newItemCode, setNewItemCode] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemCost, setNewItemCost] = useState("");
  const [newItemBasis, setNewItemBasis] = useState<PackagingBasis>("per_set");
  const [newItemUnitsPerPack, setNewItemUnitsPerPack] = useState("");
  const [newItemQuantitySource, setNewItemQuantitySource] = useState<"sets" | "kg">("sets");
  const [newItemMultiplier, setNewItemMultiplier] = useState("1");

  const resetAddForm = useCallback(() => {
    setShowAddLine(false);
    setAddMode("existing");
    setSelectedMasterCode("");
    setNewItemCode("");
    setNewItemName("");
    setNewItemCost("");
    setNewItemBasis("per_set");
    setNewItemUnitsPerPack("");
    setNewItemQuantitySource("sets");
    setNewItemMultiplier("1");
  }, []);

  const handleAddLine = useCallback(async () => {
    if (addMode === "existing") {
      const master = masterItems.find((m) => m.code === selectedMasterCode);
      if (!master) return;
      const basis = master.default_cost_basis === "per_kg" ? "per_kg" : master.default_cost_basis === "per_unit" ? "per_unit" : "per_set";
      setPackagingLines((prev) => [
        ...prev,
        {
          id: `new-${Date.now()}`,
          code: master.code,
          item: master.name,
          basis: basis as PackagingBasis,
          costGbp: master.default_cost_gbp,
          unitsPerPack: undefined,
          quantitySource: basis === "per_kg" ? "kg" : "sets",
          quantityMultiplier: 1,
        },
      ]);
    } else {
      const code = newItemCode.trim().toUpperCase();
      const name = newItemName.trim();
      const cost = parseFloat(newItemCost);
      if (!code || !name || Number.isNaN(cost) || cost < 0) return;
      try {
        const created = await createPackagingItemAction(code, name, cost, newItemBasis === "per_kg" ? "per_kg" : newItemBasis === "per_unit" ? "per_unit" : "per_unit");
        setMasterItems((prev) => [...prev, created]);
      } catch {
        // item may already exist if code collision – that's fine, continue adding line
      }
      const mult = parseFloat(newItemMultiplier) || 1;
      const upp = newItemUnitsPerPack ? parseFloat(newItemUnitsPerPack) : undefined;
      setPackagingLines((prev) => [
        ...prev,
        {
          id: `new-${Date.now()}`,
          code,
          item: name,
          basis: newItemBasis,
          costGbp: cost,
          unitsPerPack: upp && upp > 0 ? upp : undefined,
          quantitySource: newItemBasis === "per_unit" ? "sets" : newItemQuantitySource,
          quantityMultiplier: newItemBasis === "per_unit" ? 1 : mult > 0 ? mult : 1,
        },
      ]);
    }
    resetAddForm();
  }, [addMode, masterItems, selectedMasterCode, newItemCode, newItemName, newItemCost, newItemBasis, newItemUnitsPerPack, newItemQuantitySource, newItemMultiplier, resetAddForm]);

  const handleDeleteLine = useCallback((idx: number) => {
    setPackagingLines((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSavePackaging = useCallback(async () => {
    setIsSavingPackaging(true);
    try {
      await saveRecipePackagingLinesAction(
        recipe.id,
        packagingLines.map((line, i) => ({
          packagingItemCode: line.code,
          sortOrder: i + 1,
          usageBasis: line.basis,
          costGbp: line.costGbp,
          quantityMultiplier: line.quantityMultiplier ?? 1,
          unitsPerPack: line.unitsPerPack ?? null,
          quantitySource:
            line.basis === "per_kg"
              ? ("kg" as const)
              : line.basis === "per_unit"
                ? ("sets" as const)
                : ((line.quantitySource ?? "sets") as "sets" | "kg"),
        }))
      );
      setPackagingSnapshot(packagingLines.map((l) => ({ ...l })));
      setIsEditingPackaging(false);
      resetAddForm();
    } catch (err) {
      console.error("Failed to save packaging lines:", err);
    } finally {
      setIsSavingPackaging(false);
    }
  }, [recipe.id, packagingLines, resetAddForm]);

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
      const effectiveCostGbp =
        line.code === "SACH100G" ? (batchKg >= 100 ? 0.1 : 0.2) : line.costGbp;
      let quantity = 0;
      if (line.code === "SACH100G") {
        // SACH100G quantity is number of 100g sachets in the batch.
        quantity = batchKg / 0.1;
      } else if (line.code === "PAIL") {
        // PAIL is always 1 pail per 10kg of product.
        quantity = batchKg / 10;
      } else if (line.code === "PAILLAB") {
        // PAILLAB is always 1 label per pail.
        quantity = batchKg / 10;
      } else if (line.basis === "per_kg") quantity = batchKg;
      else if (line.basis === "per_set") quantity = sets;
      else {
        const unitsPerSet = line.unitsPerPack && line.unitsPerPack > 0 ? line.unitsPerPack : 1;
        quantity = sets * unitsPerSet;
      }
      const multiplier = line.quantityMultiplier && line.quantityMultiplier > 0 ? line.quantityMultiplier : 1;
      quantity *= multiplier;
      const total = quantity * effectiveCostGbp;
      const costPerSet = sets > 0 ? total / sets : 0;
      return { ...line, effectiveCostGbp, quantity, total, costPerSet };
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
  const groupedMasterItems = useMemo(() => {
    const groups = new Map<string, PackagingItem[]>();

    for (const item of masterItems) {
      const dashIndex = item.code.indexOf("-");
      const groupName = dashIndex > 0 ? item.code.slice(0, dashIndex) : "Generic";
      const existing = groups.get(groupName) ?? [];
      existing.push(item);
      groups.set(groupName, existing);
    }

    const orderedGroupNames = Array.from(groups.keys()).sort((a, b) => {
      if (a === "Generic") return -1;
      if (b === "Generic") return 1;
      return a.localeCompare(b);
    });

    return orderedGroupNames.map((groupName) => ({
      groupName,
      items: (groups.get(groupName) ?? []).sort((a, b) => a.code.localeCompare(b.code)),
    }));
  }, [masterItems]);
  const selectedLabel = useMemo(
    () => labels.find((label) => label.id === selectedLabelId) ?? null,
    [labels, selectedLabelId]
  );

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
                  <td className="whitespace-nowrap px-3 py-3 text-sm font-mono font-bold text-zinc-700 dark:text-zinc-200">
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
                    {res ? formatNumber(Math.round(res.grams), { maxDecimals: 0 }) : "—"}
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
          Microbial Formula Summary
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
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsLabelsModalOpen(true)}
              className="rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 dark:focus:ring-offset-zinc-800"
            >
              Labels
            </button>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {selectedLabel ? `Selected: ${selectedLabel.file_name}` : "No label selected"}
            </span>
          </div>
          <button
            type="button"
            disabled={!result.formulaValid || isGeneratingPo}
            onClick={async () => {
              setIsGeneratingPo(true);
              try {
                const po = await createPurchaseOrderAction(
                  recipe.id,
                  recipe.name,
                  batchGrams,
                  units,
                  {
                    totalGrams: result.totalGrams,
                    totalCfu: totalFinalCfuPerGram,
                    formulaTotalCost: result.totalCost,
                    formulaCostPerKg: result.costPerKg,
                    formulaCostPerSet: units > 0 ? result.totalCost / units : null,
                    packagingTotalCost,
                    packagingCostPerSet: units > 0 ? packagingTotalCost / units : null,
                    finalTotalCost,
                    finalCostPerKg,
                    finalCostPerSet: units > 0 ? finalCostPerUnit : null,
                    selectedLabel:
                      selectedLabel != null
                        ? {
                            id: selectedLabel.id,
                            fileName: selectedLabel.file_name,
                            mimeType: selectedLabel.mime_type,
                            blobUrl: selectedLabel.blob_url,
                          }
                        : null,
                    ingredients: result.results.map((r) => ({
                      ingredientId: r.ingredientId,
                      ingredientName: r.ingredientName,
                      grams: r.grams,
                      kg: r.grams / 1000,
                      percent: r.percent,
                      isBacteria: r.isBacteria,
                      stockCfuPerG: r.stockCfuPerG,
                      targetTotalCfu: r.targetTotalCfu,
                      finalCfuPerGram: r.finalCfuPerGram,
                      costPerKgGbp: r.costPerKgGbp,
                      costInProduct: r.costInProduct,
                    })),
                    packaging: packagingData.rows.map((row) => ({
                      code: row.code,
                      item: row.item,
                      quantity: row.quantity,
                      costGbp: row.effectiveCostGbp,
                      costPerSet: row.costPerSet,
                      total: row.total,
                    })),
                  }
                );
                await generateRecipePdf(
                  recipe.name,
                  batchGrams,
                  units,
                  result.results,
                  packagingData.rows.map((row) => ({
                    item: row.item,
                    quantity: row.quantity,
                    costGbp: row.effectiveCostGbp,
                    costPerSetGbp: row.costPerSet,
                    totalGbp: row.total,
                  })),
                  {
                    totalGrams: result.totalGrams,
                    totalCfu: totalFinalCfuPerGram,
                    formulaTotalCost: result.totalCost,
                    formulaCostPerKg: result.costPerKg,
                    formulaCostPerSet: units > 0 ? result.totalCost / units : undefined,
                    packagingTotalCost,
                    packagingCostPerSet: units > 0 ? packagingTotalCost / units : undefined,
                    finalTotalCost,
                    finalCostPerKg,
                    finalCostPerSet: units > 0 ? finalCostPerUnit : undefined,
                  },
                  po.po_reference,
                  selectedLabel != null
                    ? {
                        fileName: selectedLabel.file_name,
                        mimeType: selectedLabel.mime_type,
                        blobUrl: selectedLabel.blob_url,
                      }
                    : undefined
                );
              } catch (err) {
                console.error("Failed to generate purchase order:", err);
              } finally {
                setIsGeneratingPo(false);
              }
            }}
            className={[
              "rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2",
              result.formulaValid && !isGeneratingPo
                ? "bg-zinc-800 text-white hover:bg-zinc-700 focus:ring-zinc-500 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:ring-offset-zinc-800"
                : "cursor-not-allowed bg-zinc-300 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-500",
            ].join(" ")}
          >
            {isGeneratingPo
              ? "Generating…"
              : result.formulaValid
                ? "Generate Purchase Order"
                : "Purchase order unavailable — fix formula"}
          </button>
        </div>
      </div>

      {isLabelsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 p-4">
          <div className="w-full max-w-4xl rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-600 dark:bg-zinc-800">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                Labels
              </h3>
              <div className="flex items-center gap-2">
                {selectedLabelId != null && (
                  <button
                    type="button"
                    onClick={() => setIsLabelsModalOpen(false)}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Done
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsLabelsModalOpen(false)}
                  className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                >
                  Close
                </button>
              </div>
            </div>
            <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
              Upload JPG, PNG, or PDF. Click a label to select it for the purchase order.
            </p>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                disabled={isUploadingLabel}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.currentTarget.value = "";
                  if (!file) return;
                  setIsUploadingLabel(true);
                  setLabelUploadError(null);
                  try {
                    const created = await uploadRecipeLabelAction(recipe.id, file);
                    setLabels((prev) => [created, ...prev]);
                  } catch (err) {
                    setLabelUploadError(err instanceof Error ? err.message : "Upload failed.");
                  } finally {
                    setIsUploadingLabel(false);
                  }
                }}
                className="text-sm text-zinc-700 file:mr-3 file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-zinc-700 hover:file:bg-zinc-50 dark:text-zinc-300 dark:file:border-zinc-600 dark:file:bg-zinc-700 dark:file:text-zinc-200 dark:hover:file:bg-zinc-600"
              />
              {isUploadingLabel && <span className="text-xs text-zinc-500 dark:text-zinc-400">Uploading…</span>}
            </div>
            {labelUploadError && (
              <p className="mb-3 text-xs font-medium text-red-600 dark:text-red-300">{labelUploadError}</p>
            )}
            {labels.length === 0 ? (
              <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-600 dark:text-zinc-400">
                No labels uploaded yet.
              </p>
            ) : (
              <div className="grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {labels.map((label) => {
                  const isSelected = selectedLabelId === label.id;
                  const isImage = label.mime_type === "image/jpeg" || label.mime_type === "image/png";
                  return (
                    <div
                      key={label.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedLabelId(label.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedLabelId(label.id);
                        }
                      }}
                      className={`relative rounded-lg border p-2 text-left transition-colors ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-900/20"
                          : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-700/40 dark:hover:bg-zinc-700"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLabelToDelete(label);
                        }}
                        className="absolute right-2 top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-500 shadow-sm transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                        aria-label={`Delete ${label.file_name}`}
                        title="Delete label"
                      >
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
                          <path d="M6 6L14 14M14 6L6 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      </button>
                      <div className="mb-2 overflow-hidden rounded border border-zinc-200 bg-white dark:border-zinc-600 dark:bg-zinc-800">
                        {isImage ? (
                          <Image
                            src={label.blob_url}
                            alt={label.file_name}
                            width={640}
                            height={360}
                            className="h-36 w-full object-contain"
                          />
                        ) : (
                          <div className="flex h-36 w-full items-center justify-center text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                            PDF
                          </div>
                        )}
                      </div>
                      <div className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-200">
                        {label.file_name}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {labelToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-600 dark:bg-zinc-800">
            <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              Delete label?
            </h4>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{labelToDelete.file_name}</span>?
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">This action cannot be undone.</p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isDeletingLabel}
                onClick={() => setLabelToDelete(null)}
                className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingLabel}
                onClick={async () => {
                  setIsDeletingLabel(true);
                  setLabelUploadError(null);
                  try {
                    await deleteRecipeLabelAction(labelToDelete.id);
                    setLabels((prev) => prev.filter((label) => label.id !== labelToDelete.id));
                    if (selectedLabelId === labelToDelete.id) {
                      setSelectedLabelId(null);
                    }
                    setLabelToDelete(null);
                  } catch (err) {
                    setLabelUploadError(err instanceof Error ? err.message : "Delete failed.");
                  } finally {
                    setIsDeletingLabel(false);
                  }
                }}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeletingLabel ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  disabled={isSavingPackaging}
                  onClick={handleSavePackaging}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-zinc-800"
                >
                  {isSavingPackaging ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  disabled={isSavingPackaging}
                  onClick={() => {
                    setPackagingLines(packagingSnapshot);
                    setIsEditingPackaging(false);
                    resetAddForm();
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
                {isEditingPackaging && <th className="w-10 px-2 py-3" />}
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">ID</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Item</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Quantity</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Cost/Unit</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Cost/kg</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Cost/Set</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Total Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-600">
              {packagingData.rows.map((row, idx) => (
                <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/40">
                  {isEditingPackaging && (
                    <td className="px-2 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteLine(idx)}
                        className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                        title="Remove line"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {row.code}
                  </td>
                  <td className="px-4 py-3 text-sm font-normal text-zinc-900 dark:text-zinc-100">
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
                          <>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={row.unitsPerPack ?? 1}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                setPackagingLines((prev) =>
                                  prev.map((line, i) =>
                                    i === idx ? { ...line, unitsPerPack: !Number.isNaN(v) && v > 0 ? v : 1 } : line
                                  )
                                );
                              }}
                              className="w-20 rounded-lg border-2 border-zinc-300 bg-white px-2 py-1 text-right text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100"
                              title="Units per set"
                            />
                            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">/set</span>
                          </>
                        )}
                      </div>
                    ) : (
                      row.item
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {formatNumber(row.quantity, { maxDecimals: 2 })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {isEditingPackaging && row.code !== "SACH100G" ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={toDisplayCurrency(row.costGbp)}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isNaN(v) || v < 0) return;
                          setPackagingLines((prev) =>
                            prev.map((line, i) => (i === idx ? { ...line, costGbp: v / displayRate } : line))
                          );
                        }}
                        className="w-24 rounded-lg border-2 border-zinc-300 bg-white px-2 py-1 text-right text-sm font-medium tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100"
                      />
                    ) : (
                      formatDisplayCurrency(row.effectiveCostGbp)
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {isEditingPackaging && row.code !== "SACH100G" ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={batchGrams > 0 ? toDisplayCurrency(row.total / (batchGrams / 1000)) : 0}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          const batchKg = batchGrams / 1000;
                          if (Number.isNaN(v) || v < 0 || batchKg <= 0 || row.quantity <= 0) return;
                          const targetTotalGbp = (v / displayRate) * batchKg;
                          const nextCostGbp = targetTotalGbp / row.quantity;
                          setPackagingLines((prev) =>
                            prev.map((line, i) => (i === idx ? { ...line, costGbp: nextCostGbp } : line))
                          );
                        }}
                        className="w-24 rounded-lg border-2 border-zinc-300 bg-white px-2 py-1 text-right text-sm font-medium tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100"
                      />
                    ) : batchGrams > 0 ? (
                      formatDisplayCurrency(row.total / (batchGrams / 1000))
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {isEditingPackaging && row.code !== "SACH100G" ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={units > 0 ? toDisplayCurrency(row.costPerSet) : 0}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isNaN(v) || v < 0 || units <= 0 || row.quantity <= 0) return;
                          const targetTotalGbp = (v / displayRate) * units;
                          const nextCostGbp = targetTotalGbp / row.quantity;
                          setPackagingLines((prev) =>
                            prev.map((line, i) => (i === idx ? { ...line, costGbp: nextCostGbp } : line))
                          );
                        }}
                        className="w-24 rounded-lg border-2 border-zinc-300 bg-white px-2 py-1 text-right text-sm font-medium tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100"
                      />
                    ) : units > 0 ? (
                      formatDisplayCurrency(row.costPerSet)
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                    {formatDisplayCurrency(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-50 dark:bg-zinc-700/50">
                <td colSpan={isEditingPackaging ? 5 : 4} className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Total
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {batchGrams > 0 ? formatDisplayCurrency(packagingCostPerKg) : "—"}
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

        {isEditingPackaging && (
          <div className="mt-4">
            {!showAddLine ? (
              <button
                type="button"
                onClick={() => setShowAddLine(true)}
                className="rounded-lg border-2 border-dashed border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:border-emerald-400 hover:text-emerald-600 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
              >
                + Add packaging line
              </button>
            ) : (
              <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-800 dark:bg-emerald-950/20">
                <div className="mb-3 flex items-center gap-3">
                  <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Source:</label>
                  <select
                    value={addMode}
                    onChange={(e) => setAddMode(e.target.value as "existing" | "new")}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                  >
                    <option value="existing">Choose from master list</option>
                    <option value="new">Create new item</option>
                  </select>
                </div>

                {addMode === "existing" ? (
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Item</label>
                      <select
                        value={selectedMasterCode}
                        onChange={(e) => setSelectedMasterCode(e.target.value)}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                      >
                        <option value="">Select item…</option>
                        {groupedMasterItems.map(({ groupName, items }) => (
                          <optgroup key={groupName} label={groupName}>
                            {items.map((item) => (
                              <option key={item.code} value={item.code}>
                                {item.code} — {item.name} ({formatDisplayCurrency(item.default_cost_gbp)})
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      disabled={!selectedMasterCode}
                      onClick={handleAddLine}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40 dark:focus:ring-offset-zinc-800"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={resetAddForm}
                      className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">ID Code</label>
                        <input
                          type="text"
                          value={newItemCode}
                          onChange={(e) => setNewItemCode(e.target.value.toUpperCase())}
                          placeholder="e.g. SACH50G"
                          className="w-32 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-mono uppercase focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Name</label>
                        <input
                          type="text"
                          value={newItemName}
                          onChange={(e) => setNewItemName(e.target.value)}
                          placeholder="e.g. 50g Sachets"
                          className="w-48 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Cost ({currency})</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newItemCost}
                          onChange={(e) => setNewItemCost(e.target.value)}
                          placeholder="0.00"
                          className="w-24 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Basis</label>
                        <select
                          value={newItemBasis}
                          onChange={(e) => setNewItemBasis(e.target.value as PackagingBasis)}
                          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                        >
                          <option value="per_set">/set</option>
                          <option value="per_kg">/kg</option>
                          <option value="per_unit">/unit</option>
                        </select>
                      </div>
                    </div>
                    {newItemBasis === "per_unit" && (
                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Units needed per set</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={newItemUnitsPerPack}
                              onChange={(e) => setNewItemUnitsPerPack(e.target.value)}
                              placeholder="e.g. 4"
                              className="w-20 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                            />
                            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">/set</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button
                        type="button"
                        disabled={!newItemCode.trim() || !newItemName.trim() || !newItemCost}
                        onClick={handleAddLine}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40 dark:focus:ring-offset-zinc-800"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={resetAddForm}
                        className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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
