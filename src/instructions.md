Bio Gard Recipe Calculator Prototype Manual

Tech
• Next.js (App Router) + TypeScript
• Postgres
• pg (node-postgres) for DB access
• Plain SQL migrations: db/schema.sql then db/seed.sql

⸻

Goal
• User selects a recipe.
• User edits batch size in kg (internally stored as grams; UI also shows the g equivalent).
• User sets kg per unit; the app derives number of units and g per unit for each ingredient.
• User selects stock option (CFU/g + optional price) for ingredients that have CFU, and can add new stock options per ingredient.
• User can edit cost/kg per line (per recipe); selecting a stock option with a price overwrites that line's cost/kg.
• App recalculates grams, g per unit, %, CFU outputs, costs, and totals immediately.
• User can generate a PDF of the current recipe view (including kg, g per unit, CFU columns, and costs).
• Recipe should scale correctly when batch size changes.

⸻

Data model rules

Ingredient is the master material

There is exactly one row per real material in the ingredients table (UNIQUE on name).
Do NOT create duplicate rows for the same ingredient with different costs or strengths.
Different costs and CFU strengths are handled by stock options and per-recipe line overrides.

Each ingredient has:
• code (optional, e.g. PRO0235)
• name (unique across the whole system)
• is_bacteria: boolean (must be consistent with the "has CFU" rule below)
• cost_per_kg_gbp: fallback default cost (used only when recipe_lines.cost_per_kg_gbp is NULL)

Each recipe has:
• default_batch_grams — the batch size the recipe targets were originally defined for.

Each recipe line stores the permanent formula definition:
• ingredient_id — which ingredient is used
• target_total_cfu — the target CFU for that ingredient at default batch size
• default_grams — the Excel grams at default batch size
• filler_mode: fixed / ratio / remainder
• filler_ratio (only used for ratio)
• cost_per_kg_gbp — per-recipe cost override (editable in the UI); always set in seed data

Stock options (ingredient_cfu_options)

Each stock option represents a selectable lot/version of an ingredient:
• label — descriptive name (e.g. "Default", "4E9", "Option B")
• cfu_per_gram — the strength of this lot
• price_gbp — optional price; when the user selects this option, it overwrites the recipe line's cost_per_kg_gbp
• is_default — whether this is the initially-selected option

Stock options belong to the ingredient, NOT to a specific recipe.
All recipes that use an ingredient see all of its stock options.

Cost precedence (at calculation time): 1. Selected stock option price_gbp (if present) 2. recipe_lines.cost_per_kg_gbp (if present) 3. ingredients.cost_per_kg_gbp (fallback)

Recipes must NOT permanently store a lot/stock option as part of the formula.
The selected stock option is chosen at calculation time.
(Later, saved production batches can store the selected option.)

Important classification rule

Do not rely solely on ingredient name (e.g. containing "Filler").

A line is treated as a "CFU ingredient" (bacteria / biological line) if:
• it has a CFU value:
• target_total_cfu > 0, or
• at least one stock option with cfu_per_gram > 0
• if it has any CFU, it must not be treated as a filler.

Otherwise it's treated as a non-CFU filler.

This handles cases like "Filler FUN TRICH HARZIANUM FUN 003" which has CFU and must be treated as bacteria even though its name contains "Filler".

Seed / recipe creation rules

When adding new recipes:
• reuse existing ingredient rows where possible
• do NOT create duplicate ingredient rows just because CFU or price differ
• instead add stock options under the ingredient
• set cost_per_kg_gbp on the recipe_line for that recipe's cost context
• recipe_lines JOIN ingredients by name only (not by cost)

⸻

Calculation rules (no rounding)

Let:
• baseBatchGrams = recipe.default_batch_grams
• newBatchGrams = total_batch_grams (user input)
• scaleFactor = newBatchGrams / baseBatchGrams

Step 1: compute CFU-ingredient lines (bacteria / biological lines)

For each line that is treated as "CFU ingredient":
• cfu_per_g = selected stock option cfu_per_gram (default selected initially)
• scaled_target_total_cfu = line.target_total_cfu \* scaleFactor

If cfu_per_g <= 0 (or null):
• set grams = 0
• set total_cfu = 0
• show a warning for that row: “Stock CFU/g is zero — cannot calculate grams. Select a valid stock option.”
• mark the overall formula as invalid (see “Batch overflow / invalid formula” below)

Else:
• grams = scaled_target_total_cfu / cfu_per_g
• total_cfu = grams _ cfu_per_g (≈ scaled_target_total_cfu)
• percent = grams / newBatchGrams
• final_cfu_per_g = total_cfu / newBatchGrams
• cost_in_product = cost_per_kg_gbp _ grams / 1000

UI should display scaled_target_total_cfu in the "Target CFU" column (not the base value).

DB values remain unchanged.

⸻

Step 2: compute fixed fillers (non-CFU)

