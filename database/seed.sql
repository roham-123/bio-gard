-- seed.sql
BEGIN;

-- Recipes
INSERT INTO recipes (name, default_batch_grams) VALUES
('FTD Cellex TourTurf Thatch', 10000),
('RBC 200 MM3 plus PRO235 Blue Dye', 10000),
('RBC -PRO-Super FOG-DRY 10grams', 4680),
('RBC-GT-WW10-10E9 BogBuster 100 grams', 30000)
ON CONFLICT (name) DO NOTHING;

-- Ingredients (dedup by name; codes optional)
-- Product 1
INSERT INTO ingredients (code, name, is_bacteria, cost_per_kg_gbp) VALUES
(NULL, 'Filler PHANEROCHEATE CHRY "B"', FALSE, 0),
('BAC 041', 'Paenibacillus Polymyxa 100B', TRUE, 0),
(NULL, 'Pseudomonas Putida 500 billion cfu', TRUE, 1550.00),
('PRO0235', 'PRO0235', TRUE, 71.00),
('PRO-1056', 'Trichoderma Reesi 2E10', TRUE, 101.54),
('PRO-1055', 'Trichoderma Haziarnim 2E10', TRUE, 100.00),
(NULL, 'Filler FUN TRICH HARZIANUM FUN 003', FALSE, 0),
(NULL, 'Filler MultiDextrose 60% 40% Soda', FALSE, 1.81),
(NULL, 'Filler Soda 40% Soda', FALSE, 0.58),
(NULL, 'Seaweed / Fulvic acid', FALSE, 10.00)
ON CONFLICT DO NOTHING;

-- Product 2
INSERT INTO ingredients (code, name, is_bacteria, cost_per_kg_gbp) VALUES
('PRO0235', 'PRO0235', TRUE, 63.38),
(NULL, 'MM3', TRUE, 4.97),
(NULL, 'Zeolite', FALSE, 1.50),
(NULL, 'Sodium BiCarbonae', FALSE, 1.20),
(NULL, 'BlueDye', FALSE, 120.00)
ON CONFLICT DO NOTHING;

-- Product 3
INSERT INTO ingredients (code, name, is_bacteria, cost_per_kg_gbp) VALUES
(NULL, 'WW100', TRUE, 62.50),
(NULL, 'Bacillus Polymyxa', TRUE, 316.67),
(NULL, 'Pseudomonas Putida', TRUE, 1766.67),
(NULL, 'Arthrobacter Globiformis', TRUE, 1600.00),
(NULL, 'Trichoderma Harzianum 20E9', TRUE, 58.33),
(NULL, 'Trichoderma Reesi 20E9', TRUE, 58.33),
(NULL, 'Zeolit 100 Micron', FALSE, 1.74),
(NULL, 'Sugar Multidextrose', FALSE, 1.56),
(NULL, 'Soda Sodium Bicarbonate', FALSE, 1.50)
ON CONFLICT DO NOTHING;

-- Product 4 (reuses many names; insert with ON CONFLICT DO NOTHING pattern above already covers it)
INSERT INTO ingredients (code, name, is_bacteria, cost_per_kg_gbp) VALUES
(NULL, 'Sugar', FALSE, 1.56)
ON CONFLICT DO NOTHING;

-- Helper CTEs to get recipe ids
WITH r AS (
  SELECT id, name FROM recipes
)
-- Recipe Lines: Product 1
INSERT INTO recipe_lines (recipe_id, ingredient_id, sort_order, target_total_cfu, default_grams, filler_mode, filler_ratio)
SELECT
  (SELECT id FROM recipes WHERE name='FTD Cellex TourTurf Thatch'),
  i.id,
  v.sort_order,
  v.target_total_cfu,
  v.default_grams,
  v.filler_mode,
  v.filler_ratio
FROM (VALUES
  (1, 'Filler PHANEROCHEATE CHRY "B"', 0,        110,  'fixed',    0),
  (2, 'Paenibacillus Polymyxa 100B',   1.00e13,  100,  'fixed',    0),
  (3, 'Pseudomonas Putida 500 billion cfu', 2.00e8, 2, 'fixed',    0),
  (4, 'PRO0235',                       2.95e13,  295,  'fixed',    0),
  (5, 'Trichoderma Reesi 2E10',         1.20e11,  6,    'fixed',    0),
  (6, 'Trichoderma Haziarnim 2E10',     1.20e11,  6,    'fixed',    0),
  (7, 'Filler FUN TRICH HARZIANUM FUN 003', 0,   135,  'fixed',    0),

  -- these two are the big fillers. treat as ratio fillers sharing remaining grams 60/40.
  (8, 'Filler MultiDextrose 60% 40% Soda', 0,    5580, 'ratio', 0.60),
  (9, 'Filler Soda 40% Soda',              0,    3720, 'ratio', 0.40),

  (10,'Seaweed / Fulvic acid',            0,     46,   'fixed',    0)
) AS v(sort_order, ingredient_name, target_total_cfu, default_grams, filler_mode, filler_ratio)
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT DO NOTHING;

