"use client";

import { useCallback, useState } from "react";
import type { StockSummary } from "@/lib/db";
import { getStockSummaryAction } from "@/app/actions";
import { formatGrams, formatKg, formatNumber } from "@/lib/format";

type Props = {
  initialSummary: StockSummary;
};

export default function StockSummaryPage({ initialSummary }: Props) {
  const [summary, setSummary] = useState<StockSummary>(initialSummary);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);

  const runFilter = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getStockSummaryAction({
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setSummary(result);
    } catch (err) {
      console.error("Failed to fetch stock summary:", err);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  const clearFilters = useCallback(async () => {
    setFromDate("");
    setToDate("");
    setLoading(true);
    try {
      const result = await getStockSummaryAction();
      setSummary(result);
    } catch (err) {
      console.error("Failed to fetch stock summary:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const toIsoDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const applyShortcut = useCallback(
    async (preset: "last_month" | "last_30_days") => {
      const now = new Date();
      let from = "";
      let to = "";

      if (preset === "last_month") {
        const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthFirst = new Date(firstOfThisMonth.getFullYear(), firstOfThisMonth.getMonth() - 1, 1);
        const lastMonthLast = new Date(firstOfThisMonth.getTime() - 24 * 60 * 60 * 1000);
        from = toIsoDate(lastMonthFirst);
        to = toIsoDate(lastMonthLast);
      } else if (preset === "last_30_days") {
        const start = new Date(now);
        start.setDate(start.getDate() - 29);
        from = toIsoDate(start);
        to = toIsoDate(now);
      }

      setFromDate(from);
      setToDate(to);
      setLoading(true);
      try {
        const result = await getStockSummaryAction({
          from: from || undefined,
          to: to || undefined,
        });
        setSummary(result);
      } catch (err) {
        console.error("Failed to fetch stock summary:", err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const rangeLabel = (() => {
    if (fromDate && toDate) return `${fromDate} → ${toDate}`;
    if (fromDate) return `from ${fromDate}`;
    if (toDate) return `up to ${toDate}`;
    return "all time";
  })();

  return (
    <div className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 sm:p-8">
        <header className="border-b border-zinc-200 pb-6 dark:border-zinc-600">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Stock Summary
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Aggregated ingredient and packaging usage across purchase orders in the chosen date range.
          </p>
        </header>

        <div className="mt-6 flex flex-wrap items-end gap-4">
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
            {loading ? "Loading…" : "Generate Summary"}
          </button>
          {(fromDate || toDate) && (
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

        <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm dark:border-zinc-600 dark:bg-zinc-800/50">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-zinc-700 dark:text-zinc-300">
            <div>
              <span className="font-semibold">Range:</span> {rangeLabel}
            </div>
            <div>
              <span className="font-semibold">POs included:</span> {summary.poCount}
            </div>
            <div>
              <span className="font-semibold">Ingredients:</span> {summary.ingredients.length}
            </div>
            <div>
              <span className="font-semibold">Packaging items:</span> {summary.packaging.length}
            </div>
          </div>
          {summary.poReferences.length > 0 && (
            <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold uppercase tracking-wider">Included POs:</span>{" "}
              {summary.poReferences.join(", ")}
            </div>
          )}
        </div>

        {summary.poCount === 0 ? (
          <div className="mt-6 py-16 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No purchase orders found in this date range.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {/* Ingredients */}
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                Ingredients Used
              </h2>
              {summary.ingredients.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-600 dark:text-zinc-400">
                  No ingredients recorded.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border-2 border-zinc-200 bg-white shadow-md dark:border-zinc-600 dark:bg-zinc-800">
                  <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-600">
                    <thead>
                      <tr className="bg-zinc-100 dark:bg-zinc-700/80">
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                          ID
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                          Ingredient
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                          Grams
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                          Kg
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                          POs
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-600">
                      {summary.ingredients.map((ing) => (
                        <tr key={ing.ingredientId} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/40">
                          <td className="whitespace-nowrap px-4 py-2.5 text-sm font-mono font-bold text-zinc-700 dark:text-zinc-200">
                            {ing.ingredientId}
                          </td>
                          <td className="px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100">
                            {ing.ingredientName}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                            {formatGrams(ing.totalGrams)} g
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                            {formatKg(ing.totalKg)} kg
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
                            {ing.poCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Packaging */}
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                Packaging Used
              </h2>
              {summary.packaging.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-600 dark:text-zinc-400">
                  No packaging recorded.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border-2 border-zinc-200 bg-white shadow-md dark:border-zinc-600 dark:bg-zinc-800">
                  <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-600">
                    <thead>
                      <tr className="bg-zinc-100 dark:bg-zinc-700/80">
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                          Code
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                          Item
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                          Quantity
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                          POs
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-600">
                      {summary.packaging.map((pkg) => (
                        <tr key={pkg.code} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/40">
                          <td className="whitespace-nowrap px-4 py-2.5 text-sm font-mono font-bold text-zinc-700 dark:text-zinc-200">
                            {pkg.code}
                          </td>
                          <td className="px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100">
                            {pkg.item}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                            {formatNumber(pkg.totalQuantity, { maxDecimals: 2 })}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
                            {pkg.poCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
