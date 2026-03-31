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
• App recalculates grams, g per unit, %, CFU outputs, costs, and totals immediately.
• User can generate a PDF of the current recipe view (including kg, g per unit, CFU columns, and costs).
• Recipe should scale correctly when batch size changes.

⸻

Data model rules

Simplified: 1 ingredient = 1 stock definition

Each ingredient has:
• id (TEXT primary key, user-defined code e.g. PRO0235-1E11 or MM3-4E9)
• name
• stock_cfu_per_g: the CFU/g strength (0 for fillers, >0 for bacteria)
• cost_per_kg_gbp: global cost per kg

Different versions of the same bacteria with different stock CFU/g have separate IDs and names.
Example: PRO-1050 "Trichoderma Harzianum 3E10 (30B)" vs PRO-1056 "Trichoderma Reesei 2E10 (20B)".

Fillers also have their own unique ID and cost/kg.

Bacteria detection: an ingredient is treated as bacteria if stock_cfu_per_g > 0.

Each recipe has:
• default_batch_grams — the batch size the recipe targets were originally defined for.

Each recipe line stores the permanent formula definition:
• ingredient_id — which ingredient is used (TEXT, references ingredients.id)
• target_total_cfu — the target CFU for that ingredient at default batch size (0 for fillers)
• default_grams — computed from target_total_cfu / stock_cfu_per_g for bacteria; set directly for fixed fillers
• filler_mode: fixed / ratio / remainder
• filler_ratio (only used for ratio)

Cost is always taken from the ingredient's cost_per_kg_gbp (no per-line overrides).

⸻

Calculation rules (no rounding)

Let:
• baseBatchGrams = recipe.default_batch_grams
• newBatchGrams = total_batch_grams (user input)
• scaleFactor = newBatchGrams / baseBatchGrams

Step 1: compute CFU-ingredient lines (bacteria / biological lines)

For each line where the ingredient has stock_cfu_per_g > 0:
• scaled_target_total_cfu = line.target_total_cfu * scaleFactor

If stock_cfu_per_g <= 0:
• set grams = 0
• set total_cfu = 0
• show a warning: "Stock CFU/g is zero — cannot calculate grams."
• mark the overall formula as invalid

Else:
• grams = scaled_target_total_cfu / stock_cfu_per_g
• total_cfu = scaled_target_total_cfu
• percent = grams / newBatchGrams
• final_cfu_per_g = total_cfu / newBatchGrams
• cost_in_product = cost_per_kg_gbp * grams / 1000

UI should display scaled_target_total_cfu in the "Target CFU" column (not the base value).
DB values remain unchanged.

⸻

Step 2: compute fixed fillers (non-CFU)

For lines with filler_mode = 'fixed' and stock_cfu_per_g = 0:
• grams = line.default_grams * scaleFactor
• percent = grams / newBatchGrams
• cost_in_product = cost_per_kg_gbp * grams / 1000
• CFU columns remain 0/blank.

⸻

Step 3: allocate remaining grams to ratio + remainder fillers

1. remaining = newBatchGrams - sum(CFU ingredient grams) - sum(fixed filler grams)

2. If remaining < 0 (batch overflow):
    • mark the formula as invalid
    • still show calculated bacteria grams, target CFU and cost impact
    • show a clear error such as:
      "Bacteria + fixed fillers require 12,430 g but batch size is only 10,000 g. Formula exceeds batch by 2,430 g. Increase batch size or choose a different ingredient."
    • set ratio and remainder fillers to 0 g
    • highlight the bacteria rows causing the overflow
    • dim ratio/remainder filler rows
    • PDF generation is disabled

3. If remaining ≥ 0 (normal case):

    Ratio fillers:
    • let ratioSum = sum(filler_ratio) across all filler_mode='ratio' lines
    • for each ratio filler:
      • grams = remaining * (filler_ratio / ratioSum)
      • percent = grams / newBatchGrams
      • cost_in_product = cost_per_kg_gbp * grams / 1000

    Remainder filler:
    • grams = remaining - sum(ratio filler grams)
    • percent/cost same as above.

