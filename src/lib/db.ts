import { Pool, PoolClient } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function logAction(
  client: PoolClient,
  action: string,
  entityType: string,
  entityId: number | null,
  detail: Record<string, unknown>
): Promise<void> {
  await client.query(
    `INSERT INTO audit_log (action, entity_type, entity_id, detail)
     VALUES ($1, $2, $3, $4)`,
    [action, entityType, entityId, JSON.stringify(detail)]
  );
}

export type Recipe = {
  id: number;
  name: string;
  default_batch_grams: number;
};

export type Ingredient = {
  id: number;
  code: string | null;
  name: string;
  is_bacteria: boolean;
  cost_per_kg_gbp: number;
};

export type CfuOption = {
  id: number;
  ingredient_id: number;
  label: string;
  cfu_per_gram: number;
  is_default: boolean;
  price_gbp: number | null;
};

export type RecipeLine = {
  id: number;
  recipe_id: number;
  ingredient_id: number;
  sort_order: number;
  target_total_cfu: number;
  default_grams: number;
  filler_mode: "fixed" | "ratio" | "remainder";
  filler_ratio: number;
  /** Effective cost (line override or ingredient); used for calc and display */
  cost_per_kg_gbp: number;
  /** Optional per-recipe default CFU option for this line */
  default_cfu_option_id: number | null;
};

export type RecipeWithLines = Recipe & {
  lines: (RecipeLine & {
    ingredient: Ingredient;
    cfu_options: CfuOption[];
  })[];
};

export async function getRecipes(): Promise<Recipe[]> {
  const client = await pool.connect();
  try {
    const r = await client.query<{ id: number; name: string; default_batch_grams: string }>(
      "SELECT id, name, default_batch_grams FROM recipes ORDER BY name"
    );
    return r.rows.map((row) => ({
      id: row.id,
      name: row.name,
      default_batch_grams: Number(row.default_batch_grams),
    }));
  } finally {
    client.release();
  }
}

export async function getRecipe(recipeId: number): Promise<RecipeWithLines | null> {
  const client = await pool.connect();
  try {
    const recipeResult = await client.query<Recipe>(
      "SELECT id, name, default_batch_grams FROM recipes WHERE id = $1",
      [recipeId]
    );
    const recipe = recipeResult.rows[0];
    if (!recipe) return null;

    const linesResult = await client.query<
      RecipeLine & {
        line_cost: string | null;
        ing_id: number;
        ing_code: string | null;
        ing_name: string;
        ing_is_bacteria: boolean;
        ing_cost: number;
      }
    >(
      `SELECT rl.id,
              rl.recipe_id,
              rl.ingredient_id,
              rl.sort_order,
              rl.target_total_cfu,
              rl.default_grams,
              rl.filler_mode,
              rl.filler_ratio,
              rl.cost_per_kg_gbp AS line_cost,
              rl.default_cfu_option_id,
              i.id AS ing_id, i.code AS ing_code, i.name AS ing_name, i.is_bacteria AS ing_is_bacteria, i.cost_per_kg_gbp AS ing_cost
       FROM recipe_lines rl
       JOIN ingredients i ON i.id = rl.ingredient_id
       WHERE rl.recipe_id = $1
       ORDER BY rl.sort_order`,
      [recipeId]
    );

    const cfuResult = await client.query<CfuOption & { cfu_per_gram: string; price_gbp: string | null }>(
      `SELECT id, ingredient_id, label, cfu_per_gram, is_default, price_gbp
       FROM ingredient_cfu_options
       WHERE ingredient_id = ANY($1::int[])
       ORDER BY ingredient_id, is_default DESC, id`,
      [linesResult.rows.map((r) => r.ingredient_id)]
    );

    const cfuByIngredient = new Map<number, CfuOption[]>();
    for (const c of cfuResult.rows) {
      const list = cfuByIngredient.get(c.ingredient_id) ?? [];
      list.push({
        id: c.id,
        ingredient_id: c.ingredient_id,
        label: c.label,
        cfu_per_gram: Number(c.cfu_per_gram),
        is_default: c.is_default,
        price_gbp: c.price_gbp != null ? Number(c.price_gbp) : null,
      });
      cfuByIngredient.set(c.ingredient_id, list);
    }

    const lines: RecipeWithLines["lines"] = linesResult.rows.map((r) => {
      const lineCost = r.line_cost != null ? Number(r.line_cost) : null;
      const ingCost = Number(r.ing_cost);
      return {
        id: r.id,
        recipe_id: r.recipe_id,
        ingredient_id: r.ingredient_id,
        sort_order: r.sort_order,
        target_total_cfu: Number(r.target_total_cfu),
        default_grams: Number(r.default_grams),
        filler_mode: r.filler_mode,
        filler_ratio: Number(r.filler_ratio),
        cost_per_kg_gbp: lineCost ?? ingCost,
        default_cfu_option_id: r.default_cfu_option_id ?? null,
        ingredient: {
          id: r.ing_id,
          code: r.ing_code,
          name: r.ing_name,
          is_bacteria: r.ing_is_bacteria,
          cost_per_kg_gbp: ingCost,
        },
        cfu_options: cfuByIngredient.get(r.ingredient_id) ?? [],
      };
    });

    return {
      id: recipe.id,
      name: recipe.name,
      default_batch_grams: Number(recipe.default_batch_grams),
      lines,
    };
  } finally {
    client.release();
  }
}

