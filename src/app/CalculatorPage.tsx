"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PackagingItem, Recipe, RecipeWithLines } from "@/lib/db";
import { getPackagingItemsAction, getRecipe } from "@/app/actions";
import RecipeCalculator from "@/app/recipes/[id]/RecipeCalculator";
import type { CurrencyCode } from "@/lib/format";

type Props = {
  recipes: Recipe[];
};

export default function CalculatorPage({ recipes }: Props) {
  const [currency, setCurrency] = useState<CurrencyCode>("GBP");
  const [rates, setRates] = useState<Record<CurrencyCode, number>>({
    GBP: 1,
    EUR: 1.17,
    PLN: 5.05,
  });
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<string>("");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [recipe, setRecipe] = useState<RecipeWithLines | null>(null);
  const [packagingItems, setPackagingItems] = useState<PackagingItem[]>([]);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.name.toLowerCase().includes(q));
  }, [recipes, search]);

  const searchResults = useMemo(() => {
    if (submittedSearch == null || submittedSearch === "") return [];
    const q = submittedSearch.trim().toLowerCase();
    return recipes.filter((r) => r.name.toLowerCase().includes(q));
  }, [recipes, submittedSearch]);

  const selectionInFiltered = selectedId != null && filtered.some((r) => r.id === selectedId);

  const runSearch = useCallback(() => {
    const q = search.trim();
    setSubmittedSearch(q || null);
  }, [search]);

  const pickFromSearch = useCallback((id: number) => {
    setSelectedId(id);
    setSubmittedSearch(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPackagingItemsAction()
      .then((items) => {
        if (!cancelled) setPackagingItems(items ?? []);
      })
      .catch(() => {
        if (!cancelled) setPackagingItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedId == null) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    getRecipe(selectedId)
      .then((r) => {
        if (!cancelled) setRecipe(r ?? null);
      })
      .catch(() => {
        if (!cancelled) setRecipe(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const handleSelect = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value ? Number(e.target.value) : null;
    setSelectedId(id);
    if (id == null) setRecipe(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchRates = async () => {
      try {
        const res = await fetch("https://api.frankfurter.app/latest?from=GBP&to=EUR,PLN");
        if (!res.ok) return;
        const data = (await res.json()) as {
          date?: string;
          rates?: { EUR?: number; PLN?: number };
        };
        if (cancelled || !data.rates) return;
        setRates((prev) => ({
          ...prev,
          GBP: 1,
          EUR: data.rates?.EUR ?? prev.EUR,
          PLN: data.rates?.PLN ?? prev.PLN,
        }));
        setRatesUpdatedAt(data.date ?? "");
      } catch {
        // Keep existing/fallback rates if the API fails.
      }
    };

    void fetchRates();
    const id = window.setInterval(fetchRates, 10 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const activeRate = rates[currency] ?? 1;
  const fxRate = Number.isFinite(activeRate) && activeRate > 0 ? activeRate : 1;

  return (
    <div className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 sm:p-8">
        <header className="border-b border-zinc-200 pb-6 dark:border-zinc-600">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Bio Gard Formula Calculator
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Select a formula, set batch size, and adjust CFU options and costs.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Currency
            </span>
            {(["GBP", "EUR", "PLN"] as CurrencyCode[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setCurrency(code)}
                className={[
                  "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  currency === code
                    ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500"
                    : "border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600",
                ].join(" ")}
              >
                {code}
              </button>
            ))}
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Live rate: 1 GBP = {fxRate.toFixed(4)} {currency}
              {ratesUpdatedAt ? ` (updated ${ratesUpdatedAt})` : ""}
            </span>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <input
              type="search"
              placeholder="Search formulas (press Enter)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              className="min-w-[220px] rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-emerald-400 dark:focus:bg-zinc-700"
              aria-label="Search formulas"
            />
            <button
              type="button"
              onClick={runSearch}
              className="rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 dark:focus:border-emerald-400 dark:focus:bg-zinc-700"
            >
              Search
            </button>
            <select
              value={selectionInFiltered ? selectedId : ""}
              onChange={handleSelect}
              className="min-w-[300px] rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-100 dark:focus:border-emerald-400 dark:focus:bg-zinc-700"
              aria-label="Select formula"
            >
              <option value="">
                {search.trim() && filtered.length === 0
                  ? "No formulas match"
                  : "Select a formula"}
              </option>
              {filtered.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <Link
              href="/recipes/new"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-800"
            >
              <span className="text-lg leading-none">+</span>
              Create New Formula
            </Link>
          </div>
        </header>

        <section className="min-h-[240px] pt-6">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Loading formula…
              </p>
            </div>
          )}
          {!loading && recipe && selectionInFiltered && (
            <RecipeCalculator
              key={`${recipe.id}-${currency}`}
              recipe={recipe}
              currency={currency}
              gbpToCurrencyRate={fxRate}
              packagingItems={packagingItems}
            />
          )}
          {!loading && !recipe && selectedId != null && (
            <div className="py-16 text-center">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Formula not found.
              </p>
            </div>
          )}
          {!loading && submittedSearch != null && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Formulas matching &ldquo;{submittedSearch}&rdquo;
                </h2>
                <button
                  type="button"
                  onClick={() => setSubmittedSearch(null)}
                  className="text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Clear search
                </button>
              </div>
              {searchResults.length === 0 ? (
                <p className="py-8 text-sm text-zinc-500 dark:text-zinc-400">
                  No formulas match &ldquo;{submittedSearch}&rdquo;.
                </p>
              ) : (
                <ul className="space-y-3">
                  {searchResults.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => pickFromSearch(r.id)}
                        className="block w-full rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-4 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/80 dark:border-zinc-600 dark:bg-zinc-700/50 dark:hover:border-emerald-600 dark:hover:bg-emerald-900/20"
                      >
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {r.name}
                        </span>
                        <span className="mt-1 block text-sm text-zinc-500 dark:text-zinc-400">
                          Default batch: {r.default_batch_grams.toLocaleString()} g
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {!loading && submittedSearch == null && (!selectionInFiltered || selectedId == null) && (
            <div className="py-16 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Search by keyword (press Enter) or choose a formula from the dropdown above.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