For lines with filler_mode = 'fixed' and not treated as "CFU ingredient":
• scale grams with batch:
• grams = line.default_grams _ scaleFactor
• percent = grams / newBatchGrams
• cost_in_product = cost_per_kg_gbp _ grams / 1000
• CFU columns remain 0/blank.

⸻

Step 3: allocate remaining grams to ratio + remainder fillers

1. remaining = newBatchGrams - sum(CFU ingredient grams) - sum(fixed filler grams)

2. If remaining < 0 (batch overflow because selected stock CFU/g is too weak for the targets):

    • mark the formula as invalid
    • still show calculated bacteria grams, target CFU and cost impact
    • show a clear error such as:
      “Bacteria + fixed fillers require 12,430 g but batch size is only 10,000 g. Formula exceeds batch by 2,430 g. Increase batch size or choose stronger stock.”
    • set ratio and remainder fillers to 0 g (do not pretend there is remaining mass)
    • highlight the bacteria rows causing the overflow
    • dim ratio/remainder filler rows and show a filler warning (“Filler cannot be allocated — batch overflow”)
    • in this state, cost per kg / cost per unit are suppressed (no derived totals on an invalid formula)
    • PDF generation is disabled in the UI (user must either increase batch size or choose stronger stock)

3. If remaining ≥ 0 (normal case):

    Ratio fillers:

    • let ratioSum = sum(filler_ratio) across all filler_mode='ratio' lines
    • for each ratio filler:
      • grams = remaining * (filler_ratio / ratioSum)
      • percent = grams / newBatchGrams
      • cost_in_product = cost_per_kg_gbp * grams / 1000

    Remainder filler:

    • grams = remaining - sum(ratio filler grams)
    • (assume max 1 remainder filler; if multiple exist, put remainder into the last by sort_order)
    • percent/cost same as above.

⸻

Totals to display
• sum grams (should equal newBatchGrams when remaining ≥ 0)
• total CFU (sum of total_cfu for CFU ingredients) – used internally and in the PDF summary
• total final CFU/g (sum of final_cfu_per_g across bacteria lines) – shown in the on-screen Summary box
• total cost (sum of cost_in_product)
• cost per kg = total_cost / (newBatchGrams / 1000)
• cost per unit = total_cost / units (if units > 0)

⸻

UI pages

/recipes
• list recipes
• click to open /recipes/[id]

/recipes/[id]
• batch size input (kg; UI shows equivalent g)
• kg per unit input; UI shows derived number of units (≈ N units)
• ingredient table columns:
• ingredient
• grams, kg, g per unit, %
• Stock CFU/g selector (only for lines treated as CFU ingredient; read-only label when not editing)
• Target CFU (show scaled target)
• Final CFU/g
• Cost/kg (editable per line when in "Edit" mode)
• Cost in product
• add stock option UI:
• label + numeric CFU/g
• optional price (£)
• add option and set selected
• edit mode:
• toggle to edit line cost/kg and stock options
• saving persists updated costs and any newly added stock options
• summary box:
• Total grams (kg and g)
• Total final CFU/g (sum of final CFU/g column)
• Total cost
• Cost per kg
• Cost per unit
• PDF generation:
• includes batch size, units, and ingredients table
• table shows Ingredient, g, kg, g per unit, %, Stock CFU/g, Target CFU, Final CFU/g, Cost/kg, Cost in product

⸻

Implementation notes
• Keep all calc logic in one module (e.g. src/lib/calc.ts)
• DB access in src/lib/db.ts using pg.Pool
• Server functions:
  • getRecipes()
  • getRecipe(recipeId) (recipe + lines + ingredients + stock options)
  • addCfuOption(ingredientId, label, cfuPerGram, priceGbp?) (default=false)
  • deleteCfuOption(optionId)
  • updateRecipeLineCost(recipeLineId, costPerKgGbp)
  • updateRecipeLineDefaultCfuOption(recipeLineId, optionId | null)
• PDF generation in src/lib/pdf.ts using jsPDF + jsPDF-autotable (mirrors main table columns and summary)

Audit logging

• All mutating actions are recorded in an audit_log table in Postgres.
• Schema (simplified): id, action, entity_type, entity_id, detail JSONB, created_at.
• The db.ts helper logAction(client, action, entityType, entityId, detail) appends a row for each mutation.
• Logged actions:
  • add_cfu_option: detail.new_record contains the inserted ingredient_cfu_options row.
  • delete_cfu_option: detail.deleted_record contains the full option row (including ingredient name) before delete.
  • update_recipe_line_cost: detail includes recipe_name, ingredient_name, old_cost_per_kg_gbp, new_cost_per_kg_gbp.
  • update_default_cfu_option: detail includes recipe_name, ingredient_name, old_option_id/label and new_option_id/label.
• This makes it possible to recover what was deleted/changed later, even if the UI doesn’t show it anymore.

⸻

Number formatting
• accept and parse scientific notation inputs like 1e11 / 1.00E+11
• display CFU numbers in readable scientific notation (e.g. 1.00E+11)
• store as numeric in Postgres
