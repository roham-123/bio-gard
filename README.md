# Bio Gard Recipe Calculator

Lean prototype calculator for Bio Gard recipes: select a recipe, edit batch size, choose CFU per gram for each bacteria ingredient (or add new options), and see recalculated grams, percent, cost, and totals.

## Tech

- **Next.js** (App Router) + **TypeScript**
- **Postgres** with **pg** (node-postgres)
- Plain SQL migrations: `db/schema.sql` then `db/seed.sql`
- No auth, no CRM, no FX, no expiry, no rounding rules

## Setup

1. **Create a Postgres database**

   ```bash
   createdb bac_calc
   # or via psql: CREATE DATABASE bac_calc;
   ```

2. **Run the schema**

   ```bash
   psql -d bac_calc -f db/schema.sql
   ```

3. **Run the seed**

   ```bash
   psql -d bac_calc -f db/seed.sql
   ```

4. **Set `DATABASE_URL`**

   ```bash
   export DATABASE_URL="postgresql://user:password@localhost:5432/bac_calc"
   ```

   (Replace `user`, `password`, and host/port as needed.)

5. **Install dependencies and run the dev server**

   ```bash
   npm install
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Go to **Recipes**, then open a recipe to use the calculator.

## Pages

- **`/`** — Home with link to recipes.
- **`/recipes`** — List of recipes; click one to open the calculator.
- **`/recipes/[id]`** — Recipe calculator:
  - Batch size input (grams; stored as grams; display shows kg when ≥ 1000).
  - Table: ingredient, grams, %, selected CFU/g (dropdown for bacteria), target total CFU, total CFU, final CFU/g, cost/kg, cost in product.
  - For bacteria lines: “+ Add option” to add a new CFU option (label + numeric CFU/g) and set it as selected.
  - Totals: sum of grams, total CFU, total cost, cost per kg.

## Data and calculations

- **Recipes** have a default batch size (grams).
- **Recipe lines** have: ingredient, `is_bacteria`, `cost_per_kg_gbp`, `target_total_cfu` (constant for bacteria, 0 for fillers), `filler_mode` (fixed / ratio / remainder), `filler_ratio` (for ratio fillers).
- **Bacteria:** `grams = target_total_cfu / cfu_per_g`; percent, cost, total CFU, and final CFU/g follow from that.
- **Fixed fillers:** grams scale with batch; ratio fillers share the remainder by `filler_ratio`; remainder filler takes the rest.
- Scientific notation (e.g. `1.00e11`) is supported in inputs and displayed in UI (e.g. `1.00E+11`).

## Project layout

- `src/app/` — App Router pages and server action.
- `src/lib/db.ts` — DAL (Pool, `getRecipes`, `getRecipe`, `addCfuOption`).
- `src/lib/calc.ts` — Client-side calculation logic.
- `src/lib/format.ts` — Number/CFU/currency formatting and scientific input parsing.
- `db/schema.sql` — Table definitions.
- `db/seed.sql` — Seed data (recipes, ingredients, recipe lines, CFU options).
