import Link from "next/link";
import { getFinishedProduct, getPackagingItems } from "@/lib/db";
import FinishedProductBuilder from "../../FinishedProductBuilder";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditFinishedProductPage({ params }: Props) {
  const { id } = await params;
  const productId = parseInt(id, 10);
  if (Number.isNaN(productId)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <p className="font-medium text-zinc-600 dark:text-zinc-400">Invalid finished product ID.</p>
          <Link href="/finished-products" className="mt-4 inline-block font-medium text-emerald-600 hover:underline dark:text-emerald-400">
            &larr; Back to finished products
          </Link>
        </div>
      </div>
    );
  }

  const [product, packagingItems] = await Promise.all([
    getFinishedProduct(productId),
    getPackagingItems(),
  ]);

  if (!product) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <p className="font-medium text-zinc-600 dark:text-zinc-400">Finished product not found.</p>
          <Link href="/finished-products" className="mt-4 inline-block font-medium text-emerald-600 hover:underline dark:text-emerald-400">
            &larr; Back to finished products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 sm:p-8">
        <header className="border-b border-zinc-200 pb-6 dark:border-zinc-600">
          <Link
            href={`/finished-products/${product.id}`}
            className="mb-4 inline-block font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            &larr; Back to finished product
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Edit: {product.name}
          </h1>
        </header>
        <section className="pt-6">
          <FinishedProductBuilder existingProduct={product} packagingItems={packagingItems} />
        </section>
      </div>
    </div>
  );
}
