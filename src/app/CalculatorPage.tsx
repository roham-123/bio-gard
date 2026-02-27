"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Recipe, RecipeWithLines } from "@/lib/db";
import { getRecipe } from "@/app/actions";
import RecipeCalculator from "@/app/recipes/[id]/RecipeCalculator";
import styles from "./CalculatorPage.module.css";

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
    <div className={styles.calculatorWindow}>
      <header className={styles.calculatorHeader}>
        <h1>Bio Gard Recipe Calculator</h1>
        <div className={styles.recipeSelector}>
          <input
            type="search"
            placeholder="Search recipes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
            aria-label="Search recipes"
          />
          <select
            value={selectedId ?? ""}
            onChange={handleSelect}
            className={styles.recipeDropdown}
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

      <section className={styles.calculatorBody}>
        {loading && <p className={styles.loading}>Loading recipe…</p>}
        {!loading && recipe && <RecipeCalculator recipe={recipe} />}
        {!loading && !recipe && selectedId != null && (
          <p className={styles.noRecipe}>Recipe not found.</p>
        )}
        {!loading && selectedId == null && (
          <p className={styles.hint}>Use the dropdown above to select a recipe and run the calculator.</p>
        )}
      </section>
    </div>
  );
}
