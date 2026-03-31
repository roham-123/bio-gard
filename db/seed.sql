-- seed.sql
-- Ingredients seed (current master list)

TRUNCATE TABLE recipe_lines RESTART IDENTITY CASCADE;
TRUNCATE TABLE recipes RESTART IDENTITY CASCADE;
TRUNCATE TABLE ingredients CASCADE;

INSERT INTO ingredients (id, name, stock_cfu_per_g, cost_per_kg_gbp) VALUES
  ('BAC-023', 'Mixed Bacteria Blend 500B', 5.00E+11, 335.33),
  ('BAC-031', 'Bacillus subtilis 700B or ProRata', 7.00E+11, 398.67),
  ('MM3', 'Blend Wastewater MuckMuncher', 3.00E+09, 5.88),
  ('PRO-0235', 'Mixed Culture MSB 100B', 1.00E+11, 70.67),
  ('WW100', 'Waste Remediation Concentrate 100B', 1.00E+11, 62.08),
  ('FUN002', 'Trichoderma Reeesei 1E10', 1.00E+10, 57.11),
  ('FUN003', 'Trichoderma Harzianum 1E10', 1.00E+10, 57.11),
  ('PRO-1050', 'Trichoderma Harzianum 3E10 (30B)', 3.00E+10, 167.33),
  ('PRO-1055', 'Trichoderma Haziarnim 20B', 2.00E+10, 100.00),
  ('PRO-1056', 'Trichoderma Reesei 2E10 (20B)', 2.00E+10, 112.22),
  ('PRO-1060', 'Trichoderma Viride 2E10 (20B)', 2.00E+10, 112.22),
  ('BAC-041', 'Paenibacillus Polymyxa 100B', 1.00E+11, 314.08),
  ('PBM-009', 'Pseudomonas Putida 500 billion cfu', 5.00E+11, 1668.67),
  ('PBM-001', 'Arthrobacter Globiformis 1000B', 1.00E+12, 1562.00),
  ('BAC-029', 'Arthrobacter Globiformis 100B', 1.00E+11, 314.08),
  ('PRO-0234', 'Mixed Culture MSB 50B', 5.00E+10, 36.33),
  ('PRO-6017', 'JanF110 Blend liquid FOG 1e10', 1.00E+10, 14.48),
  ('PRO-3011', 'PureAqua 5e9', 5.00E+09, 10.40),
  ('BTI', 'BTI Bacillus Thurigensis 2e10', 2.00E+10, 35.33),
  ('Z100', 'Zeolite 100 micron', 0, 1.80),
  ('SB-100', 'Sodium Bicarbonate', 0, 1.20),
  ('MB-100', 'MultiDextrose', 0, 1.30),
  ('B-300', 'Bran 300 micron', 0, 0.80),
  ('Fulvic-80', 'Fulvic Acid Powder 80% China', 0, 4.50);

INSERT INTO recipes (name, default_batch_grams, default_kg_per_set)
VALUES ('FTD Cellex TourTurf Thatch', 600000, 2);

WITH recipe_ref AS (
  SELECT id AS recipe_id
  FROM recipes
  WHERE name = 'FTD Cellex TourTurf Thatch'
)
INSERT INTO recipe_lines (
  recipe_id,
  ingredient_id,
  sort_order,
  target_total_cfu,
  default_grams,
  filler_mode,
  filler_ratio
)
SELECT
  recipe_ref.recipe_id,
  v.ingredient_id,
  v.sort_order,
  v.target_total_cfu,
  CASE
    WHEN i.stock_cfu_per_g > 0 THEN v.target_total_cfu / i.stock_cfu_per_g
    ELSE v.default_grams
  END AS default_grams,
  v.filler_mode,
  v.filler_ratio
FROM recipe_ref
JOIN (
  VALUES
    ('PBM-009'::text, 1, 6.00e13::numeric, 0::numeric, 'fixed'::text, 0::numeric),
    ('PRO-0235'::text, 2, 1.77e15::numeric, 0::numeric, 'fixed'::text, 0::numeric),
    ('PRO-1056'::text, 3, 7.20e12::numeric, 0::numeric, 'fixed'::text, 0::numeric),
    ('PRO-1055'::text, 4, 7.20e12::numeric, 0::numeric, 'fixed'::text, 0::numeric),
    ('MB-100'::text, 5, 0::numeric, 0::numeric, 'ratio'::text, 334800::numeric),
    ('SB-100'::text, 6, 0::numeric, 0::numeric, 'ratio'::text, 243900::numeric),
    ('Fulvic-80'::text, 7, 0::numeric, 0::numeric, 'ratio'::text, 2760::numeric)
) AS v(ingredient_id, sort_order, target_total_cfu, default_grams, filler_mode, filler_ratio)
  ON TRUE
JOIN ingredients i ON i.id = v.ingredient_id;
