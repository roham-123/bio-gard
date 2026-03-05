-- Set Arthrobacter Globiformis cost_per_kg_gbp to 316.67 for all products

UPDATE ingredients
SET cost_per_kg_gbp = 316.67
WHERE name = 'Arthrobacter Globiformis';