export async function updateRecipeLineDefaultCfuOption(
  recipeLineId: number,
  optionId: number | null
): Promise<boolean> {
  const client = await pool.connect();
  try {
    const before = await client.query(
      `SELECT rl.default_cfu_option_id AS old_option_id,
              old_opt.label AS old_option_label,
              new_opt.label AS new_option_label,
              i.name AS ingredient_name,
              r.name AS recipe_name
       FROM recipe_lines rl
       JOIN ingredients i ON i.id = rl.ingredient_id
       JOIN recipes r ON r.id = rl.recipe_id
       LEFT JOIN ingredient_cfu_options old_opt ON old_opt.id = rl.default_cfu_option_id
       LEFT JOIN ingredient_cfu_options new_opt ON new_opt.id = $1
       WHERE rl.id = $2`,
      [optionId, recipeLineId]
    );
    const r = await client.query(
      "UPDATE recipe_lines SET default_cfu_option_id = $1 WHERE id = $2",
      [optionId, recipeLineId]
    );
    const updated = (r.rowCount ?? 0) > 0;
    if (updated) {
      const prev = before.rows[0];
      await logAction(client, "update_default_cfu_option", "recipe_lines", recipeLineId, {
        recipe_name: prev?.recipe_name,
        ingredient_name: prev?.ingredient_name,
        old_option_id: prev?.old_option_id ?? null,
        old_option_label: prev?.old_option_label ?? null,
        new_option_id: optionId,
        new_option_label: prev?.new_option_label ?? null,
      });
    }
    return updated;
  } finally {
    client.release();
  }
}

export async function addCfuOption(
  ingredientId: number,
  label: string,
  cfuPerGram: number,
  priceGbp: number | null = null
): Promise<CfuOption | null> {
  const client = await pool.connect();
  try {
    const r = await client.query<CfuOption & { cfu_per_gram: string; price_gbp: string | null }>(
      `INSERT INTO ingredient_cfu_options (ingredient_id, label, cfu_per_gram, is_default, price_gbp)
       VALUES ($1, $2, $3, FALSE, $4)
       RETURNING id, ingredient_id, label, cfu_per_gram, is_default, price_gbp`,
      [ingredientId, label, cfuPerGram, priceGbp]
    );
    const row = r.rows[0];
    if (!row) return null;
    const option = {
      id: row.id,
      ingredient_id: row.ingredient_id,
      label: row.label,
      cfu_per_gram: Number(row.cfu_per_gram),
      is_default: row.is_default,
      price_gbp: row.price_gbp != null ? Number(row.price_gbp) : null,
    };
    await logAction(client, "add_cfu_option", "ingredient_cfu_options", option.id, {
      new_record: option,
    });
    return option;
  } finally {
    client.release();
  }
}

export async function updateRecipeLineCost(
  recipeLineId: number,
  costPerKgGbp: number
): Promise<boolean> {
  const client = await pool.connect();
  try {
    const before = await client.query(
      `SELECT rl.cost_per_kg_gbp AS old_cost, i.name AS ingredient_name, r.name AS recipe_name
       FROM recipe_lines rl
       JOIN ingredients i ON i.id = rl.ingredient_id
       JOIN recipes r ON r.id = rl.recipe_id
       WHERE rl.id = $1`,
      [recipeLineId]
    );
    const r = await client.query(
      "UPDATE recipe_lines SET cost_per_kg_gbp = $1 WHERE id = $2",
      [costPerKgGbp, recipeLineId]
    );
    const updated = (r.rowCount ?? 0) > 0;
    if (updated) {
      const prev = before.rows[0];
      await logAction(client, "update_recipe_line_cost", "recipe_lines", recipeLineId, {
        recipe_name: prev?.recipe_name,
        ingredient_name: prev?.ingredient_name,
        old_cost_per_kg_gbp: prev?.old_cost != null ? Number(prev.old_cost) : null,
        new_cost_per_kg_gbp: costPerKgGbp,
      });
    }
    return updated;
  } finally {
    client.release();
  }
}

