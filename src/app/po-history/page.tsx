import { getPurchaseOrders } from "@/lib/db";
import PoHistoryPage from "./PoHistoryPage";

export const dynamic = "force-dynamic";

export default async function Page() {
  const orders = await getPurchaseOrders();
  return <PoHistoryPage initialOrders={orders} />;
}
