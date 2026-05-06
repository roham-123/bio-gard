Bio Gard Recipe Calculator - Current System Notes

Tech
- Next.js (App Router) + TypeScript
- PostgreSQL
- pg (node-postgres)
- SQL bootstrap: `db/schema.sql` then `db/seed.sql`

---

Core Model (Simplified)

One ingredient equals one stock definition.

`ingredients`
- `id` (TEXT PK, user-defined code)
- `name` (TEXT)
- `stock_cfu_per_g` (NUMERIC, `0` for fillers, `>0` for bacteria)
- `cost_per_kg_gbp` (NUMERIC, global ingredient cost)

`recipes`
- `id` (SERIAL PK)
- `name` (TEXT UNIQUE)
- `default_batch_grams` (NUMERIC)
- `default_kg_per_set` (NUMERIC, default value loaded into calculator input on open)

`recipe_lines`
- `id` (SERIAL PK)
- `recipe_id` -> `recipes.id`
- `ingredient_id` -> `ingredients.id`
- `sort_order`
- `target_total_cfu`
- `default_grams`
- `filler_mode` (`fixed` / `ratio` / `remainder`)
- `filler_ratio`

Removed permanently
- No `ingredient_cfu_options`
- No stock-option CRUD
- No per-recipe stock selection
- No edit-stock mode/button
- No per-line cost override (cost comes from ingredient)

---

Calculation Rules

Definitions
- `baseBatchGrams = recipe.default_batch_grams`
- `newBatchGrams = user batch input (kg * 1000)`
- `scaleFactor = newBatchGrams / baseBatchGrams`

1) Bacteria lines (`stock_cfu_per_g > 0`)
- `scaled_target_total_cfu = target_total_cfu * scaleFactor`
- if `stock_cfu_per_g <= 0`, line grams = 0 and formula is invalid
- otherwise:
  - `grams = scaled_target_total_cfu / stock_cfu_per_g`
  - `total_cfu = scaled_target_total_cfu`
  - `final_cfu_per_g = total_cfu / newBatchGrams`
  - `percent = grams / newBatchGrams`
  - `cost_in_product = cost_per_kg_gbp * grams / 1000`

2) Fixed fillers (`filler_mode='fixed'` and non-bacteria)
- `grams = default_grams * scaleFactor`
- `percent = grams / newBatchGrams`
- `cost_in_product = cost_per_kg_gbp * grams / 1000`

3) Ratio + remainder fillers
- `remaining = newBatchGrams - sum(bacteria grams) - sum(fixed filler grams)`
- if `remaining < 0`:
  - formula invalid
  - ratio/remainder fillers shown as 0g
- else:
  - for each ratio filler:
    - `grams = remaining * (filler_ratio / ratioSum)`
  - remainder filler gets:
    - `remaining - sum(ratio grams)`

Displayed `%` column uses calculated runtime percent (`grams / newBatchGrams`), not design/default percent.

---

UI Behavior

Home (`/`)
- Search or select recipe, load calculator inline.
- Currency switcher for display values.

Recipe Calculator (`/recipes/[id]` and inline on `/`)
- Inputs:
  - Batch size (kg), editable
  - kg per set, editable (defaults from `recipe.default_kg_per_set` each time recipe loads)
- Ingredient table shows:
  - ID, ingredient name, g, kg, g/set, %, stock CFU/g, target CFU, final CFU/g, cost/kg, cost
- `Edit Formula` button navigates to builder edit page.
- `Generate PDF` disabled when formula is invalid.

Formula Builder (`/recipes/new`, `/recipes/[id]/edit`)
- Ingredient-first model (no stock options UI).
- Create ingredient inline with:
  - ID, name, stock CFU/g, cost/kg
- Bacteria/filler inferred from `stock_cfu_per_g`.
- On save:
  - bacteria `default_grams` auto-calculated from target CFU and ingredient stock CFU/g
  - fillers use entered `default_grams` for fixed mode

Packaging
- Packaging rows are editable in calculator UI.
- `FTD Cellex TourTurf Thatch` has predefined packaging defaults in UI code.
- Packaging changes are session-only (not persisted to DB).

---

Data Access / Actions

Main DAL functions in `src/lib/db.ts`
- `getRecipes()`
- `getRecipe(recipeId)`
- `getIngredients()`
- `createIngredient(id, name, stockCfuPerG, costPerKgGbp)`
- `createRecipe(name, defaultBatchGrams, lines, defaultKgPerSet?)`
- `updateRecipe(recipeId, name, defaultBatchGrams, lines, defaultKgPerSet?)`

Server actions in `src/app/actions.ts` thin-wrap DAL.

---

Audit Log

All mutations are logged in `audit_log`:
- `create_ingredient`
- `create_recipe`
- `create_recipe_line`
- `update_recipe`
- `update_recipe_clear_lines`

---

Number Handling
- Scientific notation inputs are supported (e.g. `1e13`).
- CFU display uses scientific notation formatting.
- Numeric DB values are stored as NUMERIC.
