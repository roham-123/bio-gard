-- new_seed.sql
-- Same logic as seed.sql; stock option labels use CFU value only (e.g. 1.00E+11).
-- Fill in recipes one by one; this file has only RBC-GT-WW10-10E9 BogBuster 100 grams filled.
BEGIN;

-- Recipes (all names; add batch sizes as you fill each recipe)
INSERT INTO recipes (name, default_batch_grams) VALUES
('FTD Cellex TourTurf Thatch', 10000),
('RBC 200 MM3 plus PRO235 Blue Dye', 10000),
('RBC-PRO-Super FOG-DRY 10grams', 4680),
('RBC-GT-WW10-10E9 BogBuster 100 grams', 30000),
('RBC 100 MM3 plus PRO0234', 50000),
('RBC 100 Soda + PRO234', 10000),
('RBC 200 MM3 plus PRO234', 10000),
('RBC 200 MM3 plus PRO234 alternative', 10000),
('RBC 200 Soda + PRO234', 10000),
('RBC 300', 50000),
('RBC 400+ Hycrocarbon', 30000),
('RBC 500 WW10', 50000),
('RBC -PRO-Super Biotecnica 50E9', 10000),
('Budget - Ireland -10E9-WW10', 13000)
ON CONFLICT (name) DO NOTHING;

-- Ingredients: add one row per material as you add recipes (no duplicates by name).
-- cost_per_kg_gbp is fallback; recipe_lines store per-recipe overrides.
INSERT INTO ingredients (code, name, is_bacteria, cost_per_kg_gbp) VALUES
('BAC 041', 'Paenibacillus Polymyxa 100B', TRUE, 0),
(NULL, 'PHANEROC  HAETE CHRY \"B\"',        FALSE, 0),
(NULL, 'Pseudomonas Putida 500 billion cfu', TRUE, 1550.00),
('PRO0235', 'PRO0235',                    TRUE, 0),
('PRO-1056', 'Trichoderma Reesi 2E10',    TRUE, 101.54),
('PRO-1055', 'Trichoderma Haziarnim 2E10', TRUE, 100.00),
(NULL, 'FUN TRICH HARZIANUM FUN 003',     TRUE, 0),
(NULL, 'MultiDextrose 60% 40% Soda',      FALSE, 1.81),
(NULL, 'Soda 40% Soda',                   FALSE, 0.58),
(NULL, 'Seaweed / Fulvic acid',           FALSE, 10.00),
(NULL, 'WW100',                           TRUE,  62.50),
(NULL, 'Bacillus Polymyxa',               TRUE,  316.67),
(NULL, 'Pseudomonas Putida',              TRUE,  1766.67),
(NULL, 'Arthrobacter Globiformis',        TRUE,  316.67),
(NULL, 'Trichoderma Harzianum 20E9',      TRUE,  58.33),
(NULL, 'Trichoderma Reesi 20E9',          TRUE,  58.33),
(NULL, 'Trichoderma Harzianum 10E9',      TRUE,  58.00),
(NULL, 'Trichoderma Reesi 10E9',          TRUE,  58.00),
(NULL, 'Zeolit 100 Micron',               FALSE, 1.74),
(NULL, 'Sugar',                           TRUE,  1.56),
(NULL, 'Sugar Multidextrose',             TRUE,  1.56),
(NULL, 'Soda Sodium Bicarbonate',         FALSE, 1.50),
('PRO0235', 'PRO0235',                    TRUE,  0),
(NULL, 'MM3',                             TRUE,  0),
(NULL, 'Zeolite',                         FALSE, 1.50),
(NULL, 'Sodium BiCarbonate',              TRUE,  2.00),
(NULL, 'BlueDye',                         FALSE, 120.00),
(NULL, 'Phanerochaete chrysosporium A',    TRUE,  190.00),
('PRO0234', 'PRO0234',                    TRUE,  44.00),
(NULL, 'Soda',                            FALSE, 2.00),
(NULL, 'Zeolite Soda',                    FALSE, 2.00),
(NULL, 'Zeolite10% and 26% Soda',         FALSE, 2.00),
(NULL, 'Pseudomonas Putida frozen 500B',  TRUE,  1700.00),
('PRO-023', 'PRO-023',                    TRUE,  334.33),
(NULL, 'MultiDextros',                    FALSE, 2.00)
ON CONFLICT (name) DO NOTHING;

-- Recipe lines: one block per product. Fill VALUES when you add that recipe.
-- Product 1 - FTD Cellex TourTurf Thatch (10 kg)
INSERT INTO recipe_lines (recipe_id, ingredient_id, sort_order, target_total_cfu, default_grams, filler_mode, filler_ratio, cost_per_kg_gbp)
SELECT
  (SELECT id FROM recipes WHERE name='FTD Cellex TourTurf Thatch'),
  i.id,
  v.sort_order,
  v.target_total_cfu,
  v.default_grams,
  v.filler_mode,
  v.filler_ratio,
  v.cost_per_kg_gbp
