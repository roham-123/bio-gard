import { getPackagingItems } from "@/lib/db";
import BackLink from "@/components/layout/BackLink";
import PageShell from "@/components/layout/PageShell";
import FinishedProductBuilder from "../FinishedProductBuilder";

export const dynamic = "force-dynamic";

export default async function NewFinishedProductPage() {
  const packagingItems = await getPackagingItems();

  return (
    <PageShell>
      <header className="border-b border-zinc-200 pb-6 dark:border-zinc-600">
        <BackLink href="/finished-products">Finished Products</BackLink>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          Create Finished Product
        </h1>
      </header>
      <section className="pt-6">
        <FinishedProductBuilder packagingItems={packagingItems} />
      </section>
    </PageShell>
  );
}
