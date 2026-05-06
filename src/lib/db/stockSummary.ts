import { withClient } from "./client";

export type StockSummaryIngredient = {
  ingredientId: string;
  ingredientName: string;
  totalGrams: number;
  totalKg: number;
  poCount: number;
};

export type StockSummaryPackaging = {
  code: string;
  item: string;
  totalQuantity: number;
  poCount: number;
};

export type StockSummaryFinishedProduct = {
  finishedProductId: number | null;
  productName: string;
  sku: string | null;
  totalUnits: number;
  totalPacks: number;
  poCount: number;
};

export type StockSummary = {
  ingredients: StockSummaryIngredient[];
  packaging: StockSummaryPackaging[];
  finishedProducts: StockSummaryFinishedProduct[];
  poCount: number;
  poReferences: string[];
  from: string | null;
  to: string | null;
};

const STOCK_SUMMARY_EXCLUDED_PACKAGING = new Set(["PAKO"]);

export async function getStockSummary(filters?: {
  from?: string;
  to?: string;
}): Promise<StockSummary> {
  return withClient(async (client) => {
    const conditions: string[] = [];
    const params: string[] = [];
    let idx = 1;

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

    const r = await client.query<{
      po_reference: string;
      source_type: "recipe" | "finished_product";
      finished_product_id: number | null;
      product_name: string | null;
      detail: Record<string, unknown>;
    }>(
      `SELECT po_reference, source_type, finished_product_id, product_name, detail
       FROM purchase_orders ${where}
       ORDER BY id ASC`,
      params
    );

    type IngSnap = {
      ingredientId?: string;
      ingredientName?: string;
      grams?: number;
      kg?: number;
    };
    type PkgSnap = {
      code?: string;
      item?: string;
      quantity?: number;
    };
    type FinishedProductSnap = {
      productName?: string;
      sku?: string | null;
      units?: number;
      packs?: number;
    };

    const ingMap = new Map<string, StockSummaryIngredient>();
    const pkgMap = new Map<string, StockSummaryPackaging>();
    const finishedMap = new Map<string, StockSummaryFinishedProduct>();
    const poReferences: string[] = [];

    for (const row of r.rows) {
      poReferences.push(row.po_reference);
      const detail = row.detail ?? {};
      const ingredients = Array.isArray((detail as { ingredients?: unknown }).ingredients)
        ? ((detail as { ingredients: IngSnap[] }).ingredients)
        : [];
      const packaging = Array.isArray((detail as { packaging?: unknown }).packaging)
        ? ((detail as { packaging: PkgSnap[] }).packaging)
        : [];
      const finishedProductDetail = detail as FinishedProductSnap;

      if (row.source_type === "finished_product") {
        const productName = String(
          finishedProductDetail.productName ?? row.product_name ?? "Finished Product"
        );
        const sku =
          typeof finishedProductDetail.sku === "string" && finishedProductDetail.sku.trim()
            ? finishedProductDetail.sku.trim()
            : null;
        const units = Number(finishedProductDetail.units) || 0;
        const packs = Number(finishedProductDetail.packs) || 0;
        const key =
          row.finished_product_id != null ? `id:${row.finished_product_id}` : `name:${productName}`;
        const existing = finishedMap.get(key);
        if (existing) {
          existing.totalUnits += units;
          existing.totalPacks += packs;
          existing.poCount += 1;
        } else {
          finishedMap.set(key, {
            finishedProductId: row.finished_product_id,
            productName,
            sku,
            totalUnits: units,
            totalPacks: packs,
            poCount: 1,
          });
        }
      }

      for (const ing of ingredients) {
        if (!ing?.ingredientId) continue;
        const grams = Number(ing.grams) || 0;
        const kg = Number(ing.kg) || grams / 1000;
        const existing = ingMap.get(ing.ingredientId);
        if (existing) {
          existing.totalGrams += grams;
          existing.totalKg += kg;
          existing.poCount += 1;
        } else {
          ingMap.set(ing.ingredientId, {
            ingredientId: ing.ingredientId,
            ingredientName: ing.ingredientName ?? ing.ingredientId,
            totalGrams: grams,
            totalKg: kg,
            poCount: 1,
          });
        }
      }

      for (const pkg of packaging) {
        if (!pkg?.code) continue;
        if (STOCK_SUMMARY_EXCLUDED_PACKAGING.has(pkg.code)) continue;
        const qty = Number(pkg.quantity) || 0;
        const existing = pkgMap.get(pkg.code);
        if (existing) {
          existing.totalQuantity += qty;
          existing.poCount += 1;
        } else {
          pkgMap.set(pkg.code, {
            code: pkg.code,
            item: pkg.item ?? pkg.code,
            totalQuantity: qty,
            poCount: 1,
          });
        }
      }
    }

    const ingredients = Array.from(ingMap.values()).sort((a, b) =>
      a.ingredientId.localeCompare(b.ingredientId)
    );
    const packaging = Array.from(pkgMap.values()).sort((a, b) => a.code.localeCompare(b.code));
    const finishedProducts = Array.from(finishedMap.values()).sort((a, b) =>
      a.productName.localeCompare(b.productName)
    );

    return {
      ingredients,
      packaging,
      finishedProducts,
      poCount: r.rows.length,
      poReferences,
      from: filters?.from ?? null,
      to: filters?.to ?? null,
    };
  });
}