FROM (VALUES
  -- Fillers: use ratio mode so all four keep their relative proportions when batch or CFU changes.
  (1, 'PHANEROC  HAETE CHRY "B"',        0,        0.00,   110,  'ratio', 110.0/9456.0),
  (2, 'Paenibacillus Polymyxa 100B',       1.00e13,  0.00,   100,  'fixed', 0),
  (3, 'Pseudomonas Putida 500 billion cfu',2.00e8,   1550.00, 2,   'fixed', 0),
  (4, 'PRO0235',                           2.95e13,  71.00,  295,  'fixed', 0),
  (5, 'Trichoderma Reesi 2E10',           1.20e11,  101.54,  6,   'fixed', 0),
  (6, 'Trichoderma Haziarnim 2E10',       1.20e11,  100.00,  6,   'fixed', 0),
  (7, 'FUN TRICH HARZIANUM FUN 003',      1.35e11,  0.00,   135,  'fixed', 0),
  (8, 'MultiDextrose 60% 40% Soda',       0,        1.81,  5580,  'ratio', 5580.0/9456.0),
  (9, 'Soda 40% Soda',                    0,        0.58,  3720,  'ratio', 3720.0/9456.0),
  (10,'Seaweed / Fulvic acid',            0,       10.00,    46,  'ratio', 46.0/9456.0)
) AS v(sort_order, ingredient_name, target_total_cfu, cost_per_kg_gbp, default_grams, filler_mode, filler_ratio)
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;

-- Product 2 - RBC 200 MM3 plus PRO235 Blue Dye (10 kg)
-- Fillers Zeolite, Sodium BiCarbonate, BlueDye use ratio mode so they keep relative proportions when batch or CFU changes.
INSERT INTO recipe_lines (recipe_id, ingredient_id, sort_order, target_total_cfu, default_grams, filler_mode, filler_ratio, cost_per_kg_gbp)
SELECT
  (SELECT id FROM recipes WHERE name='RBC 200 MM3 plus PRO235 Blue Dye'),
  i.id,
  v.sort_order,
  v.target_total_cfu,
  v.default_grams,
  v.filler_mode,
  v.filler_ratio,
  v.cost_per_kg_gbp
FROM (VALUES
  (1, 'PRO0235',           4.00e13,  63.38,   400,   'fixed',    0),
  (2, 'MM3',               1.08e13,  4.97,   2700,  'fixed',    0),
  (3, 'Zeolite',           0,        1.50,   500,   'ratio',    500.0/6930),
  (4, 'Sodium BiCarbonate', 0,       1.20,   6390,  'ratio',    6390.0/6930),
  (5, 'BlueDye',           0,        120.00, 40,    'ratio',    40.0/6930)
) AS v(sort_order, ingredient_name, target_total_cfu, cost_per_kg_gbp, default_grams, filler_mode, filler_ratio)
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;

-- Product 3 - RBC-PRO-Super FOG-DRY 10grams (4.68 kg)
INSERT INTO recipe_lines (recipe_id, ingredient_id, sort_order, target_total_cfu, default_grams, filler_mode, filler_ratio, cost_per_kg_gbp)
SELECT
  (SELECT id FROM recipes WHERE name='RBC-PRO-Super FOG-DRY 10grams'),
  i.id,
  v.sort_order,
  v.target_total_cfu,
  v.default_grams,
  v.filler_mode,
  v.filler_ratio,
  v.cost_per_kg_gbp
FROM (VALUES
  (1, 'WW100',                      1.87e14,  62.50,   1872,    'fixed', 0),
  (2, 'Bacillus Polymyxa',          0,        316.67,  0,       'fixed', 0),
  (3, 'Pseudomonas Putida',         4.68e12,  1766.67, 9.36,    'fixed', 0),
  (4, 'Arthrobacter Globiformis',   9.36e11,  1600.00, 9.36,   'fixed', 0),
  (5, 'Trichoderma Harzianum 20E9', 4.68e12,  58.33,   468,     'fixed', 0),
  (6, 'Trichoderma Reesi 20E9',     4.68e12,  58.33,   468,     'fixed', 0),
  (7, 'Zeolit 100 Micron',          0,        1.74,    234,     'fixed', 0),
  (8, 'Sugar Multidextrose',        2.71e10,  1.56,   271.44,  'fixed', 0),
  (9, 'Soda Sodium Bicarbonate',    0,        1.50,    1347.84, 'remainder', 0)
) AS v(sort_order, ingredient_name, target_total_cfu, cost_per_kg_gbp, default_grams, filler_mode, filler_ratio)
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;

-- Product 4 - RBC-GT-WW10-10E9 BogBuster 100 grams (30 kg)
INSERT INTO recipe_lines (recipe_id, ingredient_id, sort_order, target_total_cfu, default_grams, filler_mode, filler_ratio, cost_per_kg_gbp)
SELECT
  (SELECT id FROM recipes WHERE name='RBC-GT-WW10-10E9 BogBuster 100 grams'),
  i.id,
  v.sort_order,
  v.target_total_cfu,
  v.default_grams,
  v.filler_mode,
  v.filler_ratio,
  v.cost_per_kg_gbp
