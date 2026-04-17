import { getStockSummary } from "@/lib/db";
import StockSummaryPage from "./StockSummaryPage";

export const dynamic = "force-dynamic";

export default async function Page() {
  const summary = await getStockSummary();
  return <StockSummaryPage initialSummary={summary} />;
}
