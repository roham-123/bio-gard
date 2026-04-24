"use client";

import { useCallback, useMemo, useState } from "react";
import type { RecipeWithLines, PackagingItem, RecipeLabel } from "@/lib/db";
import {
  calculate,
  recipeToLineInputs,
  type LineInput,
  type LineResult,
} from "@/lib/calc";
import { formatCurrency, parseScientific } from "@/lib/format";
import { generateRecipePdf } from "@/lib/pdf";
import {
  saveRecipePackagingLinesAction,
  createPurchaseOrderAction,
  deleteRecipeLabelAction,
  uploadRecipeLabelAction,
} from "@/app/actions";
import { useFx } from "@/app/FxProvider";
import BatchToolbar from "./components/BatchToolbar";
import FormulaTable from "./components/FormulaTable";
import FormulaSummary from "./components/FormulaSummary";
import LabelsModal from "./components/LabelsModal";
import DeleteLabelDialog from "./components/DeleteLabelDialog";
import PackagingSection from "./components/PackagingSection";
import FinalProductSummary from "./components/FinalProductSummary";
import {
  recipeToPackagingInputs,
  type PackagingLineInput,
} from "./components/types";

type Props = {
  recipe: RecipeWithLines;
  packagingItems?: PackagingItem[];
};

export default function RecipeCalculator({
  recipe,
  packagingItems: initialPackagingItems = [],
}: Props) {
  const { currency, rate: gbpToCurrencyRate } = useFx();
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
  const [packagingSnapshot, setPackagingSnapshot] = useState<PackagingLineInput[]>(() =>
    recipeToPackagingInputs(recipe)
  );
  const [isEditingPackaging, setIsEditingPackaging] = useState(false);
  const [isSavingPackaging, setIsSavingPackaging] = useState(false);
  const [masterItems, setMasterItems] = useState<PackagingItem[]>(initialPackagingItems);

  const [labels, setLabels] = useState<RecipeLabel[]>(recipe.labels ?? []);
  const [selectedLabelId, setSelectedLabelId] = useState<number | null>(null);
  const [isLabelsModalOpen, setIsLabelsModalOpen] = useState(false);
  const [isUploadingLabel, setIsUploadingLabel] = useState(false);
  const [labelUploadError, setLabelUploadError] = useState<string | null>(null);
  const [labelToDelete, setLabelToDelete] = useState<RecipeLabel | null>(null);
  const [isDeletingLabel, setIsDeletingLabel] = useState(false);

  const [isGeneratingPo, setIsGeneratingPo] = useState(false);

  const syncBatchFromInput = useCallback(() => {
    const parsedKg = parseScientific(batchInput);
    if (!Number.isNaN(parsedKg) && parsedKg > 0) {
      const grams = parsedKg * 1000;
      setBatchGrams(grams);
      setBatchInput(String(parsedKg));
    }
  }, [batchInput]);

  const syncKgPerUnitFromInput = useCallback(() => {
    const parsed = parseScientific(kgPerUnitInput);
    if (!Number.isNaN(parsed) && parsed > 0) {
      setKgPerUnit(parsed);
      setKgPerUnitInput(String(parsed));
    }
  }, [kgPerUnitInput]);

  const result = useMemo(
    () => calculate(batchGrams, defaultBatchGrams, lineInputs),
    [batchGrams, defaultBatchGrams, lineInputs]
  );

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
        quantity = batchKg / 0.1;
      } else if (line.code === "PAIL") {
        quantity = batchKg / 10;
      } else if (line.code === "PAILLAB") {
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
  const toDisplayCurrency = useCallback(
    (gbpValue: number) => Number(gbpValue) * displayRate,
    [displayRate]
  );
  const formatDisplayCurrency = useCallback(
    (gbpValue: number) => formatCurrency(toDisplayCurrency(Number(gbpValue)), currency),
    [toDisplayCurrency, currency]
  );

  const selectedLabel = useMemo(
    () => labels.find((label) => label.id === selectedLabelId) ?? null,
    [labels, selectedLabelId]
  );

  const handleEnterEditPackaging = useCallback(() => {
    setPackagingSnapshot(packagingLines.map((line) => ({ ...line })));
    setIsEditingPackaging(true);
  }, [packagingLines]);

  const handleCancelEditPackaging = useCallback(() => {
    setPackagingLines(packagingSnapshot);
    setIsEditingPackaging(false);
  }, [packagingSnapshot]);

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
    } catch (err) {
      console.error("Failed to save packaging lines:", err);
    } finally {
      setIsSavingPackaging(false);
    }
  }, [recipe.id, packagingLines]);

  const handleUploadLabel = useCallback(
    async (file: File) => {
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
    },
    [recipe.id]
  );

  const handleConfirmDeleteLabel = useCallback(async () => {
    if (!labelToDelete) return;
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
  }, [labelToDelete, selectedLabelId]);

  const handleGeneratePurchaseOrder = useCallback(async () => {
    setIsGeneratingPo(true);
    try {
      const po = await createPurchaseOrderAction(recipe.id, recipe.name, batchGrams, units, {
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
      });
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
  }, [
    recipe.id,
    recipe.name,
    batchGrams,
    units,
    result,
    totalFinalCfuPerGram,
    packagingTotalCost,
    finalTotalCost,
    finalCostPerKg,
    finalCostPerUnit,
    selectedLabel,
    packagingData,
  ]);

  return (
    <div className="space-y-6">
      <BatchToolbar
        recipeId={recipe.id}
        batchInput={batchInput}
        setBatchInput={setBatchInput}
        onBatchCommit={syncBatchFromInput}
        batchGrams={batchGrams}
        kgPerUnitInput={kgPerUnitInput}
        setKgPerUnitInput={setKgPerUnitInput}
        onKgPerUnitCommit={syncKgPerUnitFromInput}
        kgPerUnit={kgPerUnit}
        units={units}
      />

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
            <p key={i} className="text-sm text-red-700 dark:text-red-300">
              {msg}
            </p>
          ))}
        </div>
      )}

      <FormulaTable
        lineInputs={lineInputs}
        resultByLineId={resultByLineId}
        formulaValid={result.formulaValid}
        units={units}
        formatDisplayCurrency={formatDisplayCurrency}
      />

      <FormulaSummary
        formulaValid={result.formulaValid}
        totalGrams={result.totalGrams}
        totalFinalCfuPerGram={totalFinalCfuPerGram}
        totalCost={result.totalCost}
        costPerKg={result.costPerKg}
        units={units}
        selectedLabel={selectedLabel}
        onOpenLabels={() => setIsLabelsModalOpen(true)}
        onGeneratePurchaseOrder={handleGeneratePurchaseOrder}
        isGeneratingPo={isGeneratingPo}
        formatDisplayCurrency={formatDisplayCurrency}
      />

      <LabelsModal
        open={isLabelsModalOpen}
        labels={labels}
        selectedLabelId={selectedLabelId}
        isUploading={isUploadingLabel}
        uploadError={labelUploadError}
        onClose={() => setIsLabelsModalOpen(false)}
        onSelect={setSelectedLabelId}
        onUpload={handleUploadLabel}
        onRequestDelete={setLabelToDelete}
      />

      <DeleteLabelDialog
        label={labelToDelete}
        isDeleting={isDeletingLabel}
        onCancel={() => setLabelToDelete(null)}
        onConfirm={handleConfirmDeleteLabel}
      />

      <PackagingSection
        packagingRows={packagingData.rows}
        grandTotal={packagingData.grandTotal}
        packagingCostPerKg={packagingCostPerKg}
        packagingCostPerUnit={packagingCostPerUnit}
        setPackagingLines={setPackagingLines}
        isEditing={isEditingPackaging}
        isSaving={isSavingPackaging}
        onEnterEdit={handleEnterEditPackaging}
        onCancelEdit={handleCancelEditPackaging}
        onSave={handleSavePackaging}
        batchGrams={batchGrams}
        units={units}
        displayRate={displayRate}
        toDisplayCurrency={toDisplayCurrency}
        formatDisplayCurrency={formatDisplayCurrency}
        currency={currency}
        masterItems={masterItems}
        setMasterItems={setMasterItems}
      />

      <FinalProductSummary
        formulaValid={result.formulaValid}
        batchGrams={batchGrams}
        units={units}
        finalTotalCost={finalTotalCost}
        finalCostPerKg={finalCostPerKg}
        finalCostPerUnit={finalCostPerUnit}
        formatDisplayCurrency={formatDisplayCurrency}
      />
    </div>
  );
}
