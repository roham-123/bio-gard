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
      <div style={{ padding: "2rem" }}>
        <p>Invalid recipe ID.</p>
        <Link href="/recipes">← Back to recipes</Link>
      </div>
    );
  }
  const recipe = await getRecipe(recipeId);
  if (!recipe) {
    return (
      <div style={{ padding: "2rem" }}>
        <p>Recipe not found.</p>
        <Link href="/recipes">← Back to recipes</Link>
      </div>
    );
  }
  return (
    <div style={{ padding: "2rem", maxWidth: 1200 }}>
      <p style={{ marginBottom: "0.5rem" }}>
        <Link href="/recipes">← Recipes</Link>
      </p>
      <h1>{recipe.name}</h1>
      <RecipeCalculator recipe={recipe} />
    </div>
  );
}
