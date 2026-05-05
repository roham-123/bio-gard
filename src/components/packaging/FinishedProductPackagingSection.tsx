"use client";

import { useCallback, useState } from "react";
import type { PackagingItem } from "@/lib/db";
import { formatNumber, type CurrencyCode } from "@/lib/format";
import { createPackagingItemAction } from "@/app/actions";
import type { PackagingLineInput, PackagingRow, FinishedProductPackagingBasis } from "./types";
import { groupPackagingMasterItems } from "./utils";

type Props = {
  packagingRows: PackagingRow[];
  grandTotal: number;
  costPerUnit: number;
  costPerPack?: number;
  setPackagingLines: React.Dispatch<React.SetStateAction<PackagingLineInput[]>>;
  isEditing: boolean;
  isSaving: boolean;
  onEnterEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => Promise<void> | void;
  displayRate: number;
  toDisplayCurrency: (gbp: number) => number;
  formatDisplayCurrency: (gbp: number) => string;
  currency: CurrencyCode;
  masterItems: PackagingItem[];
  setMasterItems: React.Dispatch<React.SetStateAction<PackagingItem[]>>;
};

export default function FinishedProductPackagingSection({
  packagingRows,
  grandTotal,
  costPerUnit,
  costPerPack = 0,
  setPackagingLines,
  isEditing,
  isSaving,
  onEnterEdit,
  onCancelEdit,
  onSave,
  displayRate,
  toDisplayCurrency,
  formatDisplayCurrency,
  currency,
  masterItems,
  setMasterItems,
}: Props) {
  const [showAddLine, setShowAddLine] = useState(false);
  const [addMode, setAddMode] = useState<"existing" | "new">("existing");
  const [selectedMasterCode, setSelectedMasterCode] = useState("");
  const [newItemCode, setNewItemCode] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemCost, setNewItemCost] = useState("");
  const [newItemBasis, setNewItemBasis] = useState<FinishedProductPackagingBasis>("per_unit");
  const [newItemMultiplier, setNewItemMultiplier] = useState("1");

  const resetAddForm = useCallback(() => {
    setShowAddLine(false);
    setAddMode("existing");
    setSelectedMasterCode("");
    setNewItemCode("");
    setNewItemName("");
    setNewItemCost("");
    setNewItemBasis("per_unit");
    setNewItemMultiplier("1");
  }, []);

  const groupedMasterItems = groupPackagingMasterItems(masterItems);

  const handleAddLine = useCallback(async () => {
    if (addMode === "existing") {
      const master = masterItems.find((item) => item.code === selectedMasterCode);
      if (!master) return;
      setPackagingLines((prev) => [
        ...prev,
        {
          id: `new-${Date.now()}`,
          code: master.code,
          item: master.name,
          basis: "per_unit",
          costGbp: master.default_cost_gbp,
          quantitySource: "units",
          quantityMultiplier: 1,
        },
      ]);
      resetAddForm();
      return;
    }

    const code = newItemCode.trim().toUpperCase();
    const name = newItemName.trim();
    const cost = parseFloat(newItemCost);
    const multiplier = parseFloat(newItemMultiplier);
    if (!code || !name || Number.isNaN(cost) || cost < 0) return;

    try {
      const created = await createPackagingItemAction(code, name, cost, "per_unit");
      setMasterItems((prev) => [...prev, created]);
    } catch {
      // Continue adding the profile line if the packaging master already exists.
    }

    setPackagingLines((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        code,
        item: name,
        basis: newItemBasis,
        costGbp: cost,
        quantitySource: newItemBasis === "per_pack" ? "packs" : "units",
        quantityMultiplier: !Number.isNaN(multiplier) && multiplier > 0 ? multiplier : 1,
      },
    ]);
    resetAddForm();
  }, [
    addMode,
    masterItems,
    selectedMasterCode,
    newItemCode,
    newItemName,
    newItemCost,
    newItemBasis,
    newItemMultiplier,
    resetAddForm,
    setMasterItems,
    setPackagingLines,
  ]);

  const handleSave = useCallback(async () => {
    await onSave();
    resetAddForm();
  }, [onSave, resetAddForm]);

  return (
    <div className="rounded-xl border-2 border-zinc-200 bg-white p-6 shadow-md dark:border-zinc-600 dark:bg-zinc-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
          Packaging
        </h2>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  onCancelEdit();
                  resetAddForm();
                }}
                className="rounded-lg border-2 border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onEnterEdit}
              className="rounded-lg border-2 border-zinc-400 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-100 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100"
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
              {isEditing && <th className="w-10 px-2 py-3" />}
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">ID</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Item</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Basis</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Quantity</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Cost/Unit</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Cost/Pack</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Total Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-600">
            {packagingRows.map((row, idx) => (
              <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/40">
                {isEditing && (
                  <td className="px-2 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => setPackagingLines((prev) => prev.filter((_, i) => i !== idx))}
                      className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      Remove
                    </button>
                  </td>
                )}
                <td className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {row.code}
                </td>
                <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                  {isEditing ? (
                    <input
                      type="text"
                      value={row.item}
                      onChange={(e) =>
                        setPackagingLines((prev) =>
                          prev.map((line, i) => (i === idx ? { ...line, item: e.target.value } : line))
                        )
                      }
                      className="w-52 rounded-lg border-2 border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100"
                    />
                  ) : (
                    row.item
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-zinc-700 dark:text-zinc-300">
                  {isEditing ? (
                    <select
                      value={row.basis}
                      onChange={(e) =>
                        setPackagingLines((prev) =>
                          prev.map((line, i) =>
                            i === idx
                              ? {
                                  ...line,
                                  basis: e.target.value as FinishedProductPackagingBasis,
                                  quantitySource: e.target.value === "per_pack" ? "packs" : "units",
                                }
                              : line
                          )
                        )
                      }
                      className="rounded-lg border-2 border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100"
                    >
                      <option value="per_unit">/unit</option>
                      <option value="per_pack">/pack</option>
                    </select>
                  ) : row.basis === "per_pack" ? (
                    "per pack"
                  ) : (
                    "per unit"
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                  {formatNumber(row.quantity, { maxDecimals: 2 })}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                  {isEditing ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={toDisplayCurrency(row.costGbp)}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        if (Number.isNaN(value) || value < 0) return;
                        setPackagingLines((prev) =>
                          prev.map((line, i) => (i === idx ? { ...line, costGbp: value / displayRate } : line))
                        );
                      }}
                      className="w-24 rounded-lg border-2 border-zinc-300 bg-white px-2 py-1 text-right text-sm dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100"
                    />
                  ) : (
                    formatDisplayCurrency(row.costPerUnit)
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                  {formatDisplayCurrency(row.costPerPack)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                  {formatDisplayCurrency(row.total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-zinc-50 dark:bg-zinc-700/50">
              <td colSpan={isEditing ? 5 : 4} className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                Total
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                {formatDisplayCurrency(costPerUnit)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                {formatDisplayCurrency(costPerPack)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                {formatDisplayCurrency(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {isEditing && (
        <div className="mt-4">
          {!showAddLine ? (
            <button
              type="button"
              onClick={() => setShowAddLine(true)}
              className="rounded-lg border-2 border-dashed border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:border-emerald-400 hover:text-emerald-600 dark:border-zinc-600 dark:text-zinc-400"
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
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
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
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                    >
                      <option value="">Select item...</option>
                      {groupedMasterItems.map(({ groupName, items }) => (
                        <optgroup key={groupName} label={groupName}>
                          {items.map((item) => (
                            <option key={item.code} value={item.code}>
                              {item.code} - {item.name} ({formatDisplayCurrency(item.default_cost_gbp)})
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
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40"
                  >
                    Add
                  </button>
                  <button type="button" onClick={resetAddForm} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-600 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">ID Code</label>
                    <input value={newItemCode} onChange={(e) => setNewItemCode(e.target.value.toUpperCase())} className="w-32 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-mono uppercase dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Name</label>
                    <input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="w-48 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Cost ({currency})</label>
                    <input type="number" min="0" step="0.01" value={newItemCost} onChange={(e) => setNewItemCost(e.target.value)} className="w-24 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Basis</label>
                    <select value={newItemBasis} onChange={(e) => setNewItemBasis(e.target.value as FinishedProductPackagingBasis)} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100">
                      <option value="per_unit">/unit</option>
                      <option value="per_pack">/pack</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Multiplier</label>
                    <input type="number" min="0.01" step="0.01" value={newItemMultiplier} onChange={(e) => setNewItemMultiplier(e.target.value)} className="w-24 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100" />
                  </div>
                  <button type="button" disabled={!newItemCode.trim() || !newItemName.trim() || !newItemCost} onClick={handleAddLine} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40">
                    Add
                  </button>
                  <button type="button" onClick={resetAddForm} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-600 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
