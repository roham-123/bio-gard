import Link from "next/link";
import { getRecipes } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const recipes = await getRecipes();
  return (
    <div style={{ padding: "2rem", maxWidth: 720 }}>
      <h1>Recipes</h1>
      <ul style={{ listStyle: "none", marginTop: "1rem" }}>
        {recipes.map((r) => (
          <li key={r.id} style={{ marginBottom: "0.5rem" }}>
            <Link
              href={`/recipes/${r.id}`}
              style={{ fontSize: "1.1rem", textDecoration: "underline" }}
            >
              {r.name}
            </Link>
            <span style={{ color: "var(--foreground)", opacity: 0.7, marginLeft: "0.5rem" }}>
              (default batch: {r.default_batch_grams.toLocaleString()} g)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
