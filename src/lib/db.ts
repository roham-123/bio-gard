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

export type RecipePackagingLine = {
  id: number;
  recipe_id: number;
  packaging_item_code: string;
  packaging_item_name: string;
  sort_order: number;
  usage_basis: "per_set" | "per_kg" | "per_unit";
  cost_gbp: number;
  quantity_multiplier: number;
  units_per_pack: number | null;
  quantity_source: "sets" | "kg";
};

export type RecipeWithLines = Recipe & {
  lines: (RecipeLine & {
    ingredient: Ingredient;
  })[];
  packaging_lines: RecipePackagingLine[];
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

    const packagingResult = await client.query<{
      id: number;
      recipe_id: number;
      packaging_item_code: string;
      sort_order: number;
      usage_basis: "per_set" | "per_kg" | "per_unit";
      cost_gbp: string;
      quantity_multiplier: string;
      units_per_pack: string | null;
      quantity_source: "sets" | "kg";
      item_name: string;
    }>(
      `SELECT rpl.id,
              rpl.recipe_id,
              rpl.packaging_item_code,
              rpl.sort_order,
              rpl.usage_basis,
              rpl.cost_gbp,
              rpl.quantity_multiplier,
              rpl.units_per_pack,
              rpl.quantity_source,
              pi.name AS item_name
       FROM recipe_packaging_lines rpl
       JOIN packaging_items pi ON pi.code = rpl.packaging_item_code
       WHERE rpl.recipe_id = $1
       ORDER BY rpl.sort_order`,
      [recipeId]
    );

    const packaging_lines: RecipePackagingLine[] = packagingResult.rows.map((r) => ({
      id: r.id,
      recipe_id: r.recipe_id,
      packaging_item_code: r.packaging_item_code,
      packaging_item_name: r.item_name,
      sort_order: r.sort_order,
      usage_basis: r.usage_basis,
      cost_gbp: Number(r.cost_gbp),
      quantity_multiplier: Number(r.quantity_multiplier),
      units_per_pack: r.units_per_pack == null ? null : Number(r.units_per_pack),
      quantity_source: r.quantity_source,
    }));

    return {
      id: recipe.id,
      name: recipe.name,
      default_batch_grams: Number(recipe.default_batch_grams),
      default_kg_per_set: Number(recipe.default_kg_per_set),
      lines,
      packaging_lines,
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

export async function updateIngredientCostPerKg(
  ingredientId: string,
  costPerKgGbp: number
): Promise<boolean> {
  const client = await pool.connect();
  try {
    const before = await client.query<{ name: string; cost_per_kg_gbp: string }>(
      `SELECT name, cost_per_kg_gbp
       FROM ingredients
       WHERE id = $1`,
      [ingredientId]
    );
    const r = await client.query(
      `UPDATE ingredients
       SET cost_per_kg_gbp = $1
       WHERE id = $2`,
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

export type PackagingItem = {
  code: string;
  name: string;
  default_cost_gbp: number;
  default_cost_basis: string;
};

export async function getPackagingItems(): Promise<PackagingItem[]> {
  const client = await pool.connect();
  try {
    const r = await client.query<{
      code: string;
      name: string;
      default_cost_gbp: string;
      default_cost_basis: string;
    }>("SELECT code, name, default_cost_gbp, default_cost_basis FROM packaging_items ORDER BY code");
    return r.rows.map((row) => ({
      code: row.code,
      name: row.name,
      default_cost_gbp: Number(row.default_cost_gbp),
      default_cost_basis: row.default_cost_basis,
    }));
  } finally {
    client.release();
  }
}

export async function createPackagingItem(
  code: string,
  name: string,
  defaultCostGbp: number,
  defaultCostBasis: string
): Promise<PackagingItem> {
  const client = await pool.connect();
  try {
    const r = await client.query<{ code: string; name: string; default_cost_gbp: string; default_cost_basis: string }>(
      `INSERT INTO packaging_items (code, name, default_cost_gbp, default_cost_basis)
       VALUES ($1, $2, $3, $4)
       RETURNING code, name, default_cost_gbp, default_cost_basis`,
      [code, name, defaultCostGbp, defaultCostBasis]
    );
    const row = r.rows[0];
    const item: PackagingItem = {
      code: row.code,
      name: row.name,
      default_cost_gbp: Number(row.default_cost_gbp),
      default_cost_basis: row.default_cost_basis,
    };
    await logAction(client, "create_packaging_item", "packaging_items", item.code, { new_record: item });
    return item;
  } finally {
    client.release();
  }
}

export type CreateRecipePackagingLineInput = {
  packagingItemCode: string;
  sortOrder: number;
  usageBasis: "per_set" | "per_kg" | "per_unit";
  costGbp: number;
  quantityMultiplier: number;
  unitsPerPack: number | null;
  quantitySource: "sets" | "kg";
};

export async function saveRecipePackagingLines(
  recipeId: number,
  lines: CreateRecipePackagingLineInput[]
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM recipe_packaging_lines WHERE recipe_id = $1", [recipeId]);
    for (const line of lines) {
      await client.query(
        `INSERT INTO recipe_packaging_lines
           (recipe_id, packaging_item_code, sort_order, usage_basis, cost_gbp, quantity_multiplier, units_per_pack, quantity_source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [recipeId, line.packagingItemCode, line.sortOrder, line.usageBasis, line.costGbp, line.quantityMultiplier, line.unitsPerPack, line.quantitySource]
      );
    }
    await logAction(client, "save_recipe_packaging_lines", "recipes", recipeId, { line_count: lines.length });
    await client.query("COMMIT");
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
