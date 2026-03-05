-- Mark "Sugar Multidextrose" as bacteria for Product 3

UPDATE ingredients
SET is_bacteria = TRUE
WHERE name = 'Sugar Multidextrose'
  AND cost_per_kg_gbp = 1.56;

