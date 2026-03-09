-- seed.sql
BEGIN;

-- Recipes
INSERT INTO recipes (name, default_batch_grams) VALUES
('FTD Cellex TourTurf Thatch', 10000),
('RBC 200 MM3 plus PRO235 Blue Dye', 10000),
('RBC -PRO-Super FOG-DRY 10grams', 4680),
('RBC-GT-WW10-10E9 BogBuster 100 grams', 30000),
('RBC 100 MM3 plus PRO0234', 50000),
('RBC 100 Soda + PRO234', 10000),
('RBC 200 MM3 plus PRO234', 10000),
('RBC 200 MM3 plus PRO234 alternative', 10000),
('RBC 200 Soda + PRO234', 10000),
('RBC 300', 50000),
('RBC 400+ Hycrocarbon', 10000)
ON CONFLICT (name) DO NOTHING;

-- One row per real ingredient material.
-- cost_per_kg_gbp here is a fallback default; recipe_lines store per-recipe overrides.
-- For shared ingredients where cost varies per recipe, set to 0.
INSERT INTO ingredients (code, name, is_bacteria, cost_per_kg_gbp) VALUES
(NULL,       'Filler PHANEROCHEATE CHRY "B"',       FALSE, 0),
('BAC 041',  'Paenibacillus Polymyxa 100B',         TRUE,  0),
(NULL,       'Pseudomonas Putida 500 billion cfu',  TRUE,  1550.00),
('PRO0235',  'PRO0235',                              TRUE,  0),
('PRO-1056', 'Trichoderma Reesi 2E10',               TRUE,  101.54),
('PRO-1055', 'Trichoderma Haziarnim 2E10',           TRUE,  100.00),
(NULL,       'Filler FUN TRICH HARZIANUM FUN 003',   TRUE,  0),
(NULL,       'Filler MultiDextrose 60% 40% Soda',   FALSE, 1.81),
(NULL,       'Filler Soda 40% Soda',                 FALSE, 0.58),
(NULL,       'Seaweed / Fulvic acid',                 FALSE, 10.00),
(NULL,       'MM3',                                   TRUE,  0),
(NULL,       'Zeolite',                               FALSE, 1.50),
(NULL,       'Sodium Bicarbonate',                    FALSE, 1.20),
(NULL,       'BlueDye',                               FALSE, 120.00),
(NULL,       'WW100',                                 TRUE,  62.50),
(NULL,       'Bacillus Polymyxa',                     TRUE,  316.67),
(NULL,       'Pseudomonas Putida',                    TRUE,  1766.67),
(NULL,       'Arthrobacter Globiformis',              TRUE,  316.67),
(NULL,       'Trichoderma Harzianum 20E9',            TRUE,  58.33),
(NULL,       'Trichoderma Reesi 20E9',                TRUE,  58.33),
(NULL,       'Zeolit 100 Micron',                     FALSE, 1.74),
(NULL,       'Sugar Multidextrose',                   TRUE,  1.56),
(NULL,       'Soda Sodium Bicarbonate',               FALSE, 1.50),
(NULL,       'Sugar',                                 TRUE,  1.56),
('PRO0234',  'PRO0234',                               TRUE,  44.00),
(NULL,       'Soda',                                  FALSE, 2.00),
(NULL,       'Zeolite Soda',                          FALSE, 2.00),
(NULL,       'Zeolite10% and 26% Soda',               FALSE, 2.00),
(NULL,       'Sodium BiCarbonate',                    TRUE,  2.00),
(NULL,       'Trichoderma Harzianum 10E9',            TRUE,  58.00),
(NULL,       'Trichoderma Reesi 10E9',                TRUE,  58.00),
(NULL,       'Soda / or MultiDextrose',              FALSE, 1.20)
ON CONFLICT (name) DO NOTHING;

-- Recipe lines join by ingredient name only.
-- cost_per_kg_gbp is stored per recipe line (per-recipe cost override).

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
  (1, 'Filler PHANEROCHEATE CHRY "B"',            0,        0,       110,  'fixed', 0),
  (2, 'Paenibacillus Polymyxa 100B',              1.00e13,  0,       100,  'fixed', 0),
  (3, 'Pseudomonas Putida 500 billion cfu',       2.00e8,   1550.00, 2,    'fixed', 0),
  (4, 'PRO0235',                                   2.95e13,  71.00,   295,  'fixed', 0),
  (5, 'Trichoderma Reesi 2E10',                    1.20e11,  101.54,  6,    'fixed', 0),
  (6, 'Trichoderma Haziarnim 2E10',                1.20e11,  100.00,  6,    'fixed', 0),
  (7, 'Filler FUN TRICH HARZIANUM FUN 003',       1.35e11,  0,       135,  'fixed', 0),
  (8, 'Filler MultiDextrose 60% 40% Soda',        0,        1.81,    5580, 'ratio', 0.60),
  (9, 'Filler Soda 40% Soda',                      0,        0.58,    3720, 'ratio', 0.40),
  (10,'Seaweed / Fulvic acid',                     0,        10.00,   46,   'fixed', 0)
) AS v(sort_order, ingredient_name, target_total_cfu, cost_per_kg_gbp, default_grams, filler_mode, filler_ratio)
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;

