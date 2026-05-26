import { getIngredients, getPackagingItems } from "@/lib/db";
import DatabasePage from "./DatabasePage";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [ingredients, packagingItems] = await Promise.all([
    getIngredients(),
    getPackagingItems(),
  ]);
  return (
    <DatabasePage
      initialIngredients={ingredients}
      initialPackagingItems={packagingItems}
    />
  );
}
