import { getRecipe, getPackagingItems } from "@/lib/db";
import BackLink from "@/components/layout/BackLink";
import NotFoundCard from "@/components/layout/NotFoundCard";
import PageShell from "@/components/layout/PageShell";
import RecipeCalculator from "./RecipeCalculator";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function RecipePage({ params }: Props) {
  const { id } = await params;
  const recipeId = parseInt(id, 10);
  if (Number.isNaN(recipeId)) {
    return <NotFoundCard message="Invalid formula ID." backHref="/recipes" backLabel="Back to formulas" />;
  }
  const [recipe, packagingItems] = await Promise.all([getRecipe(recipeId), getPackagingItems()]);
  if (!recipe) {
    return <NotFoundCard message="Formula not found." backHref="/recipes" backLabel="Back to formulas" />;
  }
  return (
    <PageShell>
      <header className="border-b border-zinc-200 pb-6 dark:border-zinc-600">
        <BackLink href="/recipes">Formulas</BackLink>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          {recipe.name}
        </h1>
      </header>
      <section className="pt-6">
        <RecipeCalculator recipe={recipe} packagingItems={packagingItems} />
      </section>
    </PageShell>
  );
}
