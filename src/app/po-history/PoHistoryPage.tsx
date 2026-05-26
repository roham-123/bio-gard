"use client";

import { Fragment, useCallback, useState } from "react";
import type { PurchaseOrder } from "@/lib/db";
import { deletePurchaseOrderAction, getPurchaseOrdersAction } from "@/app/actions";
import { formatCurrency, formatDate, formatKg, formatNumber, formatTime } from "@/lib/format";
import { useFx } from "@/app/FxProvider";
import PageShell from "@/components/layout/PageShell";
import { useDateRange, type DateRangePreset } from "@/lib/hooks/useDateRange";

type Props = {
  initialOrders: PurchaseOrder[];
};

export default function PoHistoryPage({ initialOrders }: Props) {
  const { currency, rate } = useFx();
  const formatDisplayCurrency = useCallback(
    (gbpValue: number) => formatCurrency(Number(gbpValue) * rate, currency),
    [currency, rate]
  );
  const [orders, setOrders] = useState<PurchaseOrder[]>(initialOrders);
  const [search, setSearch] = useState("");
  const { fromDate, toDate, setFromDate, setToDate, reset: resetDates, applyPreset } = useDateRange();
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [poToDelete, setPoToDelete] = useState<PurchaseOrder | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchOrders = useCallback(
    async (params: { search?: string; from?: string; to?: string }) => {
      setLoading(true);
      try {
        const result = await getPurchaseOrdersAction(params);
        setOrders(result);
      } catch (err) {
        console.error("Failed to fetch PO history:", err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const runFilter = useCallback(
    () =>
      fetchOrders({
        search: search.trim() || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      }),
    [fetchOrders, search, fromDate, toDate]
  );

  const clearFilters = useCallback(() => {
    setSearch("");
    resetDates();
    return fetchOrders({});
  }, [fetchOrders, resetDates]);

  const applyShortcut = useCallback(
    (preset: DateRangePreset) => {
      const { from, to } = applyPreset(preset);
      return fetchOrders({
        search: search.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
      });
    },
    [applyPreset, fetchOrders, search]
  );

  const totalVisibleCost = orders.reduce((sum, po) => {
    const detail = po.detail as Record<string, unknown>;
    const finalTotalCost = typeof detail.finalTotalCost === "number" ? detail.finalTotalCost : null;
    return sum + (finalTotalCost ?? 0);
  }, 0);

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const confirmDeletePo = async () => {
    if (!poToDelete) return;
    setDeletingId(poToDelete.id);
    setDeleteError(null);
    try {
      const deleted = await deletePurchaseOrderAction(poToDelete.id);
      if (!deleted) {
        setDeleteError("Purchase order was not found — it may have already been deleted.");
        setPoToDelete(null);
        return;
      }
      setOrders((prev) => prev.filter((o) => o.id !== poToDelete.id));
      setExpandedId((prev) => (prev === poToDelete.id ? null : prev));
      setPoToDelete(null);
    } catch (err) {
      console.error("Failed to delete purchase order:", err);
      setDeleteError("Failed to delete purchase order. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  type IngredientSnapshot = {
    ingredientId: string;
    ingredientName: string;
    grams: number;
    kg: number;
    costInProduct: number;
  };

  type PackagingSnapshot = {
    code: string;
    item: string;
    quantity: number;
    total: number;
  };

  return (
    <PageShell>
      <header className="border-b border-zinc-200 pb-6 dark:border-zinc-600">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          Purchase Order History
        </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Browse and search all previously generated purchase orders.
          </p>
        </header>

        {deleteError && (
          <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
            {deleteError}
          </div>
        )}

        {/* Filters */}
        <div className="mt-6 flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runFilter()}
              placeholder="PO ref or product name"
              className="w-56 rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-emerald-400 dark:focus:bg-zinc-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              From
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-100 dark:focus:border-emerald-400 dark:focus:bg-zinc-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              To
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-100 dark:focus:border-emerald-400 dark:focus:bg-zinc-700"
            />
          </div>
          <button
            type="button"
            onClick={() => applyShortcut("last_month")}
            disabled={loading}
            className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-emerald-400 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
          >
            Last month
          </button>
          <button
            type="button"
            onClick={() => applyShortcut("last_30_days")}
            disabled={loading}
            className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-emerald-400 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
          >
            Last 30 days
          </button>
          <button
            type="button"
            onClick={runFilter}
            disabled={loading}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-zinc-800"
          >
            {loading ? "Loading…" : "Filter"}
          </button>
          {(search || fromDate || toDate) && (
            <button
              type="button"
              onClick={clearFilters}
              disabled={loading}
              className="rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600 dark:focus:ring-offset-zinc-800"
            >
              Clear
            </button>
          )}
        </div>

        {/* Results */}
        <div className="mt-6">
          {orders.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {search || fromDate || toDate
                  ? "No purchase orders match your filters."
                  : "No purchase orders generated yet."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border-2 border-zinc-200 bg-white shadow-md dark:border-zinc-600 dark:bg-zinc-800">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-600">
                <thead>
                  <tr className="bg-zinc-100 dark:bg-zinc-700/80">
                    <th className="w-10 px-3 py-3.5" />
                    <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      PO Ref
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      Date
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      Product
                    </th>
                    <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      Batch / Packs
                    </th>
                    <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      Sets / Units
                    </th>
                    <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      Total Cost
                    </th>
                    <th className="w-12 px-3 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-600">
                  {orders.map((po) => {
                    const detail = po.detail as Record<string, unknown>;
                    const finalTotalCost = typeof detail.finalTotalCost === "number" ? detail.finalTotalCost : null;
                    const ingredients = (detail.ingredients ?? []) as IngredientSnapshot[];
                    const packaging = (detail.packaging ?? []) as PackagingSnapshot[];
                    const isExpanded = expandedId === po.id;
                    const isFinishedProduct = po.source_type === "finished_product";
                    const displayName = po.product_name ?? po.recipe_name;
                    const packs = typeof detail.packs === "number" ? detail.packs : null;

                    return (
                      <Fragment key={po.id}>
                        <tr
                          onClick={() => toggleExpand(po.id)}
                          className="cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700/40"
                        >
                          <td className="w-10 px-3 py-3.5 text-center text-zinc-400">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className={`inline-block h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                            >
                              <path
                                fillRule="evenodd"
                                d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                            {po.po_reference}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-sm text-zinc-700 dark:text-zinc-300">
                            <span>{formatDate(po.created_at)}</span>
                            <span className="ml-2 text-zinc-400 dark:text-zinc-500">{formatTime(po.created_at)}</span>
                          </td>
                          <td className="px-4 py-3.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {displayName}
                            <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300">
                              {isFinishedProduct ? "Finished" : "Formula"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                            {isFinishedProduct
                              ? packs != null
                                ? formatNumber(packs, { maxDecimals: 2 })
                                : "—"
                              : formatKg(po.batch_grams / 1000)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                            {formatNumber(po.units, { maxDecimals: 2 })}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                            {finalTotalCost != null ? formatDisplayCurrency(finalTotalCost) : "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3.5 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteError(null);
                                setPoToDelete(po);
                              }}
                              disabled={deletingId === po.id}
                              className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                              title="Delete purchase order"
                              aria-label={`Delete ${po.po_reference}`}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="h-4 w-4"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (ingredients.length > 0 || packaging.length > 0) && (
                          <tr key={`${po.id}-detail`}>
                            <td colSpan={8} className="p-0">
                              <div className="border-t border-zinc-100 bg-zinc-50/60 px-6 py-4 dark:border-zinc-700 dark:bg-zinc-800/60">
                                <div className="grid gap-6 lg:grid-cols-2">
                                  {ingredients.length > 0 && (
                                    <div>
                                      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                        Ingredients Used
                                      </h4>
                                      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-600">
                                        <table className="min-w-full divide-y divide-zinc-200 text-xs dark:divide-zinc-600">
                                          <thead>
                                            <tr className="bg-zinc-100 dark:bg-zinc-700/60">
                                              <th className="px-3 py-2 text-left font-bold uppercase text-zinc-600 dark:text-zinc-400">ID</th>
                                              <th className="px-3 py-2 text-left font-bold uppercase text-zinc-600 dark:text-zinc-400">Ingredient</th>
                                              <th className="px-3 py-2 text-right font-bold uppercase text-zinc-600 dark:text-zinc-400">kg</th>
                                              <th className="px-3 py-2 text-right font-bold uppercase text-zinc-600 dark:text-zinc-400">Cost</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700">
                                            {ingredients.map((ing) => (
                                              <tr key={ing.ingredientId}>
                                                <td className="whitespace-nowrap px-3 py-1.5 font-mono font-semibold text-zinc-700 dark:text-zinc-200">{ing.ingredientId}</td>
                                                <td className="px-3 py-1.5 text-zinc-900 dark:text-zinc-100">{ing.ingredientName}</td>
                                                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{formatKg(ing.kg)}</td>
                                                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{formatDisplayCurrency(ing.costInProduct)}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}
                                  {packaging.length > 0 && (
                                    <div>
                                      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                        Packaging Used
                                      </h4>
                                      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-600">
                                        <table className="min-w-full divide-y divide-zinc-200 text-xs dark:divide-zinc-600">
                                          <thead>
                                            <tr className="bg-zinc-100 dark:bg-zinc-700/60">
                                              <th className="px-3 py-2 text-left font-bold uppercase text-zinc-600 dark:text-zinc-400">Code</th>
                                              <th className="px-3 py-2 text-left font-bold uppercase text-zinc-600 dark:text-zinc-400">Item</th>
                                              <th className="px-3 py-2 text-right font-bold uppercase text-zinc-600 dark:text-zinc-400">Qty</th>
                                              <th className="px-3 py-2 text-right font-bold uppercase text-zinc-600 dark:text-zinc-400">Total</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700">
                                            {packaging.map((pkg) => (
                                              <tr key={pkg.code}>
                                                <td className="whitespace-nowrap px-3 py-1.5 font-mono font-semibold text-zinc-700 dark:text-zinc-200">{pkg.code}</td>
                                                <td className="px-3 py-1.5 text-zinc-900 dark:text-zinc-100">{pkg.item}</td>
                                                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{formatNumber(pkg.quantity, { maxDecimals: 2 })}</td>
                                                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{formatDisplayCurrency(pkg.total)}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-400">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    {orders.length} purchase order{orders.length !== 1 ? "s" : ""}
                  </span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-200">Total cost: {formatDisplayCurrency(totalVisibleCost)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

      {poToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-600 dark:bg-zinc-800">
            <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              Delete purchase order?
            </h4>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {poToDelete.po_reference}
              </span>
              {poToDelete.product_name ?? poToDelete.recipe_name ? (
                <>
                  {" "}
                  (
                  <span className="font-medium">
                    {poToDelete.product_name ?? poToDelete.recipe_name}
                  </span>
                  )
                </>
              ) : null}
              ?
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              This will remove it from PO history and stock summary. This action cannot be undone.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deletingId != null}
                onClick={() => setPoToDelete(null)}
                className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingId != null}
                onClick={confirmDeletePo}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingId != null ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
