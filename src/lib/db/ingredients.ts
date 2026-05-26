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

export async function updateIngredient(
  ingredientId: string,
  name: string,
  stockCfuPerG: number,
  costPerKgGbp: number
): Promise<Ingredient | null> {
  return withClient(async (client) => {
    const before = await client.query<IngredientRow>(
      `SELECT id, name, stock_cfu_per_g, cost_per_kg_gbp FROM ingredients WHERE id = $1`,
      [ingredientId]
    );
    const prev = before.rows[0];
    if (!prev) return null;

    const r = await client.query<IngredientRow>(
      `UPDATE ingredients
         SET name = $1, stock_cfu_per_g = $2, cost_per_kg_gbp = $3
       WHERE id = $4
       RETURNING id, name, stock_cfu_per_g, cost_per_kg_gbp`,
      [name, stockCfuPerG, costPerKgGbp, ingredientId]
    );
    if (r.rowCount === 0) return null;
    const updated = mapIngredient(r.rows[0]);

    await logAction(client, "update_ingredient", "ingredients", ingredientId, {
      old_record: mapIngredient(prev),
      new_record: updated,
    });
    return updated;
  });
}

export type DeleteIngredientResult =
  | { deleted: true }
  | { deleted: false; reason: "not_found" }
  | { deleted: false; reason: "in_use"; usedByRecipes: { id: number; name: string }[] };

export async function deleteIngredient(
  ingredientId: string
): Promise<DeleteIngredientResult> {
  return withClient(async (client) => {
    const existing = await client.query<IngredientRow>(
      `SELECT id, name, stock_cfu_per_g, cost_per_kg_gbp FROM ingredients WHERE id = $1`,
      [ingredientId]
    );
    if (existing.rowCount === 0) {
      return { deleted: false, reason: "not_found" } as const;
    }

    const usage = await client.query<{ id: number; name: string }>(
      `SELECT DISTINCT r.id, r.name
         FROM recipe_lines rl
         JOIN recipes r ON r.id = rl.recipe_id
        WHERE rl.ingredient_id = $1
        ORDER BY r.name`,
      [ingredientId]
    );
    if ((usage.rowCount ?? 0) > 0) {
      return { deleted: false, reason: "in_use", usedByRecipes: usage.rows } as const;
    }

    await client.query(`DELETE FROM ingredients WHERE id = $1`, [ingredientId]);
    await logAction(client, "delete_ingredient", "ingredients", ingredientId, {
      deleted_record: mapIngredient(existing.rows[0]),
    });
    return { deleted: true } as const;
  });
}