FROM (VALUES
  (1, 'WW100',                      3.00e14,  62.50,   3000,  'fixed', 0),
  (2, 'Bacillus Polymyxa',          0,        316.67,  0,     'fixed', 0),
  (3, 'Pseudomonas Putida',         3.00e13,  1766.67, 60,    'fixed', 0),
  (4, 'Arthrobacter Globiformis',   1.50e13,  316.67,  150,   'fixed', 0),
  (5, 'Trichoderma Harzianum 20E9', 6.00e12,  58.33,   600,   'fixed', 0),
  (6, 'Trichoderma Reesi 20E9',     6.00e12,  58.33,   600,   'fixed', 0),
  (7, 'Zeolit 100 Micron',          0,        1.74,    1500,  'fixed', 0),
  (8, 'Sugar',                      6.00e10,  1.56,    600,   'fixed', 0),
  (9, 'Soda Sodium Bicarbonate',    0,        1.50,    23490, 'remainder', 0)
) AS v(sort_order, ingredient_name, target_total_cfu, cost_per_kg_gbp, default_grams, filler_mode, filler_ratio)
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;

-- Product 5 - RBC 100 MM3 plus PRO0234 (50 kg)
INSERT INTO recipe_lines (recipe_id, ingredient_id, sort_order, target_total_cfu, default_grams, filler_mode, filler_ratio, cost_per_kg_gbp)
SELECT
  (SELECT id FROM recipes WHERE name='RBC 100 MM3 plus PRO0234'),
  i.id,
  v.sort_order,
  v.target_total_cfu,
  v.default_grams,
  v.filler_mode,
  v.filler_ratio,
  v.cost_per_kg_gbp
FROM (VALUES
  (1, 'PRO0234',  2.50e13, 44.00,  500,   'fixed', 0),
  (2, 'MM3',      3.60e13, 6.62,   12000, 'fixed', 0),
  (3, 'Soda',     0,       2.00,   37500, 'remainder', 0)
) AS v(sort_order, ingredient_name, target_total_cfu, cost_per_kg_gbp, default_grams, filler_mode, filler_ratio)
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;

-- Product 6 - RBC 100 Soda + PRO234 (10 kg)
INSERT INTO recipe_lines (recipe_id, ingredient_id, sort_order, target_total_cfu, default_grams, filler_mode, filler_ratio, cost_per_kg_gbp)
SELECT
  (SELECT id FROM recipes WHERE name='RBC 100 Soda + PRO234'),
  i.id,
  v.sort_order,
  v.target_total_cfu,
  v.default_grams,
  v.filler_mode,
  v.filler_ratio,
  v.cost_per_kg_gbp
FROM (VALUES
  (1, 'PRO0234',     1.00e13, 38.00, 200,  'fixed', 0),
  (2, 'Zeolite Soda', 0,      2.00,  9800, 'remainder', 0)
) AS v(sort_order, ingredient_name, target_total_cfu, cost_per_kg_gbp, default_grams, filler_mode, filler_ratio)
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;

-- Product 7 - RBC 200 MM3 plus PRO234 (10 kg)
INSERT INTO recipe_lines (recipe_id, ingredient_id, sort_order, target_total_cfu, default_grams, filler_mode, filler_ratio, cost_per_kg_gbp)
SELECT
  (SELECT id FROM recipes WHERE name='RBC 200 MM3 plus PRO234'),
  i.id,
  v.sort_order,
  v.target_total_cfu,
  v.default_grams,
  v.filler_mode,
  v.filler_ratio,
  v.cost_per_kg_gbp
FROM (VALUES
  (1, 'PRO0235',                  4.00e13, 71.00,  400,  'fixed', 0),
  (2, 'MM3',                      1.80e13, 5.88,  6000, 'fixed', 0),
  (3, 'Zeolite10% and 26% Soda',  0,      2.00,  3600, 'remainder', 0)
) AS v(sort_order, ingredient_name, target_total_cfu, cost_per_kg_gbp, default_grams, filler_mode, filler_ratio)
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;

-- Product 8 - RBC 200 MM3 plus PRO234 alternative (10 kg)
INSERT INTO recipe_lines (recipe_id, ingredient_id, sort_order, target_total_cfu, default_grams, filler_mode, filler_ratio, cost_per_kg_gbp)
SELECT
  (SELECT id FROM recipes WHERE name='RBC 200 MM3 plus PRO234 alternative'),
  i.id,
  v.sort_order,
  v.target_total_cfu,
  v.default_grams,
  v.filler_mode,
  v.filler_ratio,
  v.cost_per_kg_gbp
FROM (VALUES
  (1, 'PRO0234',     5.00e13, 39.00, 1000, 'fixed', 0),
  (2, 'Zeolite Soda', 0,     2.00,  9000, 'remainder', 0)
) AS v(sort_order, ingredient_name, target_total_cfu, cost_per_kg_gbp, default_grams, filler_mode, filler_ratio)
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;

-- Product 9 - RBC 200 Soda + PRO234 (10 kg)
INSERT INTO recipe_lines (recipe_id, ingredient_id, sort_order, target_total_cfu, default_grams, filler_mode, filler_ratio, cost_per_kg_gbp)
SELECT
  (SELECT id FROM recipes WHERE name='RBC 200 Soda + PRO234'),
  i.id,
  v.sort_order,
  v.target_total_cfu,
  v.default_grams,
  v.filler_mode,
  v.filler_ratio,
  v.cost_per_kg_gbp
FROM (VALUES
  (1, 'PRO0234',     5.00e13, 37.00, 1000, 'fixed', 0),
  (2, 'Zeolite Soda', 0,     2.00,  9000, 'remainder', 0)
) AS v(sort_order, ingredient_name, target_total_cfu, cost_per_kg_gbp, default_grams, filler_mode, filler_ratio)
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;

