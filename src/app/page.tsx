import { getRecipes } from "@/lib/db";
import CalculatorPage from "./CalculatorPage";

export const dynamic = "force-dynamic";

export default async function Home() {
  const recipes = await getRecipes();
  return <CalculatorPage recipes={recipes} />;
}
