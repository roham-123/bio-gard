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
