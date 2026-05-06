import { withClient } from "./client";
import { logAction } from "./audit";

export type Ingredient = {
  id: string;
  name: string;
  stock_cfu_per_g: number;
  cost_per_kg_gbp: number;
};

type IngredientRow = {
  id: string;
  name: string;
  stock_cfu_per_g: string;
  cost_per_kg_gbp: string;
};

function mapIngredient(row: IngredientRow): Ingredient {
  return {
    id: row.id,
    name: row.name,
    stock_cfu_per_g: Number(row.stock_cfu_per_g),
    cost_per_kg_gbp: Number(row.cost_per_kg_gbp),
  };
}

export async function getIngredients(): Promise<Ingredient[]> {
  return withClient(async (client) => {
    const r = await client.query<IngredientRow>(
      "SELECT id, name, stock_cfu_per_g, cost_per_kg_gbp FROM ingredients ORDER BY name"
    );
    return r.rows.map(mapIngredient);
  });
}

export async function createIngredient(
  id: string,
  name: string,
  stockCfuPerG: number,
  costPerKgGbp: number
): Promise<Ingredient> {
  return withClient(async (client) => {
    const r = await client.query<IngredientRow>(
      `INSERT INTO ingredients (id, name, stock_cfu_per_g, cost_per_kg_gbp)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, stock_cfu_per_g, cost_per_kg_gbp`,
      [id, name, stockCfuPerG, costPerKgGbp]
    );
    const ingredient = mapIngredient(r.rows[0]);
    await logAction(client, "create_ingredient", "ingredients", ingredient.id, {
      new_record: ingredient,
    });
    return ingredient;
  });
}

export async function updateIngredientCostPerKg(
  ingredientId: string,
  costPerKgGbp: number
): Promise<boolean> {
  return withClient(async (client) => {
    const before = await client.query<{ name: string; cost_per_kg_gbp: string }>(
      `SELECT name, cost_per_kg_gbp FROM ingredients WHERE id = $1`,
      [ingredientId]
    );
    const r = await client.query(
      `UPDATE ingredients SET cost_per_kg_gbp = $1 WHERE id = $2`,
      [costPerKgGbp, ingredientId]
    );
    const updated = (r.rowCount ?? 0) > 0;
    if (updated) {
      const prev = before.rows[0];
      await logAction(client, "update_ingredient_cost", "ingredients", ingredientId, {
        ingredient_name: prev?.name,
        old_cost_per_kg_gbp: prev?.cost_per_kg_gbp != null ? Number(prev.cost_per_kg_gbp) : null,
        new_cost_per_kg_gbp: costPerKgGbp,
      });
    }
    return updated;
  });
}
