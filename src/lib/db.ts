import { Pool, PoolClient } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function logAction(
  client: PoolClient,
  action: string,
  entityType: string,
  entityId: string | number | null,
  detail: Record<string, unknown>
): Promise<void> {
  await client.query(
    `INSERT INTO audit_log (action, entity_type, entity_id, detail)
     VALUES ($1, $2, $3, $4)`,
    [action, entityType, entityId != null ? String(entityId) : null, JSON.stringify(detail)]
  );
}

export type Recipe = {
  id: number;
  name: string;
  default_batch_grams: number;
  default_kg_per_set: number;
};

export type Ingredient = {
  id: string;
  name: string;
  stock_cfu_per_g: number;
  cost_per_kg_gbp: number;
};

export type RecipeLine = {
  id: number;
  recipe_id: number;
  ingredient_id: string;
  sort_order: number;
  target_total_cfu: number;
  default_grams: number;
  filler_mode: "fixed" | "ratio" | "remainder";
  filler_ratio: number;
};

export type RecipeWithLines = Recipe & {
  lines: (RecipeLine & {
    ingredient: Ingredient;
  })[];
};

export async function getRecipes(): Promise<Recipe[]> {
  const client = await pool.connect();
  try {
    const r = await client.query<{ id: number; name: string; default_batch_grams: string; default_kg_per_set: string }>(
      "SELECT id, name, default_batch_grams, default_kg_per_set FROM recipes ORDER BY name"
    );
    return r.rows.map((row) => ({
      id: row.id,
      name: row.name,
      default_batch_grams: Number(row.default_batch_grams),
      default_kg_per_set: Number(row.default_kg_per_set),
    }));
  } finally {
    client.release();
  }
}

export async function getRecipe(recipeId: number): Promise<RecipeWithLines | null> {
  const client = await pool.connect();
  try {
    const recipeResult = await client.query<Recipe>(
      "SELECT id, name, default_batch_grams, default_kg_per_set FROM recipes WHERE id = $1",
      [recipeId]
    );
    const recipe = recipeResult.rows[0];
    if (!recipe) return null;

    const linesResult = await client.query<{
      id: number;
      recipe_id: number;
      ingredient_id: string;
      sort_order: number;
      target_total_cfu: string;
      default_grams: string;
      filler_mode: "fixed" | "ratio" | "remainder";
      filler_ratio: string;
      ing_id: string;
      ing_name: string;
      ing_stock_cfu: string;
      ing_cost: string;
    }>(
      `SELECT rl.id,
              rl.recipe_id,
              rl.ingredient_id,
              rl.sort_order,
              rl.target_total_cfu,
              rl.default_grams,
              rl.filler_mode,
              rl.filler_ratio,
              i.id AS ing_id, i.name AS ing_name,
              i.stock_cfu_per_g AS ing_stock_cfu,
              i.cost_per_kg_gbp AS ing_cost
       FROM recipe_lines rl
       JOIN ingredients i ON i.id = rl.ingredient_id
       WHERE rl.recipe_id = $1
       ORDER BY rl.sort_order`,
      [recipeId]
    );

    const lines: RecipeWithLines["lines"] = linesResult.rows.map((r) => ({
      id: r.id,
      recipe_id: r.recipe_id,
      ingredient_id: r.ingredient_id,
      sort_order: r.sort_order,
      target_total_cfu: Number(r.target_total_cfu),
      default_grams: Number(r.default_grams),
      filler_mode: r.filler_mode,
      filler_ratio: Number(r.filler_ratio),
      ingredient: {
        id: r.ing_id,
        name: r.ing_name,
        stock_cfu_per_g: Number(r.ing_stock_cfu),
        cost_per_kg_gbp: Number(r.ing_cost),
      },
    }));

    return {
      id: recipe.id,
      name: recipe.name,
      default_batch_grams: Number(recipe.default_batch_grams),
      default_kg_per_set: Number(recipe.default_kg_per_set),
      lines,
    };
  } finally {
    client.release();
  }
}

export async function getIngredients(): Promise<Ingredient[]> {
  const client = await pool.connect();
  try {
    const r = await client.query<{
      id: string;
      name: string;
      stock_cfu_per_g: string;
      cost_per_kg_gbp: string;
    }>("SELECT id, name, stock_cfu_per_g, cost_per_kg_gbp FROM ingredients ORDER BY name");
    return r.rows.map((row) => ({
      id: row.id,
      name: row.name,
      stock_cfu_per_g: Number(row.stock_cfu_per_g),
      cost_per_kg_gbp: Number(row.cost_per_kg_gbp),
    }));
  } finally {
    client.release();
  }
}

