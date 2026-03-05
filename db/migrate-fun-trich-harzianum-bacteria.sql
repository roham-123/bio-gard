-- Mark "Filler FUN TRICH HARZIANUM FUN 003" as bacteria and set its target CFU

UPDATE ingredients
SET is_bacteria = TRUE
WHERE name = 'Filler FUN TRICH HARZIANUM FUN 003'
  AND cost_per_kg_gbp = 0;

UPDATE recipe_lines
SET target_total_cfu = 1.35e11
WHERE ingredient_id = (
  SELECT id
  FROM ingredients
  WHERE name = 'Filler FUN TRICH HARZIANUM FUN 003'
    AND cost_per_kg_gbp = 0
)
AND recipe_id = (
  SELECT id
  FROM recipes
  WHERE name = 'FTD Cellex TourTurf Thatch'
);

