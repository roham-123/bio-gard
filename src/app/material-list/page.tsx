import { getIngredients } from "@/lib/db";
import MaterialListPage from "./MaterialListPage";

export const dynamic = "force-dynamic";

export default async function Page() {
  const ingredients = await getIngredients();
  return <MaterialListPage initialIngredients={ingredients} />;
}
