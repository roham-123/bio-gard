import { getIngredients } from "@/lib/db";
import BackLink from "@/components/layout/BackLink";
import PageShell from "@/components/layout/PageShell";
import RecipeBuilder from "./RecipeBuilder";

export const dynamic = "force-dynamic";

export default async function NewRecipePage() {
  const ingredients = await getIngredients();
  return (
    <PageShell>
      <header className="border-b border-zinc-200 pb-6 dark:border-zinc-600">
        <BackLink href="/recipes">Formulas</BackLink>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          Create New Formula
        </h1>
      </header>
      <section className="pt-6">
        <RecipeBuilder ingredients={ingredients} />
      </section>
    </PageShell>
  );
}