-- Product 10 - RBC 300 (50 kg)
INSERT INTO recipe_lines (recipe_id, ingredient_id, sort_order, target_total_cfu, default_grams, filler_mode, filler_ratio, cost_per_kg_gbp)
SELECT
  (SELECT id FROM recipes WHERE name='RBC 300'),
  i.id,
  v.sort_order,
  v.target_total_cfu,
  v.default_grams,
  v.filler_mode,
  v.filler_ratio,
  v.cost_per_kg_gbp
FROM (VALUES
  (1, 'PRO0235',                      2.50e14,  80.00,  2500,  'fixed', 0),
  (2, 'Bacillus Polymyxa',            1.00e13,  320.00, 100,   'fixed', 0),
  (3, 'Pseudomonas Putida',            5.00e12,  1700.00, 10,  'fixed', 0),
  (4, 'Arthrobacter Globiformis',     1.00e13,  1600.00, 10,   'fixed', 0),
  (5, 'Phanerochaete chrysosporium A', 0,        190.00, 0,    'fixed', 0),
  (6, 'Sodium BiCarbonate',            4.42e12,  2.00,   44200, 'fixed', 0),
  (7, 'Zeolite',                       0,        1.15,   3180,  'remainder', 0)
) AS v(sort_order, ingredient_name, target_total_cfu, cost_per_kg_gbp, default_grams, filler_mode, filler_ratio)
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;

-- Product 11 - RBC 400+ Hycrocarbon (10 kg)
INSERT INTO recipe_lines (recipe_id, ingredient_id, sort_order, target_total_cfu, default_grams, filler_mode, filler_ratio, cost_per_kg_gbp)
SELECT
  (SELECT id FROM recipes WHERE name='RBC 400+ Hycrocarbon'),
  i.id,
  v.sort_order,
  v.target_total_cfu,
  v.default_grams,
  v.filler_mode,
  v.filler_ratio,
  v.cost_per_kg_gbp
FROM (VALUES
  (1, 'PRO0235',                    1.50e14,  71.00,   1500,  'fixed',     0),
  (2, 'Paenibacillus Polymyxa 100B', 3.00e12, 313.50,   30,  'fixed',     0),
  (3, 'Pseudomonas Putida',        6.00e12,  1667.67,   12,  'fixed',     0),
  (4, 'Arthrobacter Globiformis',  1.20e13,  1563.50,   12,  'fixed',     0),
  (5, 'Trichoderma Harzianum 10E9', 1.50e13,  58.00,  1500, 'fixed',     0),
  (6, 'Trichoderma Reesi 10E9',     1.50e13,  58.00,  1500, 'fixed',     0),
  -- Two fillers use ratio so they keep relative proportions (23706:1740) when batch or CFU changes.
  (7, 'Soda',                       0,        1.20,  23706, 'ratio',     23706.0/25446.0),
  (8, 'Zeolite',                    0,        1.15,   1740, 'ratio',     1740.0/25446.0)
) AS v(sort_order, ingredient_name, target_total_cfu, cost_per_kg_gbp, default_grams, filler_mode, filler_ratio)
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;

-- Product 12 - RBC 500 WW10 (50 kg)
INSERT INTO recipe_lines (recipe_id, ingredient_id, sort_order, target_total_cfu, default_grams, filler_mode, filler_ratio, cost_per_kg_gbp)
SELECT
  (SELECT id FROM recipes WHERE name='RBC 500 WW10'),
  i.id,
  v.sort_order,
  v.target_total_cfu,
  v.default_grams,
  v.filler_mode,
  v.filler_ratio,
  v.cost_per_kg_gbp
FROM (VALUES
  (1, 'PRO0235',                    6.00e14,  71.00,  6000,  'fixed',     0),
  (2, 'Trichoderma Harzianum 10E9', 1.50e13,  80.00,  1500, 'fixed',     0),
  (3, 'Trichoderma Reesi 10E9',     1.50e13,  80.00,  1500, 'fixed',     0),
  (4, 'Pseudomonas Putida frozen 500B', 2.50e12, 1700.00, 50, 'fixed',    0),
  (5, 'Arthrobacter Globiformis',   5.00e12, 1600.00, 50,  'fixed',      0),
  (6, 'WW100',                      5.90e14,  61.00,  5900, 'fixed',     0),
  -- Two fillers use ratio so they keep relative proportions (5000:30000) when batch or CFU changes.
  (7, 'Zeolite',                    0,        1.15,   5000, 'ratio',     5000.0/35000.0),
  (8, 'Soda',                       0,        2.00,  30000, 'ratio',     30000.0/35000.0)
) AS v(sort_order, ingredient_name, target_total_cfu, cost_per_kg_gbp, default_grams, filler_mode, filler_ratio)
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;

-- Product 13 - RBC -PRO-Super Biotecnica 50E9 (10 kg)
INSERT INTO recipe_lines (recipe_id, ingredient_id, sort_order, target_total_cfu, default_grams, filler_mode, filler_ratio, cost_per_kg_gbp)
SELECT
  (SELECT id FROM recipes WHERE name='RBC -PRO-Super Biotecnica 50E9'),
  i.id,
  v.sort_order,
  v.target_total_cfu,
  v.default_grams,
  v.filler_mode,
  v.filler_ratio,
  v.cost_per_kg_gbp
