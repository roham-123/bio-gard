import Link from "next/link";
import { getPackagingItems } from "@/lib/db";
import FinishedProductBuilder from "../FinishedProductBuilder";

export const dynamic = "force-dynamic";

export default async function NewFinishedProductPage() {
  const packagingItems = await getPackagingItems();

  return (
    <div className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 sm:p-8">
        <header className="border-b border-zinc-200 pb-6 dark:border-zinc-600">
          <Link
            href="/finished-products"
            className="mb-4 inline-block font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            &larr; Finished Products
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Create Finished Product
          </h1>
        </header>
        <section className="pt-6">
          <FinishedProductBuilder packagingItems={packagingItems} />
        </section>
      </div>
    </div>
  );
}
