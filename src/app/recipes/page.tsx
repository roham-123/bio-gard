import Link from "next/link";
import { getRecipes } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function RecipesPage({ searchParams }: Props) {
  const recipes = await getRecipes();
  const { q } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();
  const filtered = query
    ? recipes.filter((r) => r.name.toLowerCase().includes(query))
    : recipes;
  return (
    <div className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 sm:p-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-600">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
              All Formulas
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Browse every formula in the system and jump into the calculator.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <form
              action="/recipes"
              className="flex items-center gap-2"
            >
              <input
                type="search"
                name="q"
                placeholder="Search formulas"
                defaultValue={query}
                className="w-52 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-emerald-400 dark:focus:bg-zinc-700"
              />
              <button
                type="submit"
                className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600 dark:focus:ring-offset-zinc-800"
              >
                Search
              </button>
            </form>
            <Link
              href="/"
              className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600 dark:focus:ring-offset-zinc-800"
            >
              ← Home
            </Link>
            <Link
              href="/recipes/new"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-800"
            >
              <span className="text-lg leading-none">+</span>
              Create New Formula
            </Link>
          </div>
        </header>

        <section className="pt-6">
          {filtered.length === 0 ? (
            <p className="py-10 text-sm text-zinc-500 dark:text-zinc-400">
              No formulas found. Try a different search or create a new formula.
            </p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/recipes/${r.id}`}
                    className="flex h-full flex-col justify-between rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-4 transition-colors hover:border-emerald-300 hover:bg-emerald-50/80 dark:border-zinc-600 dark:bg-zinc-700/50 dark:hover:border-emerald-600 dark:hover:bg-emerald-900/20"
                  >
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {r.name}
                      </h2>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Default batch: {r.default_batch_grams.toLocaleString()} g
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
