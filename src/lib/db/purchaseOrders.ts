import type { PoolClient } from "pg";
import { withClient, withTransaction } from "./client";
import { logAction } from "./audit";

export type PurchaseOrder = {
  id: number;
  po_reference: string;
  recipe_id: number | null;
  recipe_name: string;
  batch_grams: number;
  units: number;
  source_type: "recipe" | "finished_product";
  finished_product_id: number | null;
  product_name: string | null;
  detail: Record<string, unknown>;
  created_at: string;
};

type PurchaseOrderRow = {
  id: number;
  po_reference: string;
  recipe_id: number | null;
  recipe_name: string;
  batch_grams: string;
  units: string;
  source_type?: "recipe" | "finished_product";
  finished_product_id?: number | null;
  product_name?: string | null;
  detail: Record<string, unknown>;
  created_at: string;
};

function mapPurchaseOrder(row: PurchaseOrderRow, fallbackSource: "recipe" | "finished_product" = "recipe"): PurchaseOrder {
  return {
    id: row.id,
    po_reference: row.po_reference,
    recipe_id: row.recipe_id,
    recipe_name: row.recipe_name,
    batch_grams: Number(row.batch_grams),
    units: Number(row.units),
    source_type: row.source_type ?? fallbackSource,
    finished_product_id: row.finished_product_id ?? null,
    product_name: row.product_name ?? row.recipe_name,
    detail: row.detail,
    created_at: row.created_at,
  };
}

/**
 * Compute the next "XX-####" reference. Must be called inside a transaction
 * so concurrent inserts don't collide.
 */
async function getNextPoReference(client: PoolClient): Promise<string> {
  const last = await client.query<{ po_reference: string }>(
    `SELECT po_reference FROM purchase_orders ORDER BY id DESC LIMIT 1`
  );
  let nextNum = 1;
  if (last.rows.length > 0) {
    const match = last.rows[0].po_reference.match(/^XX-(\d+)$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  return `XX-${String(nextNum).padStart(4, "0")}`;
}

export async function createPurchaseOrder(
  recipeId: number,
  recipeName: string,
  batchGrams: number,
  units: number,
  detail: Record<string, unknown>
): Promise<PurchaseOrder> {
  return withTransaction(async (client) => {
    const poReference = await getNextPoReference(client);
    const r = await client.query<PurchaseOrderRow>(
      `INSERT INTO purchase_orders (po_reference, recipe_id, recipe_name, batch_grams, units, detail)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, po_reference, recipe_id, recipe_name, batch_grams, units, detail, created_at`,
      [poReference, recipeId, recipeName, batchGrams, units, JSON.stringify(detail)]
    );
    const po = mapPurchaseOrder(r.rows[0], "recipe");
    await logAction(client, "create_purchase_order", "purchase_orders", po.id, {
      po_reference: po.po_reference,
      recipe_id: recipeId,
      recipe_name: recipeName,
    });
    return po;
  });
}

export async function createFinishedProductPurchaseOrder(
  finishedProductId: number,
  productName: string,
  units: number,
  detail: Record<string, unknown>
): Promise<PurchaseOrder> {
  return withTransaction(async (client) => {
    const poReference = await getNextPoReference(client);
    const r = await client.query<PurchaseOrderRow>(
      `INSERT INTO purchase_orders
         (po_reference, recipe_id, recipe_name, batch_grams, units, source_type, finished_product_id, product_name, detail)
       VALUES ($1, NULL, $2, 0, $3, 'finished_product', $4, $2, $5)
       RETURNING id, po_reference, recipe_id, recipe_name, batch_grams, units, source_type, finished_product_id, product_name, detail, created_at`,
      [poReference, productName, units, finishedProductId, JSON.stringify(detail)]
    );
    const po = mapPurchaseOrder(r.rows[0], "finished_product");
    await logAction(client, "create_purchase_order", "purchase_orders", po.id, {
      po_reference: po.po_reference,
      source_type: "finished_product",
      finished_product_id: finishedProductId,
      product_name: productName,
    });
    return po;
  });
}

export async function getPurchaseOrders(filters?: {
  search?: string;
  from?: string;
  to?: string;
}): Promise<PurchaseOrder[]> {
  return withClient(async (client) => {
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let idx = 1;

    if (filters?.search) {
      conditions.push(
        `(po_reference ILIKE $${idx} OR recipe_name ILIKE $${idx} OR product_name ILIKE $${idx})`
      );
      params.push(`%${filters.search}%`);
      idx++;
    }
    if (filters?.from) {
      conditions.push(`created_at >= $${idx}::timestamptz`);
      params.push(filters.from);
      idx++;
    }
    if (filters?.to) {
      conditions.push(`created_at < ($${idx}::date + interval '1 day')`);
      params.push(filters.to);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const r = await client.query<PurchaseOrderRow>(
      `SELECT id, po_reference, recipe_id, recipe_name, batch_grams, units,
              source_type, finished_product_id, product_name, detail, created_at
       FROM purchase_orders ${where}
       ORDER BY id DESC`,
      params
    );
    return r.rows.map((row) => mapPurchaseOrder(row));
  });
}