FROM (VALUES
  (1, 'PRO0235',                    4.00e14,  70.00,   4000,  'fixed', 0),
  (2, 'Bacillus Polymyxa',          1.00e13,  314.00,   100,  'fixed', 0),
  (3, 'Pseudomonas Putida',         5.00e13, 1600.00,   100,  'fixed', 0),
  (4, 'Arthrobacter Globiformis',   5.00e13, 1560.00,    50,  'fixed', 0),
  (5, 'Trichoderma Harzianum 10E9', 1.50e13,  57.67,  1500,  'fixed', 0),
  (6, 'Trichoderma Reesi 10E9',     1.50e13,  57.67,  1500,  'fixed', 0),
  (7, 'PRO-023',                    0,       334.33,     0,  'fixed', 0),
  -- Two fillers use ratio so they keep relative proportions (2250:500) when batch or CFU changes.
  (8, 'MultiDextros',               0,        2.00,   2250,  'ratio', 2250.0/2750.0),
  (9, 'Zeolite',                    0,        1.15,    500,  'ratio',  500.0/2750.0)
) AS v(sort_order, ingredient_name, target_total_cfu, cost_per_kg_gbp, default_grams, filler_mode, filler_ratio)
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;

-- Product 14 - Budget - Ireland -10E9-WW10 (13 kg)
INSERT INTO recipe_lines (recipe_id, ingredient_id, sort_order, target_total_cfu, default_grams, filler_mode, filler_ratio, cost_per_kg_gbp)
SELECT
  (SELECT id FROM recipes WHERE name='Budget - Ireland -10E9-WW10'),
  i.id,
  v.sort_order,
  v.target_total_cfu,
  v.default_grams,
  v.filler_mode,
  v.filler_ratio,
  v.cost_per_kg_gbp
FROM (VALUES
  (1, 'PRO0235',                    1.56e14,  71.00,   1560,  'fixed', 0),
  (2, 'Trichoderma Harzianum 10E9', 3.90e12,  80.00,    390, 'fixed', 0),
  (3, 'Trichoderma Reesi 10E9',     3.90e12,  80.00,    390, 'fixed', 0),
  (4, 'Pseudomonas Putida frozen 500B', 0,   1700.00,     0, 'fixed', 0),
  (5, 'Arthrobacter Globiformis',   0,       1600.00,     0, 'fixed', 0),
  (6, 'WW100',                      1.30e14,  61.00,   1300, 'fixed', 0),
  -- Two fillers use ratio so they keep relative proportions (1560:7800) when batch or CFU changes.
  (7, 'Zeolite',                    0,        1.15,   1560, 'ratio',  1560.0/9360.0),
  (8, 'Soda',                       0,        2.00,   7800, 'ratio',  7800.0/9360.0)
) AS v(sort_order, ingredient_name, target_total_cfu, cost_per_kg_gbp, default_grams, filler_mode, filler_ratio)
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;

