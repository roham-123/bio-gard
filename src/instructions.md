You are building a lean prototype calculator webapp for Bio Gard recipes.

Tech:

- Next.js (App Router) + TypeScript
- Postgres
- Use the `pg` library (node-postgres) for DB access
- Use plain SQL migrations: `schema.sql` then `seed.sql`
- No auth, no CRM, no FX, no expiry fields, no rounding rules for now.

Goal:

- User selects a recipe.
- User edits batch size (grams or kg; pick one but store grams internally).
- User chooses “CFU per gram” for each bacteria ingredient from existing options, and can add a new option (label + numeric CFU/g) per ingredient.
- App recalculates grams, percent, cost, totals immediately.
- Use target total CFU per bacteria ingredient as constant.

Data rules:

- Each recipe line has:
  - ingredient name/code
  - is_bacteria (true/false)
  - cost_per_kg_gbp
  - target_total_cfu (constant for bacteria, 0 for fillers)
  - filler_mode: fixed / ratio / remainder
  - filler_ratio used only for ratio fillers

Calculation rules (no rounding):
Let total_batch_grams be the editable batch size.

For each line:
If ingredient.is_bacteria = true:

- cfu_per_g = selected option cfu_per_gram (default to the default option)
- grams = target_total_cfu / cfu_per_g (if cfu_per_g is 0, grams = 0 and show warning)
- percent = grams / total_batch_grams
- total_cfu = grams \* cfu_per_g (should equal target_total_cfu within float error)
- final_cfu_per_g = total_cfu / total_batch_grams
- cost_in_product = cost_per_kg_gbp \* grams / 1000

If ingredient.is_bacteria = false (filler):

- cfu_per_g is irrelevant (treat as 0)
- If filler*mode = 'fixed':
  grams = default_grams * (total*batch_grams / recipe.default_batch_grams)
  percent = grams / total_batch_grams
  cost_in_product = cost_per_kg_gbp * grams / 1000
- If filler_mode = 'ratio':
  grams will be assigned later from remaining grams based on ratios.
- If filler_mode = 'remainder':
  grams will be assigned later as “whatever remains”.

Filler allocation:

1. Compute all bacteria grams.
2. Compute all fixed filler grams (scaled).
3. remaining = total_batch_grams - sum(bacteria grams) - sum(fixed filler grams)
4. If remaining < 0, show error banner “Batch too small for targets”.
5. Allocate ratio fillers: grams = remaining \* (filler_ratio / sum_of_ratio_filler_ratios)
6. Allocate remainder filler: grams = remaining - sum(ratio filler grams)
   (Assume at most one remainder filler per recipe; if multiple exist, put all remaining into the last one by sort_order.)

Totals to display:

- Sum of grams (should equal total_batch_grams)
- Sum of total CFU (sum target_total_cfu for bacteria, plus any filler CFU if present)
- Total cost (sum cost_in_product)
- Cost per kg = total_cost / (total_batch_grams/1000)

UI pages:

1. /recipes
   - list recipes from DB, click to open /recipes/[id]
2. /recipes/[id]
   - batch size input (grams or kg with conversion)
   - table with rows:
     ingredient, grams, %, selected cfu/g (dropdown for bacteria), target_total_cfu (read-only), total_cfu, final_cfu/g, cost/kg, cost_in_product
   - add CFU option UI:
     for a bacteria ingredient, allow adding a new option (label + numeric cfu/g) and set it as selected
   - show totals at bottom.

Implementation detail:

- Build a small DAL in /lib/db.ts using pg Pool.
- Provide server functions:
  - getRecipes()
  - getRecipe(recipeId) that returns recipe + lines + ingredient info + cfu options
  - addCfuOption(ingredientId, label, cfuPerGram) and mark it default=false; return the new option
- Calculations can run client-side in TS using the fetched data.

Make sure scientific notation like 1.00e11 is supported in inputs and displayed nicely (e.g. 1.00E+11). Store numeric in DB, but format in UI.

Deliverables:

- Next.js app code
- SQL scripts under /db/schema.sql and /db/seed.sql
- README with setup steps: create db, run schema, run seed, set DATABASE_URL, run dev.
