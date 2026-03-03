import Link from "next/link";
import { getRecipe } from "@/lib/db";
import RecipeCalculator from "./RecipeCalculator";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function RecipePage({ params }: Props) {
  const { id } = await params;
  const recipeId = parseInt(id, 10);
  if (Number.isNaN(recipeId)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <p className="font-medium text-zinc-600 dark:text-zinc-400">Invalid recipe ID.</p>
          <Link
            href="/recipes"
            className="mt-4 inline-block font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            ← Back to recipes
          </Link>
        </div>
      </div>
    );
  }
  const recipe = await getRecipe(recipeId);
  if (!recipe) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <p className="font-medium text-zinc-600 dark:text-zinc-400">Recipe not found.</p>
          <Link
            href="/recipes"
            className="mt-4 inline-block font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            ← Back to recipes
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/recipes"
        className="mb-6 inline-block font-medium text-emerald-600 hover:underline dark:text-emerald-400"
      >
        ← Recipes
      </Link>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
        {recipe.name}
      </h1>
      <RecipeCalculator recipe={recipe} />
    </div>
  );
}