-- Stock options: label = CFU value only (e.g. 1.00E+11). Add options as you add recipes.
-- One option per (ingredient, cfu_per_gram) or more if same CFU at different prices (then use unique label e.g. 1.00E+11 with a suffix).
INSERT INTO ingredient_cfu_options (ingredient_id, label, cfu_per_gram, is_default, price_gbp)
SELECT i.id, v.label, v.cfu_per_gram, v.is_default, v.price_gbp
FROM (VALUES
  ('WW100',                      '1.00E+11',  1.00e11, TRUE,  62.50),
  ('Bacillus Polymyxa',          '1.00E+11',  1.00e11, TRUE,  316.67),
  ('Paenibacillus Polymyxa 100B','1.00E+11',  1.00e11, TRUE,  0.00),
  ('Pseudomonas Putida',         '5.00E+11',  5.00e11, TRUE,  1766.67),
  ('Pseudomonas Putida 500 billion cfu','1.00E+08', 1.00e08, TRUE, 1550.00),
  ('Arthrobacter Globiformis',   '1.00E+11',      1.00e11, TRUE,  316.67),
  ('Arthrobacter Globiformis',   '1.00E+11 (1600)', 1.00e11, FALSE, 1600.00),
  ('Trichoderma Harzianum 20E9', '1.00E+10',  1.00e10, TRUE,  58.33),
  ('Trichoderma Reesi 20E9',     '1.00E+10',  1.00e10, TRUE,  58.33),
  ('Trichoderma Reesi 2E10',     '2.00E+10',  2.00e10, TRUE,  101.54),
  ('Trichoderma Haziarnim 2E10', '2.00E+10',  2.00e10, TRUE,  100.00),
  ('Trichoderma Harzianum 10E9','1.00E+10',         1.00e10, TRUE,  58.00),
  ('Trichoderma Harzianum 10E9','1.00E+10 (57.67)', 1.00e10, FALSE, 57.67),
  ('Trichoderma Harzianum 10E9','1.00E+10 (80)',    1.00e10, FALSE, 80.00),
  ('Trichoderma Reesi 10E9',    '1.00E+10',         1.00e10, TRUE,  58.00),
  ('Trichoderma Reesi 10E9',    '1.00E+10 (57.67)', 1.00e10, FALSE, 57.67),
  ('Trichoderma Reesi 10E9',    '1.00E+10 (80)',    1.00e10, FALSE, 80.00),
  ('Sugar',                      '1.00E+08',  1.00e08, TRUE,  1.56),
  ('Sugar Multidextrose',        '1.00E+08',  1.00e08, TRUE,  1.56),
  ('FUN TRICH HARZIANUM FUN 003','1.00E+09',  1.00e09, TRUE,  0.00),
  ('PRO0235',                   '1.00E+11 (63.38)',  1.00e11, TRUE,  63.38),
  ('PRO0235',                   '1.00E+11 (71.00)',  1.00e11, FALSE, 71.00),
  ('PRO0235',                   '1.00E+11 (71.00 RBC400)', 1.00e11, FALSE, 71.00),
  ('PRO0235',                   '1.00E+11 (80)',     1.00e11, FALSE, 80.00),
  ('PRO0235',                   '1.00E+11 (70)',     1.00e11, FALSE, 70.00),
  ('Bacillus Polymyxa',         '1.00E+11 (320)',    1.00e11, FALSE, 320.00),
  ('Pseudomonas Putida',        '5.00E+11 (1700)',   5.00e11, FALSE, 1700.00),
  ('Pseudomonas Putida',        '5.00E+11 (1667.67)', 5.00e11, FALSE, 1667.67),
  ('Pseudomonas Putida frozen 500B','5.00E+10',     5.00e10, TRUE, 1700.00),
  ('Arthrobacter Globiformis',  '1.00E+12',          1.00e12, FALSE, 1600.00),
  ('Arthrobacter Globiformis',  '1.00E+12 (1560)',   1.00e12, FALSE, 1560.00),
  ('Arthrobacter Globiformis',  '1.00E+12 (1563.50)', 1.00e12, FALSE, 1563.50),
  ('Phanerochaete chrysosporium A','1.00E+09',       1.00e09, TRUE,  190.00),
  ('Sodium BiCarbonate',        '1.00E+08',          1.00e08, TRUE,  2.00),
  ('PRO0234',                   '5.00E+10',  5.00e10, TRUE,  44.00),
  ('PRO0234',                   '5.00E+10 (38)',     5.00e10, FALSE, 38.00),
  ('PRO0234',                   '5.00E+10 (39)',     5.00e10, FALSE, 39.00),
  ('PRO0234',                   '5.00E+10 (37)',     5.00e10, FALSE, 37.00),
  ('MM3',                       '4.00E+09',  4.00e09, TRUE,  4.97),
  ('MM3',                       '3.00E+09',  3.00e09, FALSE, 6.62),
  ('MM3',                       '3.00E+09 (5.88)',  3.00e09, FALSE, 5.88)
) AS v(ingredient_name, label, cfu_per_gram, is_default, price_gbp)
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT (ingredient_id, label) DO NOTHING;

-- Set recipe-line default stock for BogBuster (match by ingredient + cost + CFU/g).
UPDATE recipe_lines rl
SET default_cfu_option_id = (
  SELECT ico.id
  FROM ingredient_cfu_options ico
  WHERE ico.ingredient_id = rl.ingredient_id
  AND (rl.cost_per_kg_gbp IS NOT NULL AND ico.price_gbp = rl.cost_per_kg_gbp
       OR rl.cost_per_kg_gbp IS NULL AND ico.price_gbp IS NULL)
  AND (rl.default_grams = 0 OR (rl.default_grams > 0 AND ico.cfu_per_gram = rl.target_total_cfu / rl.default_grams))
  ORDER BY ico.price_gbp DESC NULLS LAST
  LIMIT 1
)
WHERE rl.recipe_id = (SELECT id FROM recipes WHERE name = 'RBC-GT-WW10-10E9 BogBuster 100 grams')
AND (rl.target_total_cfu > 0 OR rl.ingredient_id IN (SELECT id FROM ingredients WHERE is_bacteria = true));

-- Set recipe-line default stock for RBC-PRO-Super FOG-DRY 10grams.
UPDATE recipe_lines rl
SET default_cfu_option_id = (
  SELECT ico.id
  FROM ingredient_cfu_options ico
  WHERE ico.ingredient_id = rl.ingredient_id
  AND (rl.cost_per_kg_gbp IS NOT NULL AND ico.price_gbp = rl.cost_per_kg_gbp
       OR rl.cost_per_kg_gbp IS NULL AND ico.price_gbp IS NULL)
  AND (rl.default_grams = 0 OR (rl.default_grams > 0 AND ico.cfu_per_gram = rl.target_total_cfu / rl.default_grams))
  ORDER BY ico.price_gbp DESC NULLS LAST
  LIMIT 1
)
WHERE rl.recipe_id = (SELECT id FROM recipes WHERE name = 'RBC-PRO-Super FOG-DRY 10grams')
AND (rl.target_total_cfu > 0 OR rl.ingredient_id IN (SELECT id FROM ingredients WHERE is_bacteria = true));

-- Set recipe-line default stock for RBC 200 MM3 plus PRO235 Blue Dye.
UPDATE recipe_lines rl
SET default_cfu_option_id = (
  SELECT ico.id
  FROM ingredient_cfu_options ico
  WHERE ico.ingredient_id = rl.ingredient_id
  AND (rl.cost_per_kg_gbp IS NOT NULL AND ico.price_gbp = rl.cost_per_kg_gbp
       OR rl.cost_per_kg_gbp IS NULL AND ico.price_gbp IS NULL)
  AND (rl.default_grams = 0 OR (rl.default_grams > 0 AND ico.cfu_per_gram = rl.target_total_cfu / rl.default_grams))
  ORDER BY ico.price_gbp DESC NULLS LAST
  LIMIT 1
)
WHERE rl.recipe_id = (SELECT id FROM recipes WHERE name = 'RBC 200 MM3 plus PRO235 Blue Dye')
AND (rl.target_total_cfu > 0 OR rl.ingredient_id IN (SELECT id FROM ingredients WHERE is_bacteria = true));

