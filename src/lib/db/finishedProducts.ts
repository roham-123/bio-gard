import { withClient, withTransaction } from "./client";
import { logAction } from "./audit";
import { fetchLabels, labelMappers, type FinishedProductLabel } from "./labels";

export type FinishedProduct = {
  id: number;
  name: string;
  sku: string | null;
  default_units_per_pack: number;
  base_unit_cost_gbp: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type FinishedProductPackagingLine = {
  id: number;
  finished_product_id: number;
  packaging_item_code: string;
  packaging_item_name: string;
  sort_order: number;
  usage_basis: "per_unit" | "per_pack";
  cost_gbp: number;
  quantity_multiplier: number;
  units_per_pack: number | null;
};

export type FinishedProductWithPackagingLines = FinishedProduct & {
  packaging_lines: FinishedProductPackagingLine[];
  labels: FinishedProductLabel[];
};

export type CreateFinishedProductInput = {
  name: string;
  sku: string | null;
  defaultUnitsPerPack: number;
  baseUnitCostGbp: number;
  notes: string | null;
};

export type CreateFinishedProductPackagingLineInput = {
  packagingItemCode: string;
  sortOrder: number;
  usageBasis: "per_unit" | "per_pack";
  costGbp: number;
  quantityMultiplier: number;
  unitsPerPack: number | null;
};

type FinishedProductRow = {
  id: number;
  name: string;
  sku: string | null;
  default_units_per_pack: string;
  base_unit_cost_gbp: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapFinishedProduct(row: FinishedProductRow): FinishedProduct {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    default_units_per_pack: Number(row.default_units_per_pack),
    base_unit_cost_gbp: Number(row.base_unit_cost_gbp),
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getFinishedProducts(filters?: {
  search?: string;
}): Promise<FinishedProduct[]> {
  return withClient(async (client) => {
    const params: string[] = [];
    let where = "";
    if (filters?.search?.trim()) {
      params.push(`%${filters.search.trim()}%`);
      where = "WHERE name ILIKE $1 OR sku ILIKE $1";
    }
    const r = await client.query<FinishedProductRow>(
      `SELECT id, name, sku, default_units_per_pack, base_unit_cost_gbp, notes, created_at, updated_at
       FROM finished_products
       ${where}
       ORDER BY name`,
      params
    );
    return r.rows.map(mapFinishedProduct);
  });
}

export async function getFinishedProduct(
  productId: number
): Promise<FinishedProductWithPackagingLines | null> {
  return withClient(async (client) => {
    const productResult = await client.query<FinishedProductRow>(
      `SELECT id, name, sku, default_units_per_pack, base_unit_cost_gbp, notes, created_at, updated_at
       FROM finished_products
       WHERE id = $1`,
      [productId]
    );
    const productRow = productResult.rows[0];
    if (!productRow) return null;

    const packagingResult = await client.query<{
      id: number;
      finished_product_id: number;
      packaging_item_code: string;
      sort_order: number;
      usage_basis: "per_unit" | "per_pack";
      cost_gbp: string;
      quantity_multiplier: string;
      units_per_pack: string | null;
      item_name: string;
    }>(
      `SELECT fppl.id,
              fppl.finished_product_id,
              fppl.packaging_item_code,
              fppl.sort_order,
              fppl.usage_basis,
              fppl.cost_gbp,
              fppl.quantity_multiplier,
              fppl.units_per_pack,
              pi.name AS item_name
       FROM finished_product_packaging_lines fppl
       JOIN packaging_items pi ON pi.code = fppl.packaging_item_code
       WHERE fppl.finished_product_id = $1
       ORDER BY fppl.sort_order`,
      [productId]
    );

    const packaging_lines: FinishedProductPackagingLine[] = packagingResult.rows.map((r) => ({
      id: r.id,
      finished_product_id: r.finished_product_id,
      packaging_item_code: r.packaging_item_code,
      packaging_item_name: r.item_name,
      sort_order: r.sort_order,
      usage_basis: r.usage_basis,
      cost_gbp: Number(r.cost_gbp),
      quantity_multiplier: Number(r.quantity_multiplier),
      units_per_pack: r.units_per_pack == null ? null : Number(r.units_per_pack),
    }));

    const labels = await fetchLabels(
      client,
      "finished_product",
      productId,
      labelMappers.finished_product
    );

    return {
      ...mapFinishedProduct(productRow),
      packaging_lines,
      labels,
    };
  });
}

export async function createFinishedProduct(
  input: CreateFinishedProductInput
): Promise<{ id: number }> {
  return withTransaction(async (client) => {
    const r = await client.query<{ id: number }>(
      `INSERT INTO finished_products (name, sku, default_units_per_pack, base_unit_cost_gbp, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        input.name,
        input.sku?.trim() ? input.sku.trim() : null,
        input.defaultUnitsPerPack,
        input.baseUnitCostGbp,
        input.notes?.trim() ? input.notes.trim() : null,
      ]
    );
    const productId = r.rows[0].id;
    await logAction(client, "create_finished_product", "finished_products", productId, {
      name: input.name,
      sku: input.sku,
      default_units_per_pack: input.defaultUnitsPerPack,
      base_unit_cost_gbp: input.baseUnitCostGbp,
    });
    return { id: productId };
  });
}

export async function updateFinishedProduct(
  productId: number,
  input: CreateFinishedProductInput
): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE finished_products
       SET name = $1,
           sku = $2,
           default_units_per_pack = $3,
           base_unit_cost_gbp = $4,
           notes = $5,
           updated_at = NOW()
       WHERE id = $6`,
      [
        input.name,
        input.sku?.trim() ? input.sku.trim() : null,
        input.defaultUnitsPerPack,
        input.baseUnitCostGbp,
        input.notes?.trim() ? input.notes.trim() : null,
        productId,
      ]
    );
    await logAction(client, "update_finished_product", "finished_products", productId, {
      name: input.name,
      sku: input.sku,
      default_units_per_pack: input.defaultUnitsPerPack,
      base_unit_cost_gbp: input.baseUnitCostGbp,
    });
  });
}

export async function saveFinishedProductPackagingLines(
  productId: number,
  lines: CreateFinishedProductPackagingLineInput[]
): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      "DELETE FROM finished_product_packaging_lines WHERE finished_product_id = $1",
      [productId]
    );
    for (const line of lines) {
      await client.query(
        `INSERT INTO finished_product_packaging_lines
           (finished_product_id, packaging_item_code, sort_order, usage_basis, cost_gbp, quantity_multiplier, units_per_pack)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          productId,
          line.packagingItemCode,
          line.sortOrder,
          line.usageBasis,
          line.costGbp,
          line.quantityMultiplier,
          line.unitsPerPack,
        ]
      );
    }
    await logAction(
      client,
      "save_finished_product_packaging_lines",
      "finished_products",
      productId,
      { line_count: lines.length }
    );
  });
}
