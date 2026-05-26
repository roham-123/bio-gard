import { withClient } from "./client";
import { logAction } from "./audit";

export type PackagingItem = {
  code: string;
  name: string;
  default_cost_gbp: number;
  default_cost_basis: string;
};

type PackagingItemRow = {
  code: string;
  name: string;
  default_cost_gbp: string;
  default_cost_basis: string;
};

function mapPackagingItem(row: PackagingItemRow): PackagingItem {
  return {
    code: row.code,
    name: row.name,
    default_cost_gbp: Number(row.default_cost_gbp),
    default_cost_basis: row.default_cost_basis,
  };
}

export async function getPackagingItems(): Promise<PackagingItem[]> {
  return withClient(async (client) => {
    const r = await client.query<PackagingItemRow>(
      "SELECT code, name, default_cost_gbp, default_cost_basis FROM packaging_items ORDER BY code"
    );
    return r.rows.map(mapPackagingItem);
  });
}

export async function createPackagingItem(
  code: string,
  name: string,
  defaultCostGbp: number,
  defaultCostBasis: string
): Promise<PackagingItem> {
  return withClient(async (client) => {
    const r = await client.query<PackagingItemRow>(
      `INSERT INTO packaging_items (code, name, default_cost_gbp, default_cost_basis)
       VALUES ($1, $2, $3, $4)
       RETURNING code, name, default_cost_gbp, default_cost_basis`,
      [code, name, defaultCostGbp, defaultCostBasis]
    );
    const item = mapPackagingItem(r.rows[0]);
    await logAction(client, "create_packaging_item", "packaging_items", item.code, { new_record: item });
    return item;
  });
}

export async function updatePackagingItem(
  code: string,
  name: string,
  defaultCostGbp: number,
  defaultCostBasis: string
): Promise<PackagingItem | null> {
  return withClient(async (client) => {
    const before = await client.query<PackagingItemRow>(
      `SELECT code, name, default_cost_gbp, default_cost_basis FROM packaging_items WHERE code = $1`,
      [code]
    );
    const prev = before.rows[0];
    if (!prev) return null;

    const r = await client.query<PackagingItemRow>(
      `UPDATE packaging_items
         SET name = $1, default_cost_gbp = $2, default_cost_basis = $3
       WHERE code = $4
       RETURNING code, name, default_cost_gbp, default_cost_basis`,
      [name, defaultCostGbp, defaultCostBasis, code]
    );
    if (r.rowCount === 0) return null;
    const updated = mapPackagingItem(r.rows[0]);

    await logAction(client, "update_packaging_item", "packaging_items", code, {
      old_record: mapPackagingItem(prev),
      new_record: updated,
    });
    return updated;
  });
}

export type DeletePackagingItemResult =
  | { deleted: true }
  | { deleted: false; reason: "not_found" }
  | {
      deleted: false;
      reason: "in_use";
      usedByRecipes: { id: number; name: string }[];
      usedByFinishedProducts: { id: number; name: string }[];
    };

export async function deletePackagingItem(code: string): Promise<DeletePackagingItemResult> {
  return withClient(async (client) => {
    const existing = await client.query<PackagingItemRow>(
      `SELECT code, name, default_cost_gbp, default_cost_basis FROM packaging_items WHERE code = $1`,
      [code]
    );
    if (existing.rowCount === 0) {
      return { deleted: false, reason: "not_found" } as const;
    }

    const recipeUsage = await client.query<{ id: number; name: string }>(
      `SELECT DISTINCT r.id, r.name
         FROM recipe_packaging_lines rpl
         JOIN recipes r ON r.id = rpl.recipe_id
        WHERE rpl.packaging_item_code = $1
        ORDER BY r.name`,
      [code]
    );
    const fpUsage = await client.query<{ id: number; name: string }>(
      `SELECT DISTINCT fp.id, fp.name
         FROM finished_product_packaging_lines fppl
         JOIN finished_products fp ON fp.id = fppl.finished_product_id
        WHERE fppl.packaging_item_code = $1
        ORDER BY fp.name`,
      [code]
    );
    if ((recipeUsage.rowCount ?? 0) > 0 || (fpUsage.rowCount ?? 0) > 0) {
      return {
        deleted: false,
        reason: "in_use",
        usedByRecipes: recipeUsage.rows,
        usedByFinishedProducts: fpUsage.rows,
      } as const;
    }

    await client.query(`DELETE FROM packaging_items WHERE code = $1`, [code]);
    await logAction(client, "delete_packaging_item", "packaging_items", code, {
      deleted_record: mapPackagingItem(existing.rows[0]),
    });
    return { deleted: true } as const;
  });
}