-- Recipe Lines: Product 2
INSERT INTO recipe_lines (recipe_id, ingredient_id, sort_order, target_total_cfu, default_grams, filler_mode, filler_ratio)
SELECT
  (SELECT id FROM recipes WHERE name='RBC 200 MM3 plus PRO235 Blue Dye'),
  i.id,
  v.sort_order,
  v.target_total_cfu,
  v.default_grams,
  v.filler_mode,
  v.filler_ratio
FROM (VALUES
  (1, 'PRO0235',       4.00e13,  400,  'fixed',     0),
  (2, 'MM3',           1.08e13, 2700,  'fixed',     0),
  (3, 'Zeolite',       0,        500,  'fixed',     0),

  -- remainder filler
  (4, 'Sodium BiCarbonae', 0,   6390,  'remainder', 0),

  (5, 'BlueDye',       0,         40,  'fixed',     0)
) AS v(sort_order, ingredient_name, target_total_cfu, default_grams, filler_mode, filler_ratio)
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT DO NOTHING;

-- Recipe Lines: Product 3
INSERT INTO recipe_lines (recipe_id, ingredient_id, sort_order, target_total_cfu, default_grams, filler_mode, filler_ratio)
SELECT
  (SELECT id FROM recipes WHERE name='RBC -PRO-Super FOG-DRY 10grams'),
  i.id,
  v.sort_order,
  v.target_total_cfu,
  v.default_grams,
  v.filler_mode,
  v.filler_ratio
FROM (VALUES
  (1, 'WW100',                     1.872e14, 1872,   'fixed', 0),
  (2, 'Bacillus Polymyxa',         0,          0,     'fixed', 0),
  (3, 'Pseudomonas Putida',        4.68e12,    9.36,  'fixed', 0),
  (4, 'Arthrobacter Globiformis',  9.36e11,    9.36,  'fixed', 0),
  (5, 'Trichoderma Harzianum 20E9',4.68e12,   468,    'fixed', 0),
  (6, 'Trichoderma Reesi 20E9',    4.68e12,   468,    'fixed', 0),
  (7, 'Zeolit 100 Micron',         0,         234,    'fixed', 0),
  (8, 'Sugar Multidextrose',       2.7144e10, 271.44, 'fixed', 0),

  -- remainder filler
  (9, 'Soda Sodium Bicarbonate',   0,        1347.84, 'remainder', 0)
) AS v(sort_order, ingredient_name, target_total_cfu, default_grams, filler_mode, filler_ratio)
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT DO NOTHING;

-- Recipe Lines: Product 4
INSERT INTO recipe_lines (recipe_id, ingredient_id, sort_order, target_total_cfu, default_grams, filler_mode, filler_ratio)
SELECT
  (SELECT id FROM recipes WHERE name='RBC-GT-WW10-10E9 BogBuster 100 grams'),
  i.id,
  v.sort_order,
  v.target_total_cfu,
  v.default_grams,
  v.filler_mode,
  v.filler_ratio
FROM (VALUES
  (1, 'WW100',                     3.00e14, 3000,   'fixed', 0),
  (2, 'Bacillus Polymyxa',         0,          0,    'fixed', 0),
  (3, 'Pseudomonas Putida',        3.00e13,    60,   'fixed', 0),
  (4, 'Arthrobacter Globiformis',  1.50e13,   150,   'fixed', 0),
  (5, 'Trichoderma Harzianum 20E9',6.00e12,   600,   'fixed', 0),
  (6, 'Trichoderma Reesi 20E9',    6.00e12,   600,   'fixed', 0),
  (7, 'Zeolit 100 Micron',         0,        1500,   'fixed', 0),
  (8, 'Sugar',                     6.00e10,   600,   'fixed', 0),

  -- remainder filler
  (9, 'Soda Sodium Bicarbonate',   0,       23490,   'remainder', 0)
) AS v(sort_order, ingredient_name, target_total_cfu, default_grams, filler_mode, filler_ratio)
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT DO NOTHING;

-- Seed CFU options (default = sheet col D values)
-- Only for ingredients that have CFU per gram in your tables.
INSERT INTO ingredient_cfu_options (ingredient_id, label, cfu_per_gram, is_default)
SELECT i.id, 'Default', v.cfu_per_gram, TRUE
FROM (VALUES
  ('Paenibacillus Polymyxa 100B',           1.00e11),
  ('Pseudomonas Putida 500 billion cfu',    1.00e08),
  ('PRO0235',                               1.00e11),
  ('Trichoderma Reesi 2E10',                2.00e10),
  ('Trichoderma Haziarnim 2E10',            2.00e10),
  ('Filler FUN TRICH HARZIANUM FUN 003',    1.00e09),

  ('MM3',                                   4.00e09),

  ('WW100',                                 1.00e11),
  ('Bacillus Polymyxa',                     1.00e11),
  ('Pseudomonas Putida',                    5.00e11),
  ('Arthrobacter Globiformis',              1.00e11),
  ('Trichoderma Harzianum 20E9',            1.00e10),
  ('Trichoderma Reesi 20E9',                1.00e10),
  ('Sugar Multidextrose',                   1.00e08),

  ('Sugar',                                 1.00e08)
) AS v(ingredient_name, cfu_per_gram)
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT DO NOTHING;

COMMIT;