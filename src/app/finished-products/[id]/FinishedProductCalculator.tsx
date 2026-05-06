"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type { FinishedProductWithPackagingLines, PackagingItem } from "@/lib/db";
import {
  createFinishedProductPurchaseOrderAction,
  deleteFinishedProductLabelAction,
  saveFinishedProductPackagingLinesAction,
  uploadFinishedProductLabelAction,
} from "@/app/actions";
import { useFx } from "@/app/FxProvider";
import { formatCurrency, formatNumber } from "@/lib/format";
import { calculateFinishedProductPackaging } from "@/lib/packaging";
import { generateFinishedProductPdf } from "@/lib/pdf";
import { useEntityLabels } from "@/lib/hooks/useEntityLabels";
import FinishedProductPackagingSection from "@/components/packaging/FinishedProductPackagingSection";
import LabelsModal from "@/components/labels/LabelsModal";
import DeleteLabelDialog from "@/components/labels/DeleteLabelDialog";
import {
  finishedProductToPackagingInputs,
  type PackagingLineInput,
} from "@/components/packaging/types";

type Props = {
  product: FinishedProductWithPackagingLines;
  packagingItems: PackagingItem[];
};

export default function FinishedProductCalculator({ product, packagingItems }: Props) {
  const { currency, rate: gbpToCurrencyRate } = useFx();
  const [packsInput, setPacksInput] = useState("1");
  const [unitsPerPackInput, setUnitsPerPackInput] = useState(String(product.default_units_per_pack));
  const [packagingLines, setPackagingLines] = useState<PackagingLineInput[]>(() =>
    finishedProductToPackagingInputs(product)
  );
  const [packagingSnapshot, setPackagingSnapshot] = useState<PackagingLineInput[]>(() =>
    finishedProductToPackagingInputs(product)
  );
  const [isEditingPackaging, setIsEditingPackaging] = useState(false);
  const [isSavingPackaging, setIsSavingPackaging] = useState(false);
  const [masterItems, setMasterItems] = useState<PackagingItem[]>(packagingItems);
  const [isGeneratingPo, setIsGeneratingPo] = useState(false);

  const {
    labels,
    selectedLabel,
    selectedLabelId,
    setSelectedLabelId,
    isLabelsModalOpen,
    openModal: openLabelsModal,
    closeModal: closeLabelsModal,
    isUploadingLabel,
    labelUploadError,
    handleUpload: handleUploadLabel,
    labelToDelete,
    setLabelToDelete,
    cancelDelete: cancelDeleteLabel,
    isDeletingLabel,
    handleConfirmDelete: handleConfirmDeleteLabel,
  } = useEntityLabels({
    initial: product.labels ?? [],
    upload: useCallback(
      (file: File) => uploadFinishedProductLabelAction(product.id, file),
      [product.id]
    ),
    remove: useCallback((labelId: number) => deleteFinishedProductLabelAction(labelId), []),
  });

  const packs = Number(packsInput) > 0 ? Number(packsInput) : 0;
  const unitsPerPack = Number(unitsPerPackInput) > 0 ? Number(unitsPerPackInput) : 1;
  const totalUnits = packs * unitsPerPack;
  const packCost = Number(product.base_unit_cost_gbp);

  const packagingData = useMemo(
    () => calculateFinishedProductPackaging(packagingLines, totalUnits, unitsPerPack),
    [packagingLines, totalUnits, unitsPerPack]
  );

  const productPackTotalCost = packCost * packs;
  const finalTotalCost = productPackTotalCost + packagingData.grandTotal;
  const finalCostPerUnit = totalUnits > 0 ? finalTotalCost / totalUnits : 0;
  const finalCostPerPack = packs > 0 ? finalTotalCost / packs : 0;

  const displayRate =
    Number.isFinite(gbpToCurrencyRate) && gbpToCurrencyRate > 0 ? gbpToCurrencyRate : 1;
  const toDisplayCurrency = useCallback((gbp: number) => gbp * displayRate, [displayRate]);
  const formatDisplayCurrency = useCallback(
    (gbp: number) => formatCurrency(toDisplayCurrency(gbp), currency),
    [currency, toDisplayCurrency]
  );
  const handleSavePackaging = useCallback(async () => {
    setIsSavingPackaging(true);
    try {
      await saveFinishedProductPackagingLinesAction(
        product.id,
        packagingLines.map((line, index) => ({
          packagingItemCode: line.code,
          sortOrder: index + 1,
          usageBasis: line.basis === "per_pack" ? "per_pack" : "per_unit",
          costGbp: line.costGbp,
          quantityMultiplier: line.quantityMultiplier ?? 1,
          unitsPerPack: line.unitsPerPack ?? null,
        }))
      );
      setPackagingSnapshot(packagingLines.map((line) => ({ ...line })));
      setIsEditingPackaging(false);
    } finally {
      setIsSavingPackaging(false);
    }
  }, [packagingLines, product.id]);

  const handleGeneratePurchaseOrder = useCallback(async () => {
    setIsGeneratingPo(true);
    try {
      const detail = {
        version: 1,
        sourceType: "finished_product",
        productName: product.name,
        sku: product.sku,
        units: totalUnits,
        unitsPerPack,
        packs,
        costPerPackGbp: packCost,
        baseUnitCostGbp: packCost,
        productTotalCost: productPackTotalCost,
        packagingTotalCost: packagingData.grandTotal,
        packagingCostPerUnit: packagingData.costPerUnit,
        packagingCostPerPack: packagingData.costPerPack,
        finalTotalCost,
        finalCostPerUnit,
        finalCostPerPack,
        packaging: packagingData.rows.map((row) => ({
          code: row.code,
          item: row.item,
          basis: row.basis,
          quantity: row.quantity,
          costGbp: row.effectiveCostGbp,
          costPerUnit: row.costPerUnit,
          costPerPack: row.costPerPack,
          total: row.total,
        })),
      };
      const po = await createFinishedProductPurchaseOrderAction(
        product.id,
        product.name,
        totalUnits,
        detail
      );
      await generateFinishedProductPdf(
        product.name,
        totalUnits,
        unitsPerPack,
        packagingData.rows.map((row) => ({
          item: row.item,
          quantity: row.quantity,
          costGbp: row.effectiveCostGbp,
          costPerSetGbp: row.costPerUnit,
          totalGbp: row.total,
        })),
        {
          packs,
          baseUnitCost: packCost,
          productTotalCost: productPackTotalCost,
          packagingTotalCost: packagingData.grandTotal,
          packagingCostPerUnit: packagingData.costPerUnit,
          packagingCostPerPack: packagingData.costPerPack,
          finalTotalCost,
          finalCostPerUnit,
          finalCostPerPack,
        },
        po.po_reference,
        currency,
        displayRate,
        selectedLabel != null
          ? {
              fileName: selectedLabel.file_name,
              mimeType: selectedLabel.mime_type,
              blobUrl: selectedLabel.blob_url,
            }
          : undefined
      );
    } finally {
      setIsGeneratingPo(false);
    }
  }, [
    finalCostPerPack,
    finalCostPerUnit,
    finalTotalCost,
    packagingData,
    packs,
    packCost,
    product,
    productPackTotalCost,
    selectedLabel,
    totalUnits,
    unitsPerPack,
    currency,
    displayRate,
  ]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border-2 border-zinc-200 bg-white p-6 shadow-md dark:border-zinc-600 dark:bg-zinc-800">
        <div className="flex flex-wrap items-end gap-4">
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Packs
            </span>
            <input
              type="number"
              min="0"
              step="1"
              value={packsInput}
              onChange={(e) => setPacksInput(e.target.value)}
              className="w-40 rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-100"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Units per pack
            </span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={unitsPerPackInput}
              onChange={(e) => setUnitsPerPackInput(e.target.value)}
              className="w-40 rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-100"
            />
          </label>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Units:{" "}
            <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {formatNumber(totalUnits, { maxDecimals: 2 })}
            </span>
          </div>
          <Link
            href={`/finished-products/${product.id}/edit`}
            className="ml-auto rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
          >
            Edit product
          </Link>
        </div>
      </div>

      <div className="rounded-xl border-2 border-zinc-200 bg-zinc-50/80 p-6 shadow-md dark:border-zinc-600 dark:bg-zinc-800/50">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
          Finished Product Summary
        </h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 sm:block">
            <dt className="font-medium text-zinc-600 dark:text-zinc-400">Cost per unit</dt>
            <dd className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {totalUnits > 0 ? formatDisplayCurrency(finalCostPerUnit) : "-"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="font-medium text-zinc-600 dark:text-zinc-400">Cost per pack</dt>
            <dd className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {packs > 0 ? formatDisplayCurrency(finalCostPerPack) : "-"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="font-medium text-zinc-600 dark:text-zinc-400">Packaging total</dt>
            <dd className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {formatDisplayCurrency(packagingData.grandTotal)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="font-medium text-zinc-600 dark:text-zinc-400">Product total</dt>
            <dd className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {formatDisplayCurrency(finalTotalCost)}
            </dd>
          </div>
        </dl>
        <div className="mt-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={openLabelsModal}
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
            disabled={isGeneratingPo || unitsPerPack <= 0 || packs <= 0}
            onClick={handleGeneratePurchaseOrder}
            className="rounded-lg bg-zinc-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500"
          >
            {isGeneratingPo ? "Generating..." : "Generate Purchase Order"}
          </button>
        </div>
      </div>

      <LabelsModal
        open={isLabelsModalOpen}
        labels={labels}
        selectedLabelId={selectedLabelId}
        isUploading={isUploadingLabel}
        uploadError={labelUploadError}
        onClose={closeLabelsModal}
        onSelect={setSelectedLabelId}
        onUpload={handleUploadLabel}
        onRequestDelete={setLabelToDelete}
      />

      <DeleteLabelDialog
        label={labelToDelete}
        isDeleting={isDeletingLabel}
        onCancel={cancelDeleteLabel}
        onConfirm={handleConfirmDeleteLabel}
      />

      <FinishedProductPackagingSection
        packagingRows={packagingData.rows}
        grandTotal={packagingData.grandTotal}
        costPerUnit={packagingData.costPerUnit}
        costPerPack={packagingData.costPerPack}
        setPackagingLines={setPackagingLines}
        isEditing={isEditingPackaging}
        isSaving={isSavingPackaging}
        onEnterEdit={() => {
          setPackagingSnapshot(packagingLines.map((line) => ({ ...line })));
          setIsEditingPackaging(true);
        }}
        onCancelEdit={() => {
          setPackagingLines(packagingSnapshot);
          setIsEditingPackaging(false);
        }}
        onSave={handleSavePackaging}
        displayRate={displayRate}
        toDisplayCurrency={toDisplayCurrency}
        formatDisplayCurrency={formatDisplayCurrency}
        currency={currency}
        masterItems={masterItems}
        setMasterItems={setMasterItems}
      />
    </div>
  );
}
