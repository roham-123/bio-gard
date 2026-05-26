"use client";

import { useMemo, useState } from "react";
import type { PackagingItem } from "@/lib/db";
import {
  createPackagingItemAction,
  deletePackagingItemAction,
  updatePackagingItemAction,
} from "@/app/actions";
import { parseNumberInput } from "@/lib/format";
import { groupPackagingMasterItems } from "@/components/packaging/utils";
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputCls,
  selectCls,
  tableHeaderCellCls,
  tableHeaderRightCls,
} from "@/components/ui/formClasses";

type BasisFilter = "all" | "per_unit" | "per_kg";

const GROUP_FILTER_ALL = "__all__";

function groupNameForCode(code: string): string {
  const dashIndex = code.indexOf("-");
  return dashIndex > 0 ? code.slice(0, dashIndex) : "Generic";
}

type RowDraft = {
  name: string;
  costGbp: string;
  basis: "per_unit" | "per_kg";
};

type Props = {
  initialPackagingItems: PackagingItem[];
};

const BASIS_LABEL: Record<"per_unit" | "per_kg", string> = {
  per_unit: "Per unit",
  per_kg: "Per kg",
};

function normaliseBasis(value: string): "per_unit" | "per_kg" {
  return value === "per_kg" ? "per_kg" : "per_unit";
}

function draftFromItem(item: PackagingItem): RowDraft {
  return {
    name: item.name,
    costGbp: String(item.default_cost_gbp),
    basis: normaliseBasis(item.default_cost_basis),
  };
}

