"use client";

import { useCallback, useMemo, useState } from "react";
import { formatNumber, type CurrencyCode } from "@/lib/format";
import type { PackagingItem } from "@/lib/db";
import { createPackagingItemAction } from "@/app/actions";
import type { PackagingBasis, PackagingLineInput, PackagingRow } from "./types";

type Props = {
  packagingRows: PackagingRow[];
  grandTotal: number;
  packagingCostPerKg: number;
  packagingCostPerUnit: number;
  setPackagingLines: React.Dispatch<React.SetStateAction<PackagingLineInput[]>>;
  isEditing: boolean;
  isSaving: boolean;
  onEnterEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => Promise<void> | void;
  batchGrams: number;
  units: number;
  displayRate: number;
  toDisplayCurrency: (gbp: number) => number;
  formatDisplayCurrency: (gbp: number) => string;
  currency: CurrencyCode;
  masterItems: PackagingItem[];
  setMasterItems: React.Dispatch<React.SetStateAction<PackagingItem[]>>;
};

export default function PackagingSection({
  packagingRows,
  grandTotal,
  packagingCostPerKg,
  packagingCostPerUnit,
  setPackagingLines,
  isEditing,
  isSaving,
  onEnterEdit,
  onCancelEdit,
  onSave,
  batchGrams,
  units,
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

  const handleAddLine = useCallback(async () => {
    if (addMode === "existing") {
      const master = masterItems.find((m) => m.code === selectedMasterCode);
      if (!master) return;
      const basis =
        master.default_cost_basis === "per_kg"
          ? "per_kg"
          : master.default_cost_basis === "per_unit"
            ? "per_unit"
            : "per_set";
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
        const created = await createPackagingItemAction(
          code,
          name,
          cost,
          newItemBasis === "per_kg" ? "per_kg" : newItemBasis === "per_unit" ? "per_unit" : "per_unit"
        );
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
  }, [
    addMode,
    masterItems,
    selectedMasterCode,
    newItemCode,
    newItemName,
    newItemCost,
    newItemBasis,
    newItemUnitsPerPack,
    newItemQuantitySource,
    newItemMultiplier,
    resetAddForm,
    setPackagingLines,
    setMasterItems,
  ]);

  const handleDeleteLine = useCallback(
    (idx: number) => {
      setPackagingLines((prev) => prev.filter((_, i) => i !== idx));
    },
    [setPackagingLines]
  );

  const handleCancelEditing = useCallback(() => {
    onCancelEdit();
    resetAddForm();
  }, [onCancelEdit, resetAddForm]);

  const handleSaveEditing = useCallback(async () => {
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
                onClick={handleSaveEditing}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-zinc-800"
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleCancelEditing}
                className="rounded-lg border-2 border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 dark:focus:ring-offset-zinc-800"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onEnterEdit}
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
              {isEditing && <th className="w-10 px-2 py-3" />}
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
            {packagingRows.map((row, idx) => (
              <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/40">
                {isEditing && (
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
                  {isEditing ? (
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
                  {isEditing && row.code !== "SACH100G" ? (
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
                  {isEditing && row.code !== "SACH100G" ? (
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
                  {isEditing && row.code !== "SACH100G" ? (
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
              <td colSpan={isEditing ? 5 : 4} className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                Total
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                {batchGrams > 0 ? formatDisplayCurrency(packagingCostPerKg) : "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                {units > 0 ? formatDisplayCurrency(packagingCostPerUnit) : "—"}
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
  );
}
