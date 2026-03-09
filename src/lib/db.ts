import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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
    const r = await client.query(
      "UPDATE recipe_lines SET default_cfu_option_id = $1 WHERE id = $2",
      [optionId, recipeLineId]
    );
    return (r.rowCount ?? 0) > 0;
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
    return {
      id: row.id,
      ingredient_id: row.ingredient_id,
      label: row.label,
      cfu_per_gram: Number(row.cfu_per_gram),
      is_default: row.is_default,
      price_gbp: row.price_gbp != null ? Number(row.price_gbp) : null,
    };
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
    const r = await client.query(
      "UPDATE recipe_lines SET cost_per_kg_gbp = $1 WHERE id = $2",
      [costPerKgGbp, recipeLineId]
    );
    return (r.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}

export async function deleteCfuOption(optionId: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    const r = await client.query(
      "DELETE FROM ingredient_cfu_options WHERE id = $1",
      [optionId]
    );
    return (r.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}