-- Set recipe-line default stock for RBC 100 MM3 plus PRO0234.
UPDATE recipe_lines rl
SET default_cfu_option_id = (
  SELECT ico.id
  FROM ingredient_cfu_options ico
  WHERE ico.ingredient_id = rl.ingredient_id
  AND (rl.cost_per_kg_gbp IS NOT NULL AND ico.price_gbp = rl.cost_per_kg_gbp
       OR rl.cost_per_kg_gbp IS NULL AND ico.price_gbp IS NULL)
  AND (rl.default_grams = 0 OR (rl.default_grams > 0 AND ico.cfu_per_gram = rl.target_total_cfu / rl.default_grams))
  ORDER BY ico.price_gbp DESC NULLS LAST
  LIMIT 1
)
WHERE rl.recipe_id = (SELECT id FROM recipes WHERE name = 'RBC 100 MM3 plus PRO0234')
AND (rl.target_total_cfu > 0 OR rl.ingredient_id IN (SELECT id FROM ingredients WHERE is_bacteria = true));

-- Set recipe-line default stock for RBC 100 Soda + PRO234.
UPDATE recipe_lines rl
SET default_cfu_option_id = (
  SELECT ico.id
  FROM ingredient_cfu_options ico
  WHERE ico.ingredient_id = rl.ingredient_id
  AND (rl.cost_per_kg_gbp IS NOT NULL AND ico.price_gbp = rl.cost_per_kg_gbp
       OR rl.cost_per_kg_gbp IS NULL AND ico.price_gbp IS NULL)
  AND (rl.default_grams = 0 OR (rl.default_grams > 0 AND ico.cfu_per_gram = rl.target_total_cfu / rl.default_grams))
  ORDER BY ico.price_gbp DESC NULLS LAST
  LIMIT 1
)
WHERE rl.recipe_id = (SELECT id FROM recipes WHERE name = 'RBC 100 Soda + PRO234')
AND (rl.target_total_cfu > 0 OR rl.ingredient_id IN (SELECT id FROM ingredients WHERE is_bacteria = true));

-- Set recipe-line default stock for RBC 200 MM3 plus PRO234.
UPDATE recipe_lines rl
SET default_cfu_option_id = (
  SELECT ico.id
  FROM ingredient_cfu_options ico
  WHERE ico.ingredient_id = rl.ingredient_id
  AND (rl.cost_per_kg_gbp IS NOT NULL AND ico.price_gbp = rl.cost_per_kg_gbp
       OR rl.cost_per_kg_gbp IS NULL AND ico.price_gbp IS NULL)
  AND (rl.default_grams = 0 OR (rl.default_grams > 0 AND ico.cfu_per_gram = rl.target_total_cfu / rl.default_grams))
  ORDER BY ico.price_gbp DESC NULLS LAST
  LIMIT 1
)
WHERE rl.recipe_id = (SELECT id FROM recipes WHERE name = 'RBC 200 MM3 plus PRO234')
AND (rl.target_total_cfu > 0 OR rl.ingredient_id IN (SELECT id FROM ingredients WHERE is_bacteria = true));

-- Set recipe-line default stock for RBC 200 MM3 plus PRO234 alternative.
UPDATE recipe_lines rl
SET default_cfu_option_id = (
  SELECT ico.id
  FROM ingredient_cfu_options ico
  WHERE ico.ingredient_id = rl.ingredient_id
  AND (rl.cost_per_kg_gbp IS NOT NULL AND ico.price_gbp = rl.cost_per_kg_gbp
       OR rl.cost_per_kg_gbp IS NULL AND ico.price_gbp IS NULL)
  AND (rl.default_grams = 0 OR (rl.default_grams > 0 AND ico.cfu_per_gram = rl.target_total_cfu / rl.default_grams))
  ORDER BY ico.price_gbp DESC NULLS LAST
  LIMIT 1
)
WHERE rl.recipe_id = (SELECT id FROM recipes WHERE name = 'RBC 200 MM3 plus PRO234 alternative')
AND (rl.target_total_cfu > 0 OR rl.ingredient_id IN (SELECT id FROM ingredients WHERE is_bacteria = true));

-- Set recipe-line default stock for RBC 200 Soda + PRO234.
UPDATE recipe_lines rl
SET default_cfu_option_id = (
  SELECT ico.id
  FROM ingredient_cfu_options ico
  WHERE ico.ingredient_id = rl.ingredient_id
  AND (rl.cost_per_kg_gbp IS NOT NULL AND ico.price_gbp = rl.cost_per_kg_gbp
       OR rl.cost_per_kg_gbp IS NULL AND ico.price_gbp IS NULL)
  AND (rl.default_grams = 0 OR (rl.default_grams > 0 AND ico.cfu_per_gram = rl.target_total_cfu / rl.default_grams))
  ORDER BY ico.price_gbp DESC NULLS LAST
  LIMIT 1
)
WHERE rl.recipe_id = (SELECT id FROM recipes WHERE name = 'RBC 200 Soda + PRO234')
AND (rl.target_total_cfu > 0 OR rl.ingredient_id IN (SELECT id FROM ingredients WHERE is_bacteria = true));

