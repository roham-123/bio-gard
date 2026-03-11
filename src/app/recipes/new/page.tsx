import Link from "next/link";
import { getIngredients } from "@/lib/db";
import RecipeBuilder from "./RecipeBuilder";

export const dynamic = "force-dynamic";

export default async function NewRecipePage() {
  const ingredients = await getIngredients();
  return (
    <div className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/recipes"
        className="mb-6 inline-block font-medium text-emerald-600 hover:underline dark:text-emerald-400"
      >
        &larr; Formulas
      </Link>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
        Create New Formula
      </h1>
      <RecipeBuilder ingredients={ingredients} />
    </div>
  );
}