-- Product 2 - RBC 200 MM3 plus PRO235 Blue Dye (10 kg)
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
  (1, 'PRO0235',            4.00e13,  63.38,   400,  'fixed',     0),
  (2, 'MM3',                1.08e13,  4.97,    2700, 'fixed',     0),
  (3, 'Zeolite',            0,        1.50,    500,  'fixed',     0),
  (4, 'Sodium Bicarbonate', 0,        1.20,    6390, 'remainder', 0),
  (5, 'BlueDye',            0,        120.00,  40,   'fixed',     0)
) AS v(sort_order, ingredient_name, target_total_cfu, cost_per_kg_gbp, default_grams, filler_mode, filler_ratio)
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;

-- Product 3 - RBC -PRO-Super FOG-DRY 10grams (4.68 kg)
INSERT INTO recipe_lines (recipe_id, ingredient_id, sort_order, target_total_cfu, default_grams, filler_mode, filler_ratio, cost_per_kg_gbp)
SELECT
  (SELECT id FROM recipes WHERE name='RBC -PRO-Super FOG-DRY 10grams'),
  i.id,
  v.sort_order,
  v.target_total_cfu,
  v.default_grams,
  v.filler_mode,
  v.filler_ratio,
  v.cost_per_kg_gbp
FROM (VALUES
  (1, 'WW100',                      1.872e14, 62.50,   1872,    'fixed', 0),
  (2, 'Bacillus Polymyxa',          0,        316.67,  0,       'fixed', 0),
  (3, 'Pseudomonas Putida',         4.68e12,  1766.67, 9.36,    'fixed', 0),
  (4, 'Arthrobacter Globiformis',   9.36e11,  316.67,  9.36,    'fixed', 0),
  (5, 'Trichoderma Harzianum 20E9', 4.68e12,  58.33,   468,     'fixed', 0),
  (6, 'Trichoderma Reesi 20E9',     4.68e12,  58.33,   468,     'fixed', 0),
  (7, 'Zeolit 100 Micron',          0,        1.74,    234,     'fixed', 0),
  (8, 'Sugar Multidextrose',        2.7144e10, 1.56,   271.44,  'fixed', 0),
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
  (1, 'PRO0234', 2.50e13, 44.00, 500,   'fixed', 0),
  (2, 'MM3',     3.60e13, 6.62,  12000, 'fixed', 0),
  (3, 'Soda',    0,       2.00,  37500, 'remainder', 0)
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
  (1, 'PRO0234',     1.00e13, 38.00, 200,  'fixed',     0),
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
  (1, 'PRO0235',                  4.00e13, 71.00, 400,  'fixed',     0),
  (2, 'MM3',                      1.80e13, 5.88,  6000, 'fixed',     0),
  (3, 'Zeolite10% and 26% Soda',  0,       2.00,  3600, 'remainder', 0)
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
  (1, 'PRO0234',     5.00e13, 39.00, 1000, 'fixed',     0),
  (2, 'Zeolite Soda', 0,      2.00,  9000, 'remainder', 0)
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
  (1, 'PRO0234',     5.00e13, 37.00, 1000, 'fixed',     0),
  (2, 'Zeolite Soda', 0,      2.00,  9000, 'remainder', 0)
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
  (1, 'PRO0235',             2.50e14,  80.00,  2500,  'fixed',     0),
  (2, 'Bacillus Polymyxa',   1.00e13,  320.00, 100,   'fixed',     0),
  (3, 'Pseudomonas Putida',  5.00e12,  1700.00, 10,   'fixed',     0),
  (4, 'Arthrobacter Globiformis', 1.00e13, 1600.00, 10, 'fixed',   0),
  (5, 'Sodium BiCarbonate',  4.42e12,  2.00,   44200, 'fixed',     0),
  (6, 'Zeolite',             0,        1.15,   3180,  'remainder', 0)
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
  (1, 'PRO0235',                    5.00e13,  71.00,   500,  'fixed',     0),
  (2, 'Paenibacillus Polymyxa 100B', 1.00e12, 313.50,  10,  'fixed',     0),
  (3, 'Pseudomonas Putida',        2.00e12,  1667.67,  4,  'fixed',     0),
  (4, 'Arthrobacter Globiformis',  4.00e12,  1563.50,  4,  'fixed',     0),
  (5, 'Trichoderma Harzianum 10E9', 5.00e12,  58.00,   500, 'fixed',     0),
  (6, 'Trichoderma Reesi 10E9',     5.00e12,  58.00,   500, 'fixed',     0),
  (7, 'Soda / or MultiDextrose',    0,       1.20,    7902, 'remainder', 0),
  (8, 'Zeolite',                   0,       1.15,    580,  'fixed',     0)
) AS v(sort_order, ingredient_name, target_total_cfu, cost_per_kg_gbp, default_grams, filler_mode, filler_ratio)
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT (recipe_id, ingredient_id) DO NOTHING;

