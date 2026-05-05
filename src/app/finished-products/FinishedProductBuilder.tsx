"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FinishedProductWithPackagingLines, PackagingItem } from "@/lib/db";
import {
  createFinishedProductAction,
  saveFinishedProductPackagingLinesAction,
  updateFinishedProductAction,
} from "@/app/actions";
import { useFx } from "@/app/FxProvider";
import { formatCurrency } from "@/lib/format";
import { calculateFinishedProductPackaging } from "@/lib/packaging";
import FinishedProductPackagingSection from "@/components/packaging/FinishedProductPackagingSection";
import {
  finishedProductToPackagingInputs,
  type PackagingLineInput,
} from "@/components/packaging/types";

type Props = {
  existingProduct?: FinishedProductWithPackagingLines;
  packagingItems: PackagingItem[];
};

export default function FinishedProductBuilder({
  existingProduct,
  packagingItems,
}: Props) {
  const router = useRouter();
  const { currency, rate: gbpToCurrencyRate } = useFx();
  const [name, setName] = useState(existingProduct?.name ?? "");
  const [sku, setSku] = useState(existingProduct?.sku ?? "");
  const [baseUnitCost, setBaseUnitCost] = useState(
    existingProduct ? String(existingProduct.base_unit_cost_gbp) : "0"
  );
  const [unitsPerPack, setUnitsPerPack] = useState(
    existingProduct ? String(existingProduct.default_units_per_pack) : "1"
  );
  const [notes, setNotes] = useState(existingProduct?.notes ?? "");
  const [packagingLines, setPackagingLines] = useState<PackagingLineInput[]>(() =>
    existingProduct ? finishedProductToPackagingInputs(existingProduct) : []
  );
  const [packagingSnapshot, setPackagingSnapshot] = useState<PackagingLineInput[]>(() =>
    existingProduct ? finishedProductToPackagingInputs(existingProduct) : []
  );
  const [isEditingPackaging, setIsEditingPackaging] = useState(true);
  const [isSavingPackaging, setIsSavingPackaging] = useState(false);
  const [masterItems, setMasterItems] = useState<PackagingItem[]>(packagingItems);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const displayRate =
    Number.isFinite(gbpToCurrencyRate) && gbpToCurrencyRate > 0 ? gbpToCurrencyRate : 1;
  const toDisplayCurrency = useCallback((gbp: number) => gbp * displayRate, [displayRate]);
  const formatDisplayCurrency = useCallback(
    (gbp: number) => formatCurrency(toDisplayCurrency(gbp), currency),
    [currency, toDisplayCurrency]
  );

  const previewUnitsPerPack = Number(unitsPerPack) > 0 ? Number(unitsPerPack) : 1;
  const previewPackaging = useMemo(
    () => calculateFinishedProductPackaging(packagingLines, previewUnitsPerPack, previewUnitsPerPack),
    [packagingLines, previewUnitsPerPack]
  );

  const savePackagingForProduct = useCallback(
    async (productId: number) => {
      await saveFinishedProductPackagingLinesAction(
        productId,
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
    },
    [packagingLines]
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);
      const parsedBaseCost = Number(baseUnitCost);
      const parsedUnitsPerPack = Number(unitsPerPack);
      if (!name.trim()) {
        setError("Product name is required.");
        return;
      }
      if (!Number.isFinite(parsedBaseCost) || parsedBaseCost < 0) {
        setError("Cost per pack must be zero or greater.");
        return;
      }
      if (!Number.isFinite(parsedUnitsPerPack) || parsedUnitsPerPack <= 0) {
        setError("Units per pack must be greater than zero.");
        return;
      }

      setIsSaving(true);
      try {
        const input = {
          name: name.trim(),
          sku: sku.trim() || null,
          defaultUnitsPerPack: parsedUnitsPerPack,
          baseUnitCostGbp: parsedBaseCost,
          notes: notes.trim() || null,
        };
        if (existingProduct) {
          await updateFinishedProductAction(existingProduct.id, input);
          await savePackagingForProduct(existingProduct.id);
          router.push(`/finished-products/${existingProduct.id}`);
        } else {
          const created = await createFinishedProductAction(input);
          await savePackagingForProduct(created.id);
          router.push(`/finished-products/${created.id}`);
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save finished product.");
      } finally {
        setIsSaving(false);
      }
    },
    [
      baseUnitCost,
      existingProduct,
      name,
      notes,
      router,
      savePackagingForProduct,
      sku,
      unitsPerPack,
    ]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 rounded-xl border-2 border-zinc-200 bg-white p-6 shadow-md dark:border-zinc-600 dark:bg-zinc-800 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Product name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-100"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            SKU
          </span>
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-100"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Cost per pack GBP
          </span>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={baseUnitCost}
            onChange={(e) => setBaseUnitCost(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-100"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Units per pack
          </span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={unitsPerPack}
            onChange={(e) => setUnitsPerPack(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-100"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Notes
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-100"
          />
        </label>
      </div>

      <FinishedProductPackagingSection
        packagingRows={previewPackaging.rows}
        grandTotal={previewPackaging.grandTotal}
        costPerUnit={previewPackaging.costPerUnit}
        costPerPack={previewPackaging.costPerPack}
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
        onSave={async () => {
          if (!existingProduct) {
            setIsEditingPackaging(false);
            return;
          }
          setIsSavingPackaging(true);
          try {
            await savePackagingForProduct(existingProduct.id);
          } finally {
            setIsSavingPackaging(false);
          }
        }}
        displayRate={displayRate}
        toDisplayCurrency={toDisplayCurrency}
        formatDisplayCurrency={formatDisplayCurrency}
        currency={currency}
        masterItems={masterItems}
        setMasterItems={setMasterItems}
      />

      <div className="flex justify-end gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : existingProduct ? "Save Finished Product" : "Create Finished Product"}
        </button>
      </div>
    </form>
  );
}
