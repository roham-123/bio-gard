"use client";

import { useCallback, useState } from "react";
import type { PurchaseOrder } from "@/lib/db";
import { getPurchaseOrdersAction } from "@/app/actions";
import { formatKg, formatNumber } from "@/lib/format";

type Props = {
  initialOrders: PurchaseOrder[];
};

export default function PoHistoryPage({ initialOrders }: Props) {
  const [orders, setOrders] = useState<PurchaseOrder[]>(initialOrders);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const runFilter = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getPurchaseOrdersAction({
        search: search.trim() || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setOrders(result);
    } catch (err) {
      console.error("Failed to fetch PO history:", err);
    } finally {
      setLoading(false);
    }
  }, [search, fromDate, toDate]);

  const clearFilters = useCallback(async () => {
    setSearch("");
    setFromDate("");
    setToDate("");
    setLoading(true);
    try {
      const result = await getPurchaseOrdersAction();
      setOrders(result);
    } catch (err) {
      console.error("Failed to fetch PO history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
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
    <div className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 sm:p-8">
        <header className="border-b border-zinc-200 pb-6 dark:border-zinc-600">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Purchase Order History
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Browse and search all previously generated purchase orders.
          </p>
        </header>

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
                      Recipe
                    </th>
                    <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      Batch (kg)
                    </th>
                    <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      Sets
                    </th>
                    <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      Total Cost
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-600">
                  {orders.map((po) => {
                    const detail = po.detail as Record<string, unknown>;
                    const finalTotalCost = typeof detail.finalTotalCost === "number" ? detail.finalTotalCost : null;
                    const ingredients = (detail.ingredients ?? []) as IngredientSnapshot[];
                    const packaging = (detail.packaging ?? []) as PackagingSnapshot[];
                    const isExpanded = expandedId === po.id;

                    return (
                      <>
                        <tr
                          key={po.id}
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
                            {po.recipe_name}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                            {formatKg(po.batch_grams / 1000)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                            {formatNumber(po.units, { maxDecimals: 2 })}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                            {finalTotalCost != null ? `£${finalTotalCost.toFixed(2)}` : "—"}
                          </td>
                        </tr>
                        {isExpanded && (ingredients.length > 0 || packaging.length > 0) && (
                          <tr key={`${po.id}-detail`}>
                            <td colSpan={7} className="p-0">
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
                                                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">£{ing.costInProduct.toFixed(2)}</td>
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
                                                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">£{pkg.total.toFixed(2)}</td>
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
                      </>
                    );
                  })}
                </tbody>
              </table>
              <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-400">
                {orders.length} purchase order{orders.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