export async function deleteCfuOption(optionId: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    const before = await client.query(
      `SELECT o.*, i.name AS ingredient_name
       FROM ingredient_cfu_options o
       JOIN ingredients i ON i.id = o.ingredient_id
       WHERE o.id = $1`,
      [optionId]
    );
    const r = await client.query(
      "DELETE FROM ingredient_cfu_options WHERE id = $1",
      [optionId]
    );
    const deleted = (r.rowCount ?? 0) > 0;
    if (deleted && before.rows[0]) {
      await logAction(client, "delete_cfu_option", "ingredient_cfu_options", optionId, {
        deleted_record: before.rows[0],
      });
    }
    return deleted;
  } finally {
    client.release();
  }
}

export async function getIngredients(): Promise<Ingredient[]> {
  const client = await pool.connect();
  try {
    const r = await client.query<{
      id: number;
      code: string | null;
      name: string;
      is_bacteria: boolean;
      cost_per_kg_gbp: string;
    }>("SELECT id, code, name, is_bacteria, cost_per_kg_gbp FROM ingredients ORDER BY name");
    return r.rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      is_bacteria: row.is_bacteria,
      cost_per_kg_gbp: Number(row.cost_per_kg_gbp),
    }));
  } finally {
    client.release();
  }
}

export async function getIngredientCfuOptions(ingredientId: number): Promise<CfuOption[]> {
  const client = await pool.connect();
  try {
    const r = await client.query<CfuOption & { cfu_per_gram: string; price_gbp: string | null }>(
      `SELECT id, ingredient_id, label, cfu_per_gram, is_default, price_gbp
       FROM ingredient_cfu_options
       WHERE ingredient_id = $1
       ORDER BY is_default DESC, id`,
      [ingredientId]
    );
    return r.rows.map((c) => ({
      id: c.id,
      ingredient_id: c.ingredient_id,
      label: c.label,
      cfu_per_gram: Number(c.cfu_per_gram),
      is_default: c.is_default,
      price_gbp: c.price_gbp != null ? Number(c.price_gbp) : null,
    }));
  } finally {
    client.release();
  }
}

export async function createIngredient(
  name: string,
  isBacteria: boolean,
  code: string | null = null,
  costPerKgGbp: number = 0
): Promise<Ingredient> {
  const client = await pool.connect();
  try {
    const r = await client.query<{ id: number; code: string | null; name: string; is_bacteria: boolean; cost_per_kg_gbp: string }>(
      `INSERT INTO ingredients (code, name, is_bacteria, cost_per_kg_gbp)
       VALUES ($1, $2, $3, $4)
       RETURNING id, code, name, is_bacteria, cost_per_kg_gbp`,
      [code || null, name, isBacteria, costPerKgGbp]
    );
    const row = r.rows[0];
    const ingredient = {
      id: row.id,
      code: row.code,
      name: row.name,
      is_bacteria: row.is_bacteria,
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
  ingredientId: number;
  sortOrder: number;
  targetTotalCfu: number;
  defaultGrams: number;
  fillerMode: "fixed" | "ratio" | "remainder";
  fillerRatio: number;
  costPerKgGbp: number | null;
  defaultCfuOptionId: number | null;
};

export async function createRecipe(
  name: string,
  defaultBatchGrams: number,
  lines: CreateRecipeLineInput[]
): Promise<{ id: number }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const recipeResult = await client.query<{ id: number }>(
      `INSERT INTO recipes (name, default_batch_grams) VALUES ($1, $2) RETURNING id`,
      [name, defaultBatchGrams]
    );
    const recipeId = recipeResult.rows[0].id;

    for (const line of lines) {
      const lineResult = await client.query<{ id: number }>(
        `INSERT INTO recipe_lines
           (recipe_id, ingredient_id, sort_order, target_total_cfu, default_grams, filler_mode, filler_ratio, cost_per_kg_gbp, default_cfu_option_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          recipeId,
          line.ingredientId,
          line.sortOrder,
          line.targetTotalCfu,
          line.defaultGrams,
          line.fillerMode,
          line.fillerRatio,
          line.costPerKgGbp,
          line.defaultCfuOptionId,
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
