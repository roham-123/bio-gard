Bio Gard Recipe Calculator Prototype Manual

Tech
	•	Next.js (App Router) + TypeScript
	•	Postgres
	•	pg (node-postgres) for DB access
	•	Plain SQL migrations: db/schema.sql then db/seed.sql

⸻

Goal
	•	User selects a recipe.
	•	User edits batch size in kg (internally stored as grams; UI also shows the g equivalent).
	•	User sets the number of units; the app derives g per unit for each ingredient and for the whole batch.
	•	User selects “CFU per gram” for ingredients that have CFU, and can add new CFU options per ingredient (with optional price).
	•	User can edit cost/kg per line (per recipe) and optionally associate a price with each CFU option which can overwrite that line’s cost/kg.
	•	App recalculates grams, g per unit, %, CFU outputs, costs, and totals immediately.
	•	User can generate a PDF of the current recipe view (including kg, g per unit, CFU columns, and costs).
	•	Recipe should scale correctly when batch size changes.

⸻

Data model rules

Each recipe has:
	•	default_batch_grams
	•	This is the batch size the recipe targets were originally defined for (from the Excel sheet).

Each recipe line has:
	•	ingredient name/code
	•	cost_per_kg_gbp (per‑recipe override; editable in the UI)
	•	target_total_cfu (the “Total” CFU value from Excel for that line at default batch size)
	•	default_grams (the Excel grams at default batch size)
	•	filler allocation fields:
		•	filler_mode: fixed / ratio / remainder
		•	filler_ratio only used for ratio

Each ingredient has CFU options:
	•	cfu_per_gram values stored in ingredient_cfu_options
	•	one option is default
	•	users can add new options
	•	each option can have an optional price_gbp (used to update that recipe line’s cost_per_kg_gbp when selected)

Ingredients also have:
	•	is_bacteria: boolean flag for classification (must be consistent with the “has CFU” rule below)
	•	cost_per_kg_gbp: default cost; recipe_lines.cost_per_kg_gbp can override this per recipe

Important classification rule (new)

Do not rely solely on ingredient name (e.g. containing “Filler”).

A line is treated as a “CFU ingredient” (bacteria / biological line) if:
	•	it has a CFU value:
		•	target_total_cfu > 0, or
		•	at least one CFU option with cfu_per_gram > 0
	•	if it has any CFU, it must not be treated as a filler.

Otherwise it’s treated as a non-CFU filler.

This handles cases like “Filler FUN TRICH HARZIANUM FUN 003” which has CFU and must be treated as bacteria even though its name contains “Filler”.

⸻

Calculation rules (no rounding)

Let:
	•	baseBatchGrams = recipe.default_batch_grams
	•	newBatchGrams = total_batch_grams (user input)
	•	scaleFactor = newBatchGrams / baseBatchGrams

Step 1: compute CFU-ingredient lines (bacteria / biological lines)

For each line that is treated as “CFU ingredient”:
	•	cfu_per_g = selected option cfu_per_gram (default selected initially)
	•	scaled_target_total_cfu = line.target_total_cfu * scaleFactor

If cfu_per_g <= 0:
	•	set grams = 0
	•	set total_cfu = 0
	•	show a warning for that row (cannot compute without CFU/g)

Else:
	•	grams = scaled_target_total_cfu / cfu_per_g
	•	total_cfu = grams * cfu_per_g (≈ scaled_target_total_cfu)
	•	percent = grams / newBatchGrams
	•	final_cfu_per_g = total_cfu / newBatchGrams
	•	cost_in_product = cost_per_kg_gbp * grams / 1000

UI should display scaled_target_total_cfu in the “Target CFU” column (not the base value).

DB values remain unchanged.

⸻

Step 2: compute fixed fillers (non-CFU)

For lines with filler_mode = 'fixed' and not treated as “CFU ingredient”:
	•	scale grams with batch:
	•	grams = line.default_grams * scaleFactor
	•	percent = grams / newBatchGrams
	•	cost_in_product = cost_per_kg_gbp * grams / 1000
	•	CFU columns remain 0/blank.

⸻

Step 3: allocate remaining grams to ratio + remainder fillers
	1.	remaining = newBatchGrams - sum(CFU ingredient grams) - sum(fixed filler grams)
	2.	If remaining < 0:

	•	show banner: “Batch too small for targets”
	•	still render numbers, but highlight error.

	3.	Ratio fillers:

	•	let ratioSum = sum(filler_ratio) across all filler_mode='ratio' lines
	•	for each ratio filler:
	•	grams = remaining * (filler_ratio / ratioSum)
	•	percent = grams / newBatchGrams
	•	cost_in_product = cost_per_kg_gbp * grams / 1000

	4.	Remainder filler:

	•	grams = remaining - sum(ratio filler grams)
	•	(assume max 1 remainder filler; if multiple exist, put remainder into the last by sort_order)
	•	percent/cost same as above.

⸻

Totals to display
	•	sum grams (should equal newBatchGrams when remaining ≥ 0)
	•	total CFU (sum of total_cfu for CFU ingredients) – used internally and in the PDF summary
	•	total final CFU/g (sum of final_cfu_per_g across bacteria lines) – shown in the on‑screen Summary box
	•	total cost (sum of cost_in_product)
	•	cost per kg = total_cost / (newBatchGrams / 1000)
	•	cost per unit = total_cost / units (if units > 0)

⸻

UI pages

/recipes
	•	list recipes
	•	click to open /recipes/[id]

/recipes/[id]
	•	batch size input (kg; UI shows equivalent g)
	•	units input (integer ≥ 1); UI shows derived kg and g per unit for the total batch
	•	ingredient table columns:
		•	ingredient
		•	grams, kg, g per unit, %
		•	CFU/g selector (only for lines treated as CFU ingredient; read‑only label when not editing)
		•	Target CFU (show scaled target)
		•	Total CFU
		•	Final CFU/g
		•	Cost/kg (editable per line when in “Edit” mode)
		•	Cost in product
	•	add CFU option UI:
		•	label + numeric CFU/g
		•	optional price (£)
		•	add option and set selected
	•	edit mode:
		•	toggle to edit line cost/kg and CFU options
		•	saving persists updated costs and any newly added CFU options
	•	summary box:
		•	Total grams (kg and g)
		•	Total final CFU/g (sum of final CFU/g column)
		•	Total cost
		•	Cost per kg
		•	Cost per unit
	•	PDF generation:
		•	includes batch size, units, and ingredients table
		•	table shows Ingredient, g, kg, g per unit, %, CFU/g, Target CFU, Total CFU, Final CFU/g, Cost/kg, Cost in product

⸻

Implementation notes
	•	Keep all calc logic in one module (e.g. src/lib/calc.ts)
	•	DB access in src/lib/db.ts using pg.Pool
	•	Server functions:
		•	getRecipes()
		•	getRecipe(recipeId) (recipe + lines + ingredients + cfu options)
		•	addCfuOption(ingredientId, label, cfuPerGram, priceGbp?) (default=false)
		•	deleteCfuOption(optionId)
		•	updateRecipeLineCost(recipeLineId, costPerKgGbp)
	•	PDF generation in src/lib/pdf.ts using jsPDF + jsPDF‑autotable (mirrors main table columns and summary)

⸻

Number formatting
	•	accept and parse scientific notation inputs like 1e11 / 1.00E+11
	•	display CFU numbers in readable scientific notation (e.g. 1.00E+11)
	•	store as numeric in Postgres
