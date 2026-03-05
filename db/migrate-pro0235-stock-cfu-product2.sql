-- Fix stock CFU/g for PRO0235 in "RBC 200 MM3 plus PRO235 Blue Dye"
-- It should use the same stock strength (1.00E+11 CFU/g) as in Product 1.

UPDATE ingredient_cfu_options ico
SET cfu_per_gram = 1.00e11
FROM ingredients i
WHERE ico.ingredient_id = i.id
  AND i.name = 'PRO0235'
  AND i.cost_per_kg_gbp = 63.38
  AND ico.label = 'Default';

