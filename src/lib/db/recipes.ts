import type { PoolClient } from "pg";
import { withClient, withTransaction } from "./client";
import { logAction } from "./audit";
import { fetchLabels, labelMappers, type RecipeLabel } from "./labels";
import type { Ingredient } from "./ingredients";
import { calculate, type LineInput } from "../calc";

export type Recipe = {
  id: number;
  name: string;
  default_batch_grams: number;
  default_kg_per_set: number;
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
  lines: (RecipeLine & { ingredient: Ingredient })[];
  packaging_lines: RecipePackagingLine[];
  labels: RecipeLabel[];
};

export type CreateRecipeLineInput = {
  ingredientId: string;
  sortOrder: number;
  targetTotalCfu: number;
  defaultGrams: number;
  fillerMode: "fixed" | "ratio" | "remainder";
  fillerRatio: number;
};

export type CreateRecipePackagingLineInput = {
  packagingItemCode: string;
  sortOrder: number;
  usageBasis: "per_set" | "per_kg" | "per_unit";
  costGbp: number;
  quantityMultiplier: number;
  unitsPerPack: number | null;
  quantitySource: "sets" | "kg";
};

export async function getRecipes(): Promise<Recipe[]> {
  return withClient(async (client) => {
    const r = await client.query<{
      id: number;
      name: string;
      default_batch_grams: string;
      default_kg_per_set: string;
    }>(
      "SELECT id, name, default_batch_grams, default_kg_per_set FROM recipes ORDER BY name"
    );
    return r.rows.map((row) => ({
      id: row.id,
      name: row.name,
      default_batch_grams: Number(row.default_batch_grams),
      default_kg_per_set: Number(row.default_kg_per_set),
    }));
  });
}

export async function getRecipe(recipeId: number): Promise<RecipeWithLines | null> {
  return withClient(async (client) => {
    const recipeResult = await client.query<{
      id: number;
      name: string;
      default_batch_grams: string;
      default_kg_per_set: string;
    }>(
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

    const labels = await fetchLabels(client, "recipe", recipeId, labelMappers.recipe);

    return {
      id: recipe.id,
      name: recipe.name,
      default_batch_grams: Number(recipe.default_batch_grams),
      default_kg_per_set: Number(recipe.default_kg_per_set),
      lines,
      packaging_lines,
      labels,
    };
  });
}

export async function createRecipe(
  name: string,
  defaultBatchGrams: number,
  lines: CreateRecipeLineInput[],
  defaultKgPerSet = 1
): Promise<{ id: number }> {
  return withTransaction(async (client) => {
    await assertRecipeGuardrails(client, defaultBatchGrams, lines);
    const recipeResult = await client.query<{ id: number }>(
      `INSERT INTO recipes (name, default_batch_grams, default_kg_per_set)
       VALUES ($1, $2, $3) RETURNING id`,
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

    return { id: recipeId };
  });
}

export async function updateRecipe(
  recipeId: number,
  name: string,
  defaultBatchGrams: number,
  lines: CreateRecipeLineInput[],
  defaultKgPerSet = 1
): Promise<void> {
  await withTransaction(async (client) => {
    await assertRecipeGuardrails(client, defaultBatchGrams, lines);
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
  });
}

export async function saveRecipePackagingLines(
  recipeId: number,
  lines: CreateRecipePackagingLineInput[]
): Promise<void> {
  await withTransaction(async (client) => {
    await client.query("DELETE FROM recipe_packaging_lines WHERE recipe_id = $1", [recipeId]);
    for (const line of lines) {
      await client.query(
        `INSERT INTO recipe_packaging_lines
           (recipe_id, packaging_item_code, sort_order, usage_basis, cost_gbp, quantity_multiplier, units_per_pack, quantity_source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          recipeId,
          line.packagingItemCode,
          line.sortOrder,
          line.usageBasis,
          line.costGbp,
          line.quantityMultiplier,
          line.unitsPerPack,
          line.quantitySource,
        ]
      );
    }
    await logAction(client, "save_recipe_packaging_lines", "recipes", recipeId, {
      line_count: lines.length,
    });
  });
}

async function assertRecipeGuardrails(
  client: PoolClient,
  defaultBatchGrams: number,
  lines: CreateRecipeLineInput[]
): Promise<void> {
  if (lines.length === 0) return;

  const ingredientIds = [...new Set(lines.map((line) => line.ingredientId))];
  const ingredientResult = await client.query<{
    id: string;
    name: string;
    stock_cfu_per_g: string;
    cost_per_kg_gbp: string;
  }>(
    `SELECT id, name, stock_cfu_per_g, cost_per_kg_gbp
     FROM ingredients
     WHERE id = ANY($1::text[])`,
    [ingredientIds]
  );

  const ingredientById = new Map(
    ingredientResult.rows.map((row) => [
      row.id,
      {
        name: row.name,
        stockCfuPerG: Number(row.stock_cfu_per_g),
        costPerKgGbp: Number(row.cost_per_kg_gbp),
      },
    ])
  );

  const calcLines: LineInput[] = lines.map((line, idx) => {
    const ingredient = ingredientById.get(line.ingredientId);
    if (!ingredient) {
      throw new Error(`Ingredient not found: ${line.ingredientId}`);
    }
    return {
      lineId: idx + 1,
      ingredientId: line.ingredientId,
      ingredientName: ingredient.name,
      isBacteria: ingredient.stockCfuPerG > 0,
      stockCfuPerG: ingredient.stockCfuPerG,
      costPerKgGbp: ingredient.costPerKgGbp,
      targetTotalCfu: line.targetTotalCfu,
      defaultGrams: line.defaultGrams,
      fillerMode: line.fillerMode,
      fillerRatio: line.fillerRatio,
      sortOrder: line.sortOrder,
    };
  });

  const validation = calculate(defaultBatchGrams, defaultBatchGrams, calcLines);
  if (!validation.formulaValid) {
    throw new Error(validation.error ?? "Formula is invalid.");
  }
}