-- Set recipe-line default stock for RBC 300.
UPDATE recipe_lines rl
SET default_cfu_option_id = (
  SELECT ico.id
  FROM ingredient_cfu_options ico
  WHERE ico.ingredient_id = rl.ingredient_id
  AND (rl.cost_per_kg_gbp IS NOT NULL AND ico.price_gbp = rl.cost_per_kg_gbp
       OR rl.cost_per_kg_gbp IS NULL AND ico.price_gbp IS NULL)
  AND (rl.default_grams = 0 OR (rl.default_grams > 0 AND ico.cfu_per_gram = rl.target_total_cfu / rl.default_grams))
  ORDER BY ico.price_gbp DESC NULLS LAST
  LIMIT 1
)
WHERE rl.recipe_id = (SELECT id FROM recipes WHERE name = 'RBC 300')
AND (rl.target_total_cfu > 0 OR rl.ingredient_id IN (SELECT id FROM ingredients WHERE is_bacteria = true));

-- Set recipe-line default stock for RBC 400+ Hycrocarbon.
UPDATE recipe_lines rl
SET default_cfu_option_id = (
  SELECT ico.id
  FROM ingredient_cfu_options ico
  WHERE ico.ingredient_id = rl.ingredient_id
  AND (rl.cost_per_kg_gbp IS NOT NULL AND ico.price_gbp = rl.cost_per_kg_gbp
       OR rl.cost_per_kg_gbp IS NULL AND ico.price_gbp IS NULL)
  AND (rl.default_grams = 0 OR (rl.default_grams > 0 AND ico.cfu_per_gram = rl.target_total_cfu / rl.default_grams))
  ORDER BY ico.price_gbp DESC NULLS LAST
  LIMIT 1
)
WHERE rl.recipe_id = (SELECT id FROM recipes WHERE name = 'RBC 400+ Hycrocarbon')
AND (rl.target_total_cfu > 0 OR rl.ingredient_id IN (SELECT id FROM ingredients WHERE is_bacteria = true));

-- Set recipe-line default stock for RBC 500 WW10.
UPDATE recipe_lines rl
SET default_cfu_option_id = (
  SELECT ico.id
  FROM ingredient_cfu_options ico
  WHERE ico.ingredient_id = rl.ingredient_id
  AND (rl.cost_per_kg_gbp IS NOT NULL AND ico.price_gbp = rl.cost_per_kg_gbp
       OR rl.cost_per_kg_gbp IS NULL AND ico.price_gbp IS NULL)
  AND (rl.default_grams = 0 OR (rl.default_grams > 0 AND ico.cfu_per_gram = rl.target_total_cfu / rl.default_grams))
  ORDER BY ico.price_gbp DESC NULLS LAST
  LIMIT 1
)
WHERE rl.recipe_id = (SELECT id FROM recipes WHERE name = 'RBC 500 WW10')
AND (rl.target_total_cfu > 0 OR rl.ingredient_id IN (SELECT id FROM ingredients WHERE is_bacteria = true));

-- Set recipe-line default stock for RBC -PRO-Super Biotecnica 50E9.
UPDATE recipe_lines rl
SET default_cfu_option_id = (
  SELECT ico.id
  FROM ingredient_cfu_options ico
  WHERE ico.ingredient_id = rl.ingredient_id
  AND (rl.cost_per_kg_gbp IS NOT NULL AND ico.price_gbp = rl.cost_per_kg_gbp
       OR rl.cost_per_kg_gbp IS NULL AND ico.price_gbp IS NULL)
  AND (rl.default_grams = 0 OR (rl.default_grams > 0 AND ico.cfu_per_gram = rl.target_total_cfu / rl.default_grams))
  ORDER BY ico.price_gbp DESC NULLS LAST
  LIMIT 1
)
WHERE rl.recipe_id = (SELECT id FROM recipes WHERE name = 'RBC -PRO-Super Biotecnica 50E9')
AND (rl.target_total_cfu > 0 OR rl.ingredient_id IN (SELECT id FROM ingredients WHERE is_bacteria = true));

-- Set recipe-line default stock for Budget - Ireland -10E9-WW10.
UPDATE recipe_lines rl
SET default_cfu_option_id = (
  SELECT ico.id
  FROM ingredient_cfu_options ico
  WHERE ico.ingredient_id = rl.ingredient_id
  AND (rl.cost_per_kg_gbp IS NOT NULL AND ico.price_gbp = rl.cost_per_kg_gbp
       OR rl.cost_per_kg_gbp IS NULL AND ico.price_gbp IS NULL)
  AND (rl.default_grams = 0 OR (rl.default_grams > 0 AND ico.cfu_per_gram = rl.target_total_cfu / rl.default_grams))
  ORDER BY ico.price_gbp DESC NULLS LAST
  LIMIT 1
)
WHERE rl.recipe_id = (SELECT id FROM recipes WHERE name = 'Budget - Ireland -10E9-WW10')
AND (rl.target_total_cfu > 0 OR rl.ingredient_id IN (SELECT id FROM ingredients WHERE is_bacteria = true));

COMMIT;
