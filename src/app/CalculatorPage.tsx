"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Recipe, RecipeWithLines } from "@/lib/db";
import { getRecipe } from "@/app/actions";
import RecipeCalculator from "@/app/recipes/[id]/RecipeCalculator";

type Props = {
  recipes: Recipe[];
};

export default function CalculatorPage({ recipes }: Props) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [recipe, setRecipe] = useState<RecipeWithLines | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.name.toLowerCase().includes(q));
  }, [recipes, search]);

  useEffect(() => {
    if (selectedId == null) {
      setRecipe(null);
      return;
    }
    setLoading(true);
    getRecipe(selectedId)
      .then((r) => {
        setRecipe(r ?? null);
      })
      .finally(() => setLoading(false));
  }, [selectedId]);

  const handleSelect = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value ? Number(e.target.value) : null;
    setSelectedId(id);
  }, []);

  return (
    <div className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 sm:p-8">
        <header className="border-b border-zinc-200 pb-6 dark:border-zinc-600">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Bio Gard Recipe Calculator
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Select a recipe, set batch size, and adjust CFU options and costs.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <input
              type="search"
              placeholder="Search recipes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-[220px] rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-emerald-400 dark:focus:bg-zinc-700"
              aria-label="Search recipes"
            />
            <select
              value={selectedId ?? ""}
              onChange={handleSelect}
              className="min-w-[300px] rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-100 dark:focus:border-emerald-400 dark:focus:bg-zinc-700"
              aria-label="Select recipe"
            >
              <option value="">Select a recipe</option>
              {filtered.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </header>

        <section className="min-h-[240px] pt-6">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Loading recipe…
              </p>
            </div>
          )}
          {!loading && recipe && <RecipeCalculator recipe={recipe} />}
          {!loading && !recipe && selectedId != null && (
            <div className="py-16 text-center">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Recipe not found.
              </p>
            </div>
          )}
          {!loading && selectedId == null && (
            <div className="py-16 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Use the dropdown above to select a recipe and run the calculator.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
