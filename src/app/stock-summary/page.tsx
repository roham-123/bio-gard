import { getStockSummary } from "@/lib/db";
import StockSummaryPage from "@/app/stock-summary/StockSummaryPage";

export const dynamic = "force-dynamic";

export default async function Page() {
  const summary = await getStockSummary();
  return <StockSummaryPage initialSummary={summary} />;
}