export async function createIngredient(
  id: string,
  name: string,
  stockCfuPerG: number,
  costPerKgGbp: number
): Promise<Ingredient> {
  const client = await pool.connect();
  try {
    const r = await client.query<{ id: string; name: string; stock_cfu_per_g: string; cost_per_kg_gbp: string }>(
      `INSERT INTO ingredients (id, name, stock_cfu_per_g, cost_per_kg_gbp)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, stock_cfu_per_g, cost_per_kg_gbp`,
      [id, name, stockCfuPerG, costPerKgGbp]
    );
    const row = r.rows[0];
    const ingredient: Ingredient = {
      id: row.id,
      name: row.name,
      stock_cfu_per_g: Number(row.stock_cfu_per_g),
      cost_per_kg_gbp: Number(row.cost_per_kg_gbp),
    };
    await logAction(client, "create_ingredient", "ingredients", ingredient.id, {
      new_record: ingredient,
    });
    return ingredient;
  } finally {
    client.release();
  }
}

export type CreateRecipeLineInput = {
  ingredientId: string;
  sortOrder: number;
  targetTotalCfu: number;
  defaultGrams: number;
  fillerMode: "fixed" | "ratio" | "remainder";
  fillerRatio: number;
};

export async function createRecipe(
  name: string,
  defaultBatchGrams: number,
  lines: CreateRecipeLineInput[],
  defaultKgPerSet = 1
): Promise<{ id: number }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const recipeResult = await client.query<{ id: number }>(
      `INSERT INTO recipes (name, default_batch_grams, default_kg_per_set) VALUES ($1, $2, $3) RETURNING id`,
      [name, defaultBatchGrams, defaultKgPerSet]
    );
    const recipeId = recipeResult.rows[0].id;

    for (const line of lines) {
      const lineResult = await client.query<{ id: number }>(
        `INSERT INTO recipe_lines
           (recipe_id, ingredient_id, sort_order, target_total_cfu, default_grams, filler_mode, filler_ratio)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          recipeId,
          line.ingredientId,
          line.sortOrder,
          line.targetTotalCfu,
          line.defaultGrams,
          line.fillerMode,
          line.fillerRatio,
        ]
      );
      await logAction(client, "create_recipe_line", "recipe_lines", lineResult.rows[0].id, {
        recipe_id: recipeId,
        recipe_name: name,
        ingredient_id: line.ingredientId,
        sort_order: line.sortOrder,
      });
    }

    await logAction(client, "create_recipe", "recipes", recipeId, {
      name,
      default_batch_grams: defaultBatchGrams,
      default_kg_per_set: defaultKgPerSet,
      line_count: lines.length,
    });

    await client.query("COMMIT");
    return { id: recipeId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateRecipe(
  recipeId: number,
  name: string,
  defaultBatchGrams: number,
  lines: CreateRecipeLineInput[],
  defaultKgPerSet = 1
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE recipes SET name = $1, default_batch_grams = $2, default_kg_per_set = $3 WHERE id = $4`,
      [name, defaultBatchGrams, defaultKgPerSet, recipeId]
    );

    const oldLines = await client.query(
      `SELECT id, ingredient_id, sort_order FROM recipe_lines WHERE recipe_id = $1`,
      [recipeId]
    );
    await logAction(client, "update_recipe_clear_lines", "recipes", recipeId, {
      recipe_name: name,
      old_line_count: oldLines.rowCount,
      old_lines: oldLines.rows,
    });

    await client.query(`DELETE FROM recipe_lines WHERE recipe_id = $1`, [recipeId]);

    for (const line of lines) {
      const lineResult = await client.query<{ id: number }>(
        `INSERT INTO recipe_lines
           (recipe_id, ingredient_id, sort_order, target_total_cfu, default_grams, filler_mode, filler_ratio)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          recipeId,
          line.ingredientId,
          line.sortOrder,
          line.targetTotalCfu,
          line.defaultGrams,
          line.fillerMode,
          line.fillerRatio,
        ]
      );
      await logAction(client, "create_recipe_line", "recipe_lines", lineResult.rows[0].id, {
        recipe_id: recipeId,
        recipe_name: name,
        ingredient_id: line.ingredientId,
        sort_order: line.sortOrder,
      });
    }

    await logAction(client, "update_recipe", "recipes", recipeId, {
      name,
      default_batch_grams: defaultBatchGrams,
      default_kg_per_set: defaultKgPerSet,
      line_count: lines.length,
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
