import Link from "next/link";
import { getRecipe, getIngredients } from "@/lib/db";
import RecipeBuilder from "../../new/RecipeBuilder";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditRecipePage({ params }: Props) {
  const { id } = await params;
  const recipeId = parseInt(id, 10);
  if (Number.isNaN(recipeId)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <p className="font-medium text-zinc-600 dark:text-zinc-400">Invalid formula ID.</p>
          <Link
            href="/recipes"
            className="mt-4 inline-block font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            &larr; Back to formulas
          </Link>
        </div>
      </div>
    );
  }

  const [recipe, ingredients] = await Promise.all([getRecipe(recipeId), getIngredients()]);

  if (!recipe) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <p className="font-medium text-zinc-600 dark:text-zinc-400">Formula not found.</p>
          <Link
            href="/recipes"
            className="mt-4 inline-block font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            &larr; Back to formulas
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
            href={`/recipes/${recipe.id}`}
            className="mb-4 inline-block font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            &larr; Back to formula
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Edit: {recipe.name}
          </h1>
        </header>
        <section className="pt-6">
          <RecipeBuilder ingredients={ingredients} existingRecipe={recipe} />
        </section>
      </div>
    </div>
  );
}