⸻

Totals to display
• sum grams (should equal newBatchGrams when remaining ≥ 0)
• total CFU (sum of total_cfu for CFU ingredients)
• total final CFU/g (sum of final_cfu_per_g across bacteria lines)
• total cost (sum of cost_in_product)
• cost per kg = total_cost / (newBatchGrams / 1000)
• cost per unit = total_cost / units (if units > 0)

⸻

UI pages

/ (home / calculator)
• Dropdown to select a recipe; loads the calculator inline.
• Search bar: type a keyword and press Enter to display all formulas matching. Click a result to load that formula. "Clear search" button resets to the dropdown view.
• "+ Create New Formula" button links to /recipes/new.

/recipes
• List all recipes.
• Click to open /recipes/[id].

/recipes/new — Create New Formula
• RecipeBuilder component in create mode.
• Inputs: formula name, default batch size (kg).
• Dynamic table of ingredient rows. Each row has:
  • Ingredient dropdown (with "+ Create new ingredient" at top; bacteria ingredients prefixed with 🧬).
  • Type badge: auto-detected from stock_cfu_per_g (Bacteria or Filler).
  • Stock CFU/g: read-only display from ingredient.
  • Cost/kg: read-only display from ingredient.
  • Filler mode dropdown: fixed / ratio / remainder. Bacteria always "fixed".
  • Target CFU input (scientific notation, e.g. 1e13) — only for bacteria rows.
  • Default g input — only for non-bacteria rows with filler_mode = "fixed".
• "+ Add Row" button appends a new empty row; "Remove" button on each row.
• "Save Formula" button creates the recipe and redirects.
• Inline "Create new ingredient" form: ID, name, stock CFU/g, cost/kg.
• When saving: bacteria default_grams is auto-computed from target_total_cfu / stock_cfu_per_g.

/recipes/[id] — Formula Detail / Calculator
• batch size input (kg; UI shows equivalent g)
• kg per unit input; UI shows derived number of units
• ingredient table columns:
  • ID (ingredient code)
  • Ingredient name
  • grams, kg, g per unit, %
  • Stock CFU/g (read-only from ingredient)
  • Target CFU (show scaled target)
  • Final CFU/g
  • Cost/kg (read-only from ingredient)
  • Cost in product
• "Edit Formula" button: navigates to /recipes/[id]/edit.
• summary box with totals
• PDF generation

/recipes/[id]/edit — Edit Formula
• Same RecipeBuilder component in edit mode.
• Pre-populated with existing recipe data.
• "Update Formula" button updates and redirects back.

⸻

Implementation notes
• Keep all calc logic in one module (src/lib/calc.ts)
• DB access in src/lib/db.ts using pg.Pool
• Server actions in src/app/actions.ts ("use server") thin-wrap DAL functions.
• RecipeBuilder component (src/app/recipes/new/RecipeBuilder.tsx) is shared between create and edit modes.
• Server / DAL functions:
  • getRecipes()
  • getRecipe(recipeId) (recipe + lines + ingredients)
  • getIngredients() — all ingredients sorted by name
  • createIngredient(id, name, stockCfuPerG, costPerKgGbp)
  • createRecipe(name, defaultBatchGrams, lines)
  • updateRecipe(recipeId, name, defaultBatchGrams, lines)
• CreateRecipeLineInput type: ingredientId, sortOrder, targetTotalCfu, defaultGrams, fillerMode, fillerRatio
• PDF generation in src/lib/pdf.ts using jsPDF + jsPDF-autotable

Audit logging
• All mutating actions are recorded in an audit_log table in Postgres.
• Schema: id, action, entity_type, entity_id (TEXT), detail JSONB, created_at.
• Logged actions:
  • create_ingredient
  • create_recipe
  • create_recipe_line
  • update_recipe
  • update_recipe_clear_lines

⸻

Number formatting
• accept and parse scientific notation inputs like 1e11 / 1.00E+11
• display CFU numbers in readable scientific notation (e.g. 1.00E+11)
• store as numeric in Postgres
