import Link from "next/link";
import { getFinishedProducts } from "@/lib/db";
import { formatCurrency, formatNumber } from "@/lib/format";
import PageShell from "@/components/layout/PageShell";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function FinishedProductsPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const products = await getFinishedProducts({ search: query || undefined });

  return (
    <PageShell>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-600">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
              Finished Products
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Browse unit-based products that do not require formulation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <form action="/finished-products" className="flex items-center gap-2">
              <input
                type="search"
                name="q"
                placeholder="Search products"
                defaultValue={query}
                className="w-52 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700/50 dark:text-zinc-100"
              />
              <button
                type="submit"
                className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
              >
                Search
              </button>
            </form>
            <Link
              href="/finished-products/new"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              <span className="text-lg leading-none">+</span>
              Create Finished Product
            </Link>
          </div>
        </header>

        <section className="pt-6">
          {products.length === 0 ? (
            <p className="py-10 text-sm text-zinc-500 dark:text-zinc-400">
              No finished products found. Try a different search or create a new product.
            </p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/finished-products/${product.id}`}
                    className="flex h-full flex-col justify-between rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-4 transition-colors hover:border-emerald-300 hover:bg-emerald-50/80 dark:border-zinc-600 dark:bg-zinc-700/50 dark:hover:border-emerald-600"
                  >
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {product.name}
                      </h2>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {product.sku ? `SKU: ${product.sku}` : "No SKU"}
                      </p>
                    </div>
                    <div className="mt-4 grid gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>Cost per pack: {formatCurrency(product.base_unit_cost_gbp)}</span>
                      <span>
                        Units per pack: {formatNumber(product.default_units_per_pack, { maxDecimals: 2 })}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
    </PageShell>
  );
}
