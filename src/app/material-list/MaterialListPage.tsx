"use client";

import { useMemo, useState } from "react";
import type { Ingredient } from "@/lib/db";
import {
  createIngredientAction,
  deleteIngredientAction,
  updateIngredientAction,
} from "@/app/actions";
import { formatCfu, formatStockCfuInput, parseNumberInput } from "@/lib/format";
import PageShell from "@/components/layout/PageShell";
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputCls,
  selectCls,
  tableHeaderCellCls,
  tableHeaderRightCls,
} from "@/components/ui/formClasses";

type TypeFilter = "all" | "bacteria" | "filler";

type RowDraft = {
  name: string;
  stockCfu: string;
  costPerKg: string;
  isBacteria: boolean;
};

type Props = {
  initialIngredients: Ingredient[];
};

function isBacteria(ing: Ingredient): boolean {
  return ing.stock_cfu_per_g > 0;
}

function draftFromIngredient(ing: Ingredient): RowDraft {
  const bact = isBacteria(ing);
  return {
    name: ing.name,
    stockCfu: bact ? formatStockCfuInput(ing.stock_cfu_per_g) : "",
    costPerKg: String(ing.cost_per_kg_gbp),
    isBacteria: bact,
  };
}

export default function MaterialListPage({ initialIngredients }: Props) {
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const emptyNewMaterial = {
    id: "",
    name: "",
    isBacteria: true,
    stockCfu: "",
    costPerKg: "",
  };
  const [newMaterial, setNewMaterial] = useState(emptyNewMaterial);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ingredients.filter((ing) => {
      const bact = isBacteria(ing);
      if (typeFilter === "bacteria" && !bact) return false;
      if (typeFilter === "filler" && bact) return false;
      if (!q) return true;
      return (
        ing.id.toLowerCase().includes(q) ||
        ing.name.toLowerCase().includes(q)
      );
    });
  }, [ingredients, search, typeFilter]);

  const counts = useMemo(() => {
    let bacteria = 0;
    let filler = 0;
    for (const ing of ingredients) {
      if (isBacteria(ing)) bacteria++;
      else filler++;
    }
    return { bacteria, filler, total: ingredients.length };
  }, [ingredients]);

  const startEdit = (ing: Ingredient) => {
    setError(null);
    setEditingId(ing.id);
    setDrafts((prev) => ({ ...prev, [ing.id]: draftFromIngredient(ing) }));
  };

  const cancelEdit = (id: string) => {
    setEditingId((curr) => (curr === id ? null : curr));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const updateDraft = (id: string, patch: Partial<RowDraft>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const saveEdit = async (ing: Ingredient) => {
    const draft = drafts[ing.id];
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    const costPerKg = parseNumberInput(draft.costPerKg);
    if (!Number.isFinite(costPerKg) || costPerKg < 0) {
      setError("Cost per kg must be a non-negative number.");
      return;
    }
    let stockCfu = 0;
    if (draft.isBacteria) {
      stockCfu = parseNumberInput(draft.stockCfu);
      if (!Number.isFinite(stockCfu) || stockCfu <= 0) {
        setError("Stock CFU/g must be greater than 0 for bacteria.");
        return;
      }
    }

    setBusyId(ing.id);
    setError(null);
    try {
      const updated = await updateIngredientAction(ing.id, name, stockCfu, costPerKg);
      if (!updated) {
        setError("Could not update material — it may have been removed.");
        return;
      }
      setIngredients((prev) =>
        prev
          .map((row) => (row.id === ing.id ? updated : row))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      cancelEdit(ing.id);
    } catch (err) {
      console.error("Failed to update ingredient", err);
      setError("Failed to update material. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const removeIngredient = async (ing: Ingredient) => {
    if (!confirm(`Remove ${ing.name} (${ing.id})? This cannot be undone.`)) {
      return;
    }
    setBusyId(ing.id);
    setError(null);
    try {
      const result = await deleteIngredientAction(ing.id);
      if (result.deleted) {
        setIngredients((prev) => prev.filter((row) => row.id !== ing.id));
        cancelEdit(ing.id);
        return;
      }
      if (result.reason === "not_found") {
        setIngredients((prev) => prev.filter((row) => row.id !== ing.id));
        setError("Material was already removed.");
        return;
      }
      const recipeList = result.usedByRecipes
        .slice(0, 5)
        .map((r) => r.name)
        .join(", ");
      const more = result.usedByRecipes.length > 5 ? `, +${result.usedByRecipes.length - 5} more` : "";
      setError(
        `Cannot remove ${ing.name}: still used by ${result.usedByRecipes.length} formula${
          result.usedByRecipes.length === 1 ? "" : "s"
        } (${recipeList}${more}). Remove it from those formulas first.`
      );
    } catch (err) {
      console.error("Failed to delete ingredient", err);
      setError("Failed to remove material. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = newMaterial.id.trim();
    const name = newMaterial.name.trim();
    if (!id) {
      setError("ID is required.");
      return;
    }
    if (!name) {
      setError("Name is required.");
      return;
    }
    if (ingredients.some((ing) => ing.id.toLowerCase() === id.toLowerCase())) {
      setError(`A material with ID "${id}" already exists.`);
      return;
    }
    const costPerKg = parseNumberInput(newMaterial.costPerKg);
    if (!Number.isFinite(costPerKg) || costPerKg < 0) {
      setError("Cost per kg must be a non-negative number.");
      return;
    }
    let stockCfu = 0;
    if (newMaterial.isBacteria) {
      stockCfu = parseNumberInput(newMaterial.stockCfu);
      if (!Number.isFinite(stockCfu) || stockCfu <= 0) {
        setError("Stock CFU/g must be greater than 0 for bacteria.");
        return;
      }
    }

    setCreating(true);
    setError(null);
    try {
      const created = await createIngredientAction(id, name, stockCfu, costPerKg);
      setIngredients((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setNewMaterial(emptyNewMaterial);
      setShowAdd(false);
    } catch (err) {
      console.error("Failed to create ingredient", err);
      setError("Failed to add material. Check the ID is unique and try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <PageShell>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-600">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Material List
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage every bacteria and filler available to formulas. Add new materials,
            update prices or stock CFU, and remove materials that are no longer used.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowAdd((open) => !open);
            setError(null);
          }}
          className={btnPrimary}
        >
          {showAdd ? "Cancel" : "+ Add material"}
        </button>
      </header>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Search
          </label>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID or name"
            className="w-64 rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-emerald-400 dark:focus:bg-zinc-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Type
          </label>
          <div className="inline-flex overflow-hidden rounded-lg border border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700/50">
            {(
              [
                { value: "all", label: `All (${counts.total})` },
                { value: "bacteria", label: `Bacteria (${counts.bacteria})` },
                { value: "filler", label: `Fillers (${counts.filler})` },
              ] as { value: TypeFilter; label: string }[]
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTypeFilter(opt.value)}
                className={[
                  "px-3 py-2 text-sm font-medium transition-colors",
                  typeFilter === opt.value
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
            New material
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="flex flex-col">
              <label className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                ID
              </label>
              <input
                value={newMaterial.id}
                onChange={(e) => setNewMaterial((m) => ({ ...m, id: e.target.value }))}
                placeholder="e.g. PRO0235-1E11"
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
                value={newMaterial.name}
                onChange={(e) => setNewMaterial((m) => ({ ...m, name: e.target.value }))}
                placeholder="Material name"
                className={inputCls}
                disabled={creating}
                required
              />
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Type
              </label>
              <select
                value={newMaterial.isBacteria ? "bacteria" : "filler"}
                onChange={(e) =>
                  setNewMaterial((m) => ({
                    ...m,
                    isBacteria: e.target.value === "bacteria",
                    stockCfu: e.target.value === "bacteria" ? m.stockCfu : "",
                  }))
                }
                className={selectCls}
                disabled={creating}
              >
                <option value="bacteria">Bacteria</option>
                <option value="filler">Filler</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Stock CFU/g
              </label>
              <input
                value={newMaterial.stockCfu}
                onChange={(e) =>
                  setNewMaterial((m) => ({ ...m, stockCfu: e.target.value }))
                }
                placeholder={newMaterial.isBacteria ? "e.g. 1e11" : "—"}
                className={inputCls}
                disabled={creating || !newMaterial.isBacteria}
              />
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Cost per kg (GBP)
              </label>
              <input
                value={newMaterial.costPerKg}
                onChange={(e) =>
                  setNewMaterial((m) => ({ ...m, costPerKg: e.target.value }))
                }
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
                setNewMaterial(emptyNewMaterial);
                setError(null);
              }}
              className={btnSecondary}
              disabled={creating}
            >
              Cancel
            </button>
            <button type="submit" className={btnPrimary} disabled={creating}>
              {creating ? "Adding…" : "Add material"}
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-xl border-2 border-zinc-200 bg-white shadow-md dark:border-zinc-600 dark:bg-zinc-800">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-600">
          <thead>
            <tr className="bg-zinc-100 dark:bg-zinc-700/80">
              <th className={tableHeaderCellCls}>ID</th>
              <th className={tableHeaderCellCls}>Name</th>
              <th className={tableHeaderCellCls}>Type</th>
              <th className={tableHeaderRightCls}>Stock CFU/g</th>
              <th className={tableHeaderRightCls}>Cost / kg (GBP)</th>
              <th className={tableHeaderRightCls}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-600">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  {ingredients.length === 0
                    ? "No materials yet. Add your first material to get started."
                    : "No materials match the current search or filter."}
                </td>
              </tr>
            ) : (
              filtered.map((ing) => {
                const editing = editingId === ing.id;
                const draft = drafts[ing.id];
                const bact = editing && draft ? draft.isBacteria : isBacteria(ing);
                const busy = busyId === ing.id;
                return (
                  <tr
                    key={ing.id}
                    className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700/40"
                  >
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                      {ing.id}
                    </td>
                    <td className="px-3 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                      {editing && draft ? (
                        <input
                          value={draft.name}
                          onChange={(e) => updateDraft(ing.id, { name: e.target.value })}
                          className={inputCls + " w-full"}
                          disabled={busy}
                        />
                      ) : (
                        ing.name
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {editing && draft ? (
                        <select
                          value={draft.isBacteria ? "bacteria" : "filler"}
                          onChange={(e) =>
                            updateDraft(ing.id, {
                              isBacteria: e.target.value === "bacteria",
                              stockCfu:
                                e.target.value === "bacteria" ? draft.stockCfu : "",
                            })
                          }
                          className={selectCls}
                          disabled={busy}
                        >
                          <option value="bacteria">Bacteria</option>
                          <option value="filler">Filler</option>
                        </select>
                      ) : (
                        <span
                          className={[
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wider",
                            bact
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
                          ].join(" ")}
                        >
                          {bact ? "Bacteria" : "Filler"}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                      {editing && draft ? (
                        <input
                          value={draft.stockCfu}
                          onChange={(e) => updateDraft(ing.id, { stockCfu: e.target.value })}
                          placeholder={draft.isBacteria ? "e.g. 1e13" : "—"}
                          className={inputCls + " w-32 text-right"}
                          disabled={busy || !draft.isBacteria}
                        />
                      ) : bact ? (
                        formatCfu(ing.stock_cfu_per_g)
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                      {editing && draft ? (
                        <input
                          value={draft.costPerKg}
                          onChange={(e) => updateDraft(ing.id, { costPerKg: e.target.value })}
                          className={inputCls + " w-28 text-right"}
                          disabled={busy}
                        />
                      ) : (
                        ing.cost_per_kg_gbp.toFixed(2)
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-sm">
                      {editing ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => saveEdit(ing)}
                            disabled={busy}
                            className={btnPrimary}
                          >
                            {busy ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => cancelEdit(ing.id)}
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
                            onClick={() => startEdit(ing)}
                            disabled={busy}
                            className={btnSecondary}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => removeIngredient(ing)}
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
    </PageShell>
  );
}