export default function PackagingSection({ initialPackagingItems }: Props) {
  const [items, setItems] = useState<PackagingItem[]>(initialPackagingItems);
  const [search, setSearch] = useState("");
  const [basisFilter, setBasisFilter] = useState<BasisFilter>("all");
  const [groupFilter, setGroupFilter] = useState<string>(GROUP_FILTER_ALL);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const emptyNew = {
    code: "",
    name: "",
    costGbp: "",
    basis: "per_unit" as "per_unit" | "per_kg",
  };
  const [newItem, setNewItem] = useState(emptyNew);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      const b = normaliseBasis(it.default_cost_basis);
      if (basisFilter !== "all" && b !== basisFilter) return false;
      if (groupFilter !== GROUP_FILTER_ALL && groupNameForCode(it.code) !== groupFilter) {
        return false;
      }
      if (!q) return true;
      return (
        it.code.toLowerCase().includes(q) ||
        it.name.toLowerCase().includes(q)
      );
    });
  }, [items, search, basisFilter, groupFilter]);

  const counts = useMemo(() => {
    let perUnit = 0;
    let perKg = 0;
    for (const it of items) {
      if (normaliseBasis(it.default_cost_basis) === "per_kg") perKg++;
      else perUnit++;
    }
    return { perUnit, perKg, total: items.length };
  }, [items]);

  const groupOptions = useMemo(() => {
    const groups = groupPackagingMasterItems(items);
    return groups.map((g) => ({ name: g.groupName, count: g.items.length }));
  }, [items]);

  const startEdit = (item: PackagingItem) => {
    setError(null);
    setEditingCode(item.code);
    setDrafts((prev) => ({ ...prev, [item.code]: draftFromItem(item) }));
  };

  const cancelEdit = (code: string) => {
    setEditingCode((curr) => (curr === code ? null : curr));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
  };

  const updateDraft = (code: string, patch: Partial<RowDraft>) => {
    setDrafts((prev) => ({ ...prev, [code]: { ...prev[code], ...patch } }));
  };

  const saveEdit = async (item: PackagingItem) => {
    const draft = drafts[item.code];
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    const cost = parseNumberInput(draft.costGbp);
    if (!Number.isFinite(cost) || cost < 0) {
      setError("Default cost must be a non-negative number.");
      return;
    }

    setBusyCode(item.code);
    setError(null);
    try {
      const updated = await updatePackagingItemAction(item.code, name, cost, draft.basis);
      if (!updated) {
        setError("Could not update packaging item — it may have been removed.");
        return;
      }
      setItems((prev) =>
        prev
          .map((row) => (row.code === item.code ? updated : row))
          .sort((a, b) => a.code.localeCompare(b.code))
      );
      cancelEdit(item.code);
    } catch (err) {
      console.error("Failed to update packaging item", err);
      setError("Failed to update packaging item. Please try again.");
    } finally {
      setBusyCode(null);
    }
  };

  const removeItem = async (item: PackagingItem) => {
    if (!confirm(`Remove packaging item ${item.code} (${item.name})? This cannot be undone.`)) {
      return;
    }
    setBusyCode(item.code);
    setError(null);
    try {
      const result = await deletePackagingItemAction(item.code);
      if (result.deleted) {
        setItems((prev) => prev.filter((row) => row.code !== item.code));
        cancelEdit(item.code);
        return;
      }
      if (result.reason === "not_found") {
        setItems((prev) => prev.filter((row) => row.code !== item.code));
        setError("Packaging item was already removed.");
        return;
      }
      const recipeNames = result.usedByRecipes.map((r) => r.name);
      const fpNames = result.usedByFinishedProducts.map((r) => r.name);
      const parts: string[] = [];
      if (recipeNames.length > 0) {
        const shown = recipeNames.slice(0, 5).join(", ");
        const more = recipeNames.length > 5 ? `, +${recipeNames.length - 5} more` : "";
        parts.push(
          `${recipeNames.length} formula${recipeNames.length === 1 ? "" : "s"} (${shown}${more})`
        );
      }
      if (fpNames.length > 0) {
        const shown = fpNames.slice(0, 5).join(", ");
        const more = fpNames.length > 5 ? `, +${fpNames.length - 5} more` : "";
        parts.push(
          `${fpNames.length} finished product${fpNames.length === 1 ? "" : "s"} (${shown}${more})`
        );
      }
      setError(
        `Cannot remove ${item.code}: still used by ${parts.join(" and ")}. Remove it from them first.`
      );
    } catch (err) {
      console.error("Failed to delete packaging item", err);
      setError("Failed to remove packaging item. Please try again.");
    } finally {
      setBusyCode(null);
    }
  };

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = newItem.code.trim().toUpperCase();
    const name = newItem.name.trim();
    if (!code) {
      setError("Code is required.");
      return;
    }
    if (!name) {
      setError("Name is required.");
      return;
    }
    if (items.some((it) => it.code.toLowerCase() === code.toLowerCase())) {
      setError(`A packaging item with code "${code}" already exists.`);
      return;
    }
    const cost = parseNumberInput(newItem.costGbp);
    if (!Number.isFinite(cost) || cost < 0) {
      setError("Default cost must be a non-negative number.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const created = await createPackagingItemAction(code, name, cost, newItem.basis);
      setItems((prev) =>
        [...prev, created].sort((a, b) => a.code.localeCompare(b.code))
      );
      setNewItem(emptyNew);
      setShowAdd(false);
    } catch (err) {
      console.error("Failed to create packaging item", err);
      setError("Failed to add packaging item. Check the code is unique and try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          All packaging items available to formulas and finished products.
        </p>
        <button
          type="button"
          onClick={() => {
            setShowAdd((open) => !open);
            setError(null);
          }}
          className={btnPrimary}
        >
          {showAdd ? "Cancel" : "+ Add packaging"}
        </button>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Search
          </label>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code or name"
            className="w-64 rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-emerald-400 dark:focus:bg-zinc-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Group
          </label>
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className={selectCls + " py-2.5"}
          >
            <option value={GROUP_FILTER_ALL}>All groups ({counts.total})</option>
            {groupOptions.map((g) => (
              <option key={g.name} value={g.name}>
                {g.name} ({g.count})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Cost basis
          </label>
          <div className="inline-flex overflow-hidden rounded-lg border border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700/50">
            {(
              [
                { value: "all", label: `All (${counts.total})` },
                { value: "per_unit", label: `Per unit (${counts.perUnit})` },
                { value: "per_kg", label: `Per kg (${counts.perKg})` },
              ] as { value: BasisFilter; label: string }[]
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setBasisFilter(opt.value)}
                className={[
                  "px-3 py-2 text-sm font-medium transition-colors",
                  basisFilter === opt.value
                    ? "bg-emerald-600 text-white"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-700",
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <p className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
          Showing {filtered.length} of {counts.total}
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Add new */}
      {showAdd && (
        <form
          onSubmit={submitNew}
          className="mt-6 rounded-xl border border-emerald-300 bg-emerald-50/40 p-5 dark:border-emerald-700 dark:bg-emerald-900/10"
        >
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            New packaging item
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col">
              <label className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Code
              </label>
              <input
                value={newItem.code}
                onChange={(e) => setNewItem((m) => ({ ...m, code: e.target.value }))}
                placeholder="e.g. BAG-25KG"
                className={inputCls}
                disabled={creating}
                required
              />
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Name
              </label>
              <input
                value={newItem.name}
                onChange={(e) => setNewItem((m) => ({ ...m, name: e.target.value }))}
                placeholder="Packaging description"
                className={inputCls}
                disabled={creating}
                required
              />
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Default cost basis
              </label>
              <select
                value={newItem.basis}
                onChange={(e) =>
                  setNewItem((m) => ({ ...m, basis: normaliseBasis(e.target.value) }))
                }
                className={selectCls}
                disabled={creating}
              >
                <option value="per_unit">Per unit</option>
                <option value="per_kg">Per kg</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Default cost (GBP)
              </label>
              <input
                value={newItem.costGbp}
                onChange={(e) => setNewItem((m) => ({ ...m, costGbp: e.target.value }))}
                placeholder="0.00"
                className={inputCls}
                disabled={creating}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setNewItem(emptyNew);
                setError(null);
              }}
              className={btnSecondary}
              disabled={creating}
            >
              Cancel
            </button>
            <button type="submit" className={btnPrimary} disabled={creating}>
              {creating ? "Adding…" : "Add packaging"}
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-xl border-2 border-zinc-200 bg-white shadow-md dark:border-zinc-600 dark:bg-zinc-800">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-600">
          <thead>
            <tr className="bg-zinc-100 dark:bg-zinc-700/80">
              <th className={tableHeaderCellCls}>Code</th>
              <th className={tableHeaderCellCls}>Group</th>
              <th className={tableHeaderCellCls}>Name</th>
              <th className={tableHeaderCellCls}>Default basis</th>
              <th className={tableHeaderRightCls}>Default cost (GBP)</th>
              <th className={tableHeaderRightCls}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-600">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  {items.length === 0
                    ? "No packaging items yet. Add your first packaging item to get started."
                    : "No packaging items match the current search or filter."}
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const editing = editingCode === item.code;
                const draft = drafts[item.code];
                const busy = busyCode === item.code;
                const basis = normaliseBasis(item.default_cost_basis);
                const groupName = groupNameForCode(item.code);
                const isGeneric = groupName === "Generic";
                return (
                  <tr
                    key={item.code}
                    className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700/40"
                  >
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                      {item.code}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm">
                      <span
                        className={[
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wider",
                          isGeneric
                            ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300",
                        ].join(" ")}
                      >
                        {groupName}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                      {editing && draft ? (
                        <input
                          value={draft.name}
                          onChange={(e) => updateDraft(item.code, { name: e.target.value })}
                          className={inputCls + " w-full"}
                          disabled={busy}
                        />
                      ) : (
                        item.name
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {editing && draft ? (
                        <select
                          value={draft.basis}
                          onChange={(e) =>
                            updateDraft(item.code, { basis: normaliseBasis(e.target.value) })
                          }
                          className={selectCls}
                          disabled={busy}
                        >
                          <option value="per_unit">Per unit</option>
                          <option value="per_kg">Per kg</option>
                        </select>
                      ) : (
                        <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                          {BASIS_LABEL[basis]}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                      {editing && draft ? (
                        <input
                          value={draft.costGbp}
                          onChange={(e) => updateDraft(item.code, { costGbp: e.target.value })}
                          className={inputCls + " w-28 text-right"}
                          disabled={busy}
                        />
                      ) : (
                        item.default_cost_gbp.toFixed(2)
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-sm">
                      {editing ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => saveEdit(item)}
                            disabled={busy}
                            className={btnPrimary}
                          >
                            {busy ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => cancelEdit(item.code)}
                            disabled={busy}
                            className={btnSecondary}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            disabled={busy}
                            className={btnSecondary}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(item)}
                            disabled={busy}
                            className={btnDanger}
                          >
                            {busy ? "…" : "Remove"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
