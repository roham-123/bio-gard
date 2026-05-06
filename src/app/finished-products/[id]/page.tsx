import { getFinishedProduct, getPackagingItems } from "@/lib/db";
import BackLink from "@/components/layout/BackLink";
import NotFoundCard from "@/components/layout/NotFoundCard";
import PageShell from "@/components/layout/PageShell";
import FinishedProductCalculator from "./FinishedProductCalculator";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function FinishedProductPage({ params }: Props) {
  const { id } = await params;
  const productId = parseInt(id, 10);
  if (Number.isNaN(productId)) {
    return (
      <NotFoundCard
        message="Invalid finished product ID."
        backHref="/finished-products"
        backLabel="Back to finished products"
      />
    );
  }

  const [product, packagingItems] = await Promise.all([
    getFinishedProduct(productId),
    getPackagingItems(),
  ]);

  if (!product) {
    return (
      <NotFoundCard
        message="Finished product not found."
        backHref="/finished-products"
        backLabel="Back to finished products"
      />
    );
  }

  return (
    <PageShell>
      <header className="border-b border-zinc-200 pb-6 dark:border-zinc-600">
        <BackLink href="/finished-products">Finished Products</BackLink>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          {product.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {product.sku ? `SKU: ${product.sku}` : "Unit-based finished product"}
        </p>
      </header>
      <section className="pt-6">
        <FinishedProductCalculator product={product} packagingItems={packagingItems} />
      </section>
    </PageShell>
  );
}
