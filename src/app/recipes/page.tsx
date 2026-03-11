import Link from "next/link";
import { getRecipes } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const recipes = await getRecipes();
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          Formulas
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Choose a formula to open the calculator.
        </p>
        <ul className="mt-6 space-y-3">
          {recipes.map((r) => (
            <li key={r.id}>
              <Link
                href={`/recipes/${r.id}`}
                className="block rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-4 transition-colors hover:border-emerald-300 hover:bg-emerald-50/80 dark:border-zinc-600 dark:bg-zinc-700/50 dark:hover:border-emerald-600 dark:hover:bg-emerald-900/20"
              >
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {r.name}
                </span>
                <span className="mt-1 block text-sm text-zinc-500 dark:text-zinc-400">
                  Default batch: {r.default_batch_grams.toLocaleString()} g
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
