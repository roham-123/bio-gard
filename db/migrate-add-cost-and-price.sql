-- Run this if you get "column rl.cost_per_kg_gbp does not exist"
-- (adds editable cost per recipe line and price per CFU option)

ALTER TABLE recipe_lines ADD COLUMN IF NOT EXISTS cost_per_kg_gbp NUMERIC NULL;
ALTER TABLE ingredient_cfu_options ADD COLUMN IF NOT EXISTS price_gbp NUMERIC NULL;