-- Stock options (selectable lots) per ingredient.
-- Each bacteria ingredient can have multiple stock options with different CFU/g and optional price.
-- These are global per ingredient, shared across all recipes that use that ingredient.
INSERT INTO ingredient_cfu_options (ingredient_id, label, cfu_per_gram, is_default, price_gbp)
SELECT i.id, v.label, v.cfu_per_gram, v.is_default, v.price_gbp
FROM (VALUES
  ('Paenibacillus Polymyxa 100B',      'Default',     1.00e11, TRUE,  NULL::numeric),
  ('Paenibacillus Polymyxa 100B',      'RBC400 313.50', 1.00e11, FALSE, 313.50),
  ('Pseudomonas Putida 500 billion cfu','Default',    1.00e08, TRUE,  1550.00),
  ('PRO0235',                           'Default',    1.00e11, TRUE,  71.00),
  ('PRO0235',                           'Option B',   1.00e11, FALSE, 63.38),
  ('PRO0235',                           'RBC 300 80', 1.00e11, FALSE, 80.00),
  ('Trichoderma Reesi 2E10',            'Default',    2.00e10, TRUE,  NULL::numeric),
  ('Trichoderma Haziarnim 2E10',        'Default',    2.00e10, TRUE,  NULL::numeric),
  ('Filler FUN TRICH HARZIANUM FUN 003','Default',    1.00e09, TRUE,  NULL::numeric),
  ('MM3',                               '4E9',        4.00e09, TRUE,  4.97),
  ('MM3',                               '3E9',        3.00e09, FALSE, 6.62),
  ('MM3',                               '3E9 @ 5.88', 3.00e09, FALSE, 5.88),
  ('WW100',                             'Default',    1.00e11, TRUE,  NULL::numeric),
  ('WW100',                             '62.50',      1.00e11, FALSE, 62.50),
  ('Bacillus Polymyxa',                 'Default',    1.00e11, TRUE,  NULL::numeric),
  ('Bacillus Polymyxa',                 '316.67',     1.00e11, FALSE, 316.67),
  ('Bacillus Polymyxa',                 'RBC 300 320',1.00e11, FALSE, 320.00),
  ('Pseudomonas Putida',                'Default',    5.00e11, TRUE,  NULL::numeric),
  ('Pseudomonas Putida',                '1766.67',    5.00e11, FALSE, 1766.67),
  ('Pseudomonas Putida',                '500B 1700',  5.00e11, FALSE, 1700.00),
  ('Pseudomonas Putida',                '500B 1667.67', 5.00e11, FALSE, 1667.67),
  ('Arthrobacter Globiformis',          'Default',    1.00e11, TRUE,  NULL::numeric),
  ('Arthrobacter Globiformis',          '316.67',     1.00e11, FALSE, 316.67),
  ('Arthrobacter Globiformis',          '1000B 1600', 1.00e12, FALSE, 1600.00),
  ('Arthrobacter Globiformis',          '1000B 1563.50', 1.00e12, FALSE, 1563.50),
  ('Trichoderma Harzianum 20E9',        'Default',    1.00e10, TRUE,  NULL::numeric),
  ('Trichoderma Harzianum 20E9',        '58.33',      1.00e10, FALSE, 58.33),
  ('Trichoderma Reesi 20E9',            'Default',    1.00e10, TRUE,  NULL::numeric),
  ('Trichoderma Reesi 20E9',            '58.33',      1.00e10, FALSE, 58.33),
  ('Trichoderma Harzianum 10E9',        'Default',    1.00e10, TRUE,  58.00),
  ('Trichoderma Reesi 10E9',            'Default',    1.00e10, TRUE,  58.00),
  ('Sugar Multidextrose',               'Default',    1.00e08, TRUE,  NULL::numeric),
  ('Sugar',                             'Default',    1.00e08, TRUE,  NULL::numeric),
  ('Sugar',                             '1.56',       1.00e08, FALSE, 1.56),
  ('PRO0234',                           'Default',    5.00e10, TRUE,  44.00),
  ('PRO0234',                           'Alt 38',     5.00e10, FALSE, 38.00),
  ('PRO0234',                           'Alt 39',     5.00e10, FALSE, 39.00),
  ('PRO0234',                           'Alt 37',     5.00e10, FALSE, 37.00),
  ('Sodium BiCarbonate',                'RBC 300 2.00',1.00e08, TRUE, 2.00)
) AS v(ingredient_name, label, cfu_per_gram, is_default, price_gbp)
JOIN ingredients i ON i.name = v.ingredient_name
ON CONFLICT (ingredient_id, label) DO NOTHING;

-- Set recipe-line default stock option for RBC-GT-WW10-10E9 BogBuster 100 grams (match by ingredient + cost and CFU/g).
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

COMMIT;
