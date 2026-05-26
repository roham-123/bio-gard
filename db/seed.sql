-- seed.sql
-- Master data + recipes pulled from production (Neon) snapshot.
-- Finished products section below is preserved from the previous seed
-- (production has not changed for those tables).

TRUNCATE TABLE recipe_lines RESTART IDENTITY CASCADE;
TRUNCATE TABLE recipe_packaging_lines RESTART IDENTITY CASCADE;
TRUNCATE TABLE finished_product_packaging_lines RESTART IDENTITY CASCADE;
TRUNCATE TABLE finished_products RESTART IDENTITY CASCADE;
TRUNCATE TABLE recipes RESTART IDENTITY CASCADE;
TRUNCATE TABLE packaging_items CASCADE;
TRUNCATE TABLE ingredients CASCADE;

-- Ingredients (current master list, from production)
INSERT INTO ingredients (id, name, stock_cfu_per_g, cost_per_kg_gbp) VALUES
  ('B-300',     'Bran 300 micron',                                       0,      0.80),
  ('BAC-023',   'Mixed Bacteria Blend 500B',                             5.00E+11, 335.33),
  ('BAC-029',   'Arthrobacter Globiformis 100B',                         1.00E+11, 314.08),
  ('BAC-031',   'Bacillus subtilis 700B or ProRata',                     7.00E+11, 398.67),
  ('BAC-041',   'Paenibacillus Polymyxa 100B',                           1.00E+11, 314.08),
  ('BASC',      'Bacillus Spore Blend',                                  0,      10.00),
  ('BTI',       'BTI Bacillus Thurigensis 2e10',                         2.00E+10, 35.33),
  ('DYE',       'BlueDye',                                               0,      120.00),
  ('FUN002',    'Trichoderma Reeesei 1E10',                              1.00E+10, 57.11),
  ('FUN003',    'Trichoderma Harzianum 1E10',                            1.00E+10, 57.11),
  ('Fulvic-80', 'Fulvic Acid Powder 80% China',                          0,      4.50),
  ('MB-100',    'MultiDextrose',                                         0,      1.30),
  ('MM3',       'Blend Wastewater MuckMuncher',                          3.00E+09, 5.88),
  ('MYCO',      'Mycorhiza',                                             6300,   21.75),
  ('MYSP',      'MycoSpora 25X-WSP endomycorrhiza',                      5750,   100.00),
  ('OXY',       'OxyPowder Sodium Percarbonate (coated) (25Kg) bag',     0,      1.75),
  ('PBM-001',   'Arthrobacter Globiformis 1000B',                        1.00E+12, 1562.00),
  ('PBM-009',   'Pseudomonas Putida 500 billion cfu',                    5.00E+11, 1668.67),
  ('PRO-0234',  'Mixed Culture MSB 50B',                                 5.00E+10, 36.33),
  ('PRO-0235',  'Mixed Culture MSB 100B',                                1.00E+11, 70.67),
  ('PRO-1050',  'Trichoderma Harzianum 3E10 (30B)',                      3.00E+10, 167.33),
  ('PRO-1055',  'Trichoderma Haziarnim 20B',                             2.00E+10, 100.00),
  ('PRO-1056',  'Trichoderma Reesei 2E10 (20B)',                         2.00E+10, 112.22),
  ('PRO-1060',  'Trichoderma Viride 2E10 (20B)',                         2.00E+10, 112.22),
  ('PRO-3011',  'PureAqua 5e9',                                          5.00E+09, 10.40),
  ('PRO-6017',  'JanF110 Blend liquid FOG 1e10',                         1.00E+10, 14.48),
  ('SB-100',    'Sodium Bicarbonate',                                    0,      1.20),
  ('SEA',       'Seaweed',                                               0,      10.00),
  ('SW-90',     'Seaweed Powder Extract',                                0,      2.86),
  ('WW100',     'Waste Remediation Concentrate 100B',                    1.00E+11, 62.08),
  ('YST',       'Yeast extract',                                         0,      5.00),
  ('Z100',      'Zeolite 100 micron',                                    0,      1.80);

-- Packaging items (current master list, from production)
INSERT INTO packaging_items (code, name, default_cost_gbp, default_cost_basis) VALUES
  ('CART-6TUB',         '0427 150 x 100 x 100mm 150w/t/b Box for 6 Tubes',                 0.12,  'per_unit'),
  ('CART-8X6 /48TUB',   'O201 125k/t/dw Outer to fit 8 of box size 150 x 100 x 100mm',     0.03,  'per_unit'),
  ('FILL',              'Manual filling cost',                                              0.42,  'per_unit'),
  ('PAIL',              '10kg Pail',                                                       11.00,  'per_unit'),
  ('PAILLAB',           'Pail Label',                                                       1.50,  'per_unit'),
  ('PAKO',              'Pakonap service fee',                                              0.20,  'per_kg'),
  ('PC-SACH75G',        '75g Sachets',                                                      0.20,  'per_unit'),
  ('PIL-20TABS',        'Screwtop PET Pill pot',                                            0.83,  'per_unit'),
  ('PIL-WRAP',          'Label Printer wrap',                                               0.24,  'per_unit'),
  ('SACH100G',          '100g / 250g Sachets',                                              0.10,  'per_unit'),
  ('SACH25G',           '25g Sachets',                                                      0.50,  'per_unit'),
  ('SACH250G',          '250g Sachets',                                                     0.20,  'per_unit'),
  ('SACH50G',           '50g Sachets',                                                      0.50,  'per_unit'),
  ('STP-BOXLAB',        'Box Label',                                                        0.25,  'per_unit'),
  ('STP-LBOX',          'Large Box',                                                        2.40,  'per_unit'),
  ('STP-LEAF',          'Leaflet',                                                          0.30,  'per_unit'),
  ('STP-ZIP25',         'Zip Innerbag STP 4x25',                                            0.30,  'per_unit'),
  ('STP-ZIPBAG25',      'ZipBag (4x25)',                                                    0.30,  'per_unit'),
  ('STP-ZIPLAB',        'ZipBag Label',                                                     0.088, 'per_unit'),
  ('TT-ALUP1000',       'Aluminium Pouch 1kg',                                              0.10,  'per_unit'),
  ('TT-ALUPB1000',      'Alu Pouch Label',                                                  0.10,  'per_unit'),
  ('TT-INBOX',          'Inner Box Tour Turf Clay Coated tie cut 2x1kg',                    0.57,  'per_unit'),
  ('TT-INBOXLAB',       'Inner Box Label FTD Tour Turf',                                    0.155, 'per_unit'),
  ('TT-OUTBOX',         'Outer Box Tour Turf 8 x sets (units of 2x1)',                      4.08,  'per_unit'),
  ('XRO-L7166/6/A4',    'Label 6x20 (one sheet 6 Label) 1 label for 6 tubs',                0.08,  'per_unit'),
  ('XRO-L7168/2/A4',    'Label 48x20 (one sheet 2 Label ) 1 Label for 48 outerbox',         0.03,  'per_unit');

-- Recipes (explicit ids matching production so recipe_lines / recipe_packaging_lines line up)
INSERT INTO recipes (id, name, default_batch_grams, default_kg_per_set) VALUES
  (1,  'FTD Cellex TourTurf Thatch',                 600000, 2),
  (2,  'Pond Clear Pure Aqua 50 grams You Garden',   100000, 50),
  (3,  'PondClear (GreenEdge)',                       50000, 0.15),
  (4,  'STP Marine MM3',                             100000, 10),
  (5,  'AquaBoost',                                   50000, 50),
  (6,  'AquaBalance Super (seaweed)',                 50000, 1),
  (7,  'BioGro+',                                      1000, 1),
  (8,  'RBC 100',                                     50000, 1),
  (9,  'RBC 200',                                     50000, 1),
  (10, 'BogBuster',                                   50000, 1),
  (11, 'RBC 300',                                     50000, 1),
  (12, 'RBC 400',                                     50000, 1),
  (13, 'RBC 500',                                     50000, 1),
  (14, 'RootPrime+',                                   1000, 0.25),
  (15, 'PlantPrime+',                                  1000, 0.1),
  (16, 'PlantGro+',                                    1000, 0.15);

-- Recipe lines (explicit ids matching production)
INSERT INTO recipe_lines (
  id, recipe_id, ingredient_id, sort_order,
  target_total_cfu, default_grams, filler_mode, filler_ratio
) VALUES
  -- Recipe 1: FTD Cellex TourTurf Thatch
  (1,  1, 'PRO-0235',  2, 1.77e15, 17700,   'fixed',     0),
  (2,  1, 'PRO-1055',  4, 7.20e12, 360,     'fixed',     0),
  (3,  1, 'PRO-1056',  3, 7.20e12, 360,     'fixed',     0),
  (4,  1, 'PBM-009',   1, 6.00e13, 120,     'fixed',     0),
  (5,  1, 'SB-100',    6, 0,       0,       'ratio',     243900),
  (6,  1, 'MB-100',    5, 0,       0,       'ratio',     334800),
  (7,  1, 'Fulvic-80', 7, 0,       0,       'ratio',     2760),
  -- Recipe 2: Pond Clear Pure Aqua 50 grams You Garden
  (8,  2, 'MM3',       2, 9.00e12, 3000,    'fixed',     0),
  (9,  2, 'PRO-0235',  1, 3.00e14, 3000,    'fixed',     0),
  (10, 2, 'Z100',      3, 0,       0,       'ratio',     0.21),
  (11, 2, 'SB-100',    4, 0,       0,       'ratio',     0.79),
  -- Recipe 3: PondClear (GreenEdge)
  (12, 3, 'MM3',       1, 8.00e13, 26666.666666666667, 'fixed', 0),
  (13, 3, 'PBM-009',   2, 5.00e13, 100,     'fixed',     0),
  (14, 3, 'Z100',      4, 0,       0,       'ratio',     0.234),
  (15, 3, 'SB-100',    5, 0,       0,       'ratio',     0.432),
  (16, 3, 'OXY',       3, 0,       0,       'ratio',     0.334),
  -- Recipe 4: STP Marine MM3
  (17, 4, 'MM3',       1, 3.00e14, 100000,  'fixed',     0),
  -- Recipe 5: AquaBoost
  (18, 5, 'MM3',       1, 3.75e13, 12500,   'fixed',     0),
  (19, 5, 'PBM-009',   2, 1.50e13, 30,      'fixed',     0),
  (20, 5, 'OXY',       3, 0,       0,       'ratio',     1),
  (21, 5, 'Z100',      4, 0,       0,       'ratio',     1),
  (22, 5, 'SB-100',    5, 0,       0,       'ratio',     72.94),
  -- Recipe 8: RBC 100
  (39, 8, 'PRO-0234',  1, 2.50e13, 500,     'fixed',     0),
  (40, 8, 'MM3',       2, 3.60e13, 12000,   'fixed',     0),
  (41, 8, 'SB-100',    3, 0,       0,       'remainder', 0),
  -- Recipe 9: RBC 200
  (42, 9, 'PRO-0235',  1, 2.00e14, 2000,    'fixed',     0),
  (43, 9, 'MM3',       2, 4.05e13, 13500,   'fixed',     0),
  (44, 9, 'Z100',      3, 0,       0,       'ratio',     5),
  (45, 9, 'SB-100',    4, 0,       0,       'ratio',     63.9),
  (46, 9, 'DYE',       5, 0,       0,       'ratio',     0.1),
  -- Recipe 10: BogBuster
  (47, 10, 'WW100',    1, 5.00e14, 5000,    'fixed',     0),
  (48, 10, 'PBM-009',  2, 5.00e13, 100,     'fixed',     0),
  (49, 10, 'BAC-029',  3, 2.50e13, 250,     'fixed',     0),
  (50, 10, 'PRO-1055', 4, 2.00e13, 1000,    'fixed',     0),
  (51, 10, 'PRO-1056', 5, 2.00e13, 1000,    'fixed',     0),
  (52, 10, 'Z100',     6, 0,       0,       'ratio',     5),
  (53, 10, 'MB-100',   7, 0,       0,       'ratio',     2),
  (54, 10, 'SB-100',   8, 0,       0,       'ratio',     78.3),
  -- Recipe 11: RBC 300
  (55, 11, 'PRO-0235', 1, 2.50e14, 2500,    'fixed',     0),
  (56, 11, 'BAC-041',  2, 1.00e13, 100,     'fixed',     0),
  (57, 11, 'PBM-009',  3, 5.00e12, 10,      'fixed',     0),
  (58, 11, 'PBM-001',  4, 1.00e13, 10,      'fixed',     0),
  (59, 11, 'SB-100',   5, 0,       0,       'ratio',     88.4),
  (60, 11, 'Z100',     6, 0,       0,       'ratio',     6.36),
  -- Recipe 12: RBC 400
  (61, 12, 'PRO-0235', 1, 2.50e14, 2500,    'fixed',     0),
  (62, 12, 'BAC-041',  2, 5.00e12, 50,      'fixed',     0),
  (63, 12, 'PBM-009',  3, 1.00e13, 20,      'fixed',     0),
  (64, 12, 'PBM-001',  4, 2.00e13, 20,      'fixed',     0),
  (65, 12, 'FUN003',   5, 2.50e13, 2500,    'fixed',     0),
  (66, 12, 'FUN002',   6, 2.50e13, 2500,    'fixed',     0),
  (67, 12, 'SB-100',   7, 0,       0,       'ratio',     79.02),
  (68, 12, 'Z100',     8, 0,       0,       'ratio',     5.8),
  -- Recipe 13: RBC 500
  (69, 13, 'PRO-0235', 1, 6.00e14, 6000,    'fixed',     0),
  (70, 13, 'FUN003',   2, 1.50e13, 1500,    'fixed',     0),
  (71, 13, 'FUN002',   3, 1.50e13, 1500,    'fixed',     0),
  (72, 13, 'PBM-009',  4, 2.50e13, 50,      'fixed',     0),
  (73, 13, 'PBM-001',  5, 5.00e13, 50,      'fixed',     0),
  (74, 13, 'WW100',    6, 5.90e14, 5900,    'fixed',     0),
  (75, 13, 'Z100',     7, 0,       0,       'ratio',     10),
  (76, 13, 'SB-100',   8, 0,       0,       'ratio',     60),
  -- Recipe 6: AquaBalance Super (seaweed)
  (77, 6, 'MM3',       1, 2.25e13, 7500,    'fixed',     0),
  (78, 6, 'OXY',       2, 0,       0,       'ratio',     0.25),
  (79, 6, 'Z100',      3, 0,       0,       'ratio',     1),
  (80, 6, 'SB-100',    4, 0,       0,       'ratio',     83.25),
  (81, 6, 'SW-90',     5, 0,       0,       'ratio',     0.5),
  -- Recipe 14: RootPrime+
  (82, 14, 'FUN003',   1, 4.00e11, 40,      'fixed',     0),
  (83, 14, 'FUN002',   2, 4.00e11, 40,      'fixed',     0),
  (84, 14, 'PRO-0235', 3, 2.00e12, 20,      'fixed',     0),
  (85, 14, 'MYSP',     4, 2.30e6,  400,     'fixed',     0),
  (86, 14, 'SW-90',    5, 0,       0,       'ratio',     5),
  (87, 14, 'MB-100',   6, 0,       0,       'ratio',     45),
  -- Recipe 7: BioGro+
  (88, 7, 'WW100',     1, 5.00e12, 50,      'fixed',     0),
  (89, 7, 'PRO-0235',  2, 5.00e12, 50,      'fixed',     0),
  (90, 7, 'FUN003',    3, 2.00e11, 20,      'fixed',     0),
  (91, 7, 'FUN002',    4, 2.00e11, 20,      'fixed',     0),
  (92, 7, 'BAC-041',   5, 2.00e11, 2,       'fixed',     0),
  (93, 7, 'BAC-029',   6, 5.00e10, 0.5,     'fixed',     0),
  (94, 7, 'Fulvic-80', 7, 0,       0,       'ratio',     5),
  (95, 7, 'Z100',      8, 0,       0,       'ratio',     8),
  (96, 7, 'SB-100',    9, 0,       0,       'ratio',     10),
  (97, 7, 'YST',      10, 0,       0,       'ratio',     12.95),
  (98, 7, 'MB-100',   11, 0,       0,       'ratio',     47.75),
  -- Recipe 15: PlantPrime+
  (107, 15, 'MYCO',      1, 945000,  150,   'fixed',     0),
  (108, 15, 'FUN003',    2, 4.00e11, 40,    'fixed',     0),
  (109, 15, 'FUN002',    3, 4.00e11, 40,    'fixed',     0),
  (110, 15, 'BAC-023',   4, 2.00e13, 40,    'fixed',     0),
  (111, 15, 'Fulvic-80', 5, 0,       0,     'ratio',     5),
  (112, 15, 'SW-90',     6, 0,       0,     'ratio',     5),
  (113, 15, 'YST',       7, 0,       0,     'ratio',     10),
  (114, 15, 'MB-100',    8, 0,       0,     'ratio',     53),
  -- Recipe 16: PlantGro+
  (120, 16, 'BAC-023',   1, 3.00e13, 60,    'fixed',     0),
  (121, 16, 'SW-90',     2, 0,       0,     'ratio',     15),
  (122, 16, 'YST',       3, 0,       0,     'ratio',     18),
  (123, 16, 'Fulvic-80', 4, 0,       0,     'ratio',     5),
  (124, 16, 'MB-100',    5, 0,       0,     'ratio',     56);

-- Recipe packaging lines (explicit ids matching production)
INSERT INTO recipe_packaging_lines (
  id, recipe_id, packaging_item_code, sort_order,
  usage_basis, cost_gbp, quantity_multiplier, units_per_pack, quantity_source
) VALUES
  -- Recipe 1: FTD Cellex TourTurf Thatch
  (1,  1, 'PAKO',         1, 'per_kg',   0.20,  1, NULL, 'kg'),
  (2,  1, 'TT-INBOX',     2, 'per_set',  0.57,  1, NULL, 'sets'),
  (3,  1, 'TT-INBOXLAB',  3, 'per_set',  0.155, 2, NULL, 'sets'),
  (4,  1, 'TT-ALUP1000',  4, 'per_kg',   0.10,  1, NULL, 'kg'),
  (5,  1, 'TT-ALUPB1000', 5, 'per_kg',   0.10,  1, NULL, 'kg'),
  (6,  1, 'TT-OUTBOX',    6, 'per_unit', 4.08,  1, 8,    'sets'),
  -- Recipe 4: STP Marine MM3
  (15, 4, 'PAKO',         1, 'per_kg',   0.20,  1, NULL, 'kg'),
  (16, 4, 'STP-ZIPBAG25', 2, 'per_unit', 0.30,  1, 4,    'sets'),
  (17, 4, 'STP-ZIPLAB',   3, 'per_unit', 0.22,  1, 4,    'sets'),
  (18, 4, 'STP-LBOX',     4, 'per_unit', 2.40,  1, NULL, 'sets'),
  (19, 4, 'STP-BOXLAB',   5, 'per_unit', 0.25,  1, NULL, 'sets'),
  (20, 4, 'STP-LEAF',     6, 'per_unit', 0.30,  1, NULL, 'sets'),
  -- Recipe 7: BioGro+
  (30, 7, 'SACH250G',     1, 'per_unit', 0.20,  1, 4,    'sets'),
  -- Recipe 10: BogBuster
  (51, 10, 'PAKO',        1, 'per_kg',   0.20,  1, NULL, 'kg'),
  (52, 10, 'SACH100G',    2, 'per_unit', 0.10,  1, NULL, 'sets'),
  (53, 10, 'PAIL',        3, 'per_set',  2.20,  1, NULL, 'sets'),
  (54, 10, 'PAILLAB',     4, 'per_unit', 0.40,  1, NULL, 'sets'),
  -- Recipe 9: RBC 200
  (55, 9, 'PAKO',         1, 'per_kg',   0.20,  1, NULL, 'kg'),
  (56, 9, 'SACH100G',     2, 'per_kg',   0.10,  1, NULL, 'kg'),
  (57, 9, 'PAIL',         3, 'per_unit', 2.20,  1, NULL, 'sets'),
  (58, 9, 'PAILLAB',      4, 'per_unit', 0.40,  1, NULL, 'sets'),
  -- Recipe 8: RBC 100
  (59, 8, 'PAKO',         1, 'per_kg',   0.20,  1, NULL, 'kg'),
  (60, 8, 'SACH100G',     2, 'per_unit', 0.10,  1, NULL, 'sets'),
  (61, 8, 'PAIL',         3, 'per_unit', 2.20,  1, NULL, 'sets'),
  (62, 8, 'PAILLAB',      4, 'per_unit', 0.40,  1, NULL, 'sets'),
  -- Recipe 6: AquaBalance Super (seaweed)
  (63, 6, 'PAKO',         1, 'per_kg',   0.20,  1, NULL, 'kg'),
  (64, 6, 'SACH100G',     2, 'per_kg',   0.10,  1, 10,   'kg'),
  (65, 6, 'PAIL',         3, 'per_unit', 2.20,  1, NULL, 'sets'),
  (66, 6, 'PAILLAB',      4, 'per_unit', 0.40,  1, NULL, 'sets'),
  -- Recipe 5: AquaBoost
  (70, 5, 'PAKO',         1, 'per_kg',   0.20,  1, NULL, 'kg'),
  (71, 5, 'SACH100G',     2, 'per_kg',   0.10,  1, NULL, 'kg'),
  (72, 5, 'PAIL',         3, 'per_unit', 2.20,  1, NULL, 'sets'),
  (73, 5, 'PAILLAB',      4, 'per_unit', 0.40,  1, NULL, 'sets'),
  -- Recipe 2: Pond Clear Pure Aqua 50 grams You Garden
  (74, 2, 'PAKO',         1, 'per_kg',   0.20,  1, NULL, 'kg'),
  (75, 2, 'PAIL',         2, 'per_unit', 11.00, 1, 10,   'sets'),
  (76, 2, 'PAILLAB',      3, 'per_unit', 0.40,  1, 10,   'sets'),
  (77, 2, 'SACH100G',     4, 'per_unit', 0.10,  1, NULL, 'sets'),
  -- Recipe 3: PondClear (GreenEdge)
  (78, 3, 'PAKO',         1, 'per_kg',   0.20,  1, NULL, 'kg'),
  (79, 3, 'PC-SACH75G',   2, 'per_set',  0.20,  2, NULL, 'sets'),
  (80, 3, 'PAIL',         3, 'per_unit', 11.00, 1, 10,   'sets'),
  (81, 3, 'PAILLAB',      4, 'per_unit', 0.40,  1, 10,   'sets'),
  -- Recipe 11: RBC 300
  (82, 11, 'PAKO',        1, 'per_kg',   0.20,  1, NULL, 'kg'),
  (83, 11, 'SACH100G',    2, 'per_unit', 0.10,  1, NULL, 'sets'),
  (84, 11, 'PAIL',        3, 'per_unit', 2.20,  1, NULL, 'sets'),
  (85, 11, 'PAILLAB',     4, 'per_unit', 0.40,  1, NULL, 'sets'),
  -- Recipe 12: RBC 400
  (89, 12, 'PAKO',        1, 'per_kg',   0.20,  1, NULL, 'kg'),
  (90, 12, 'PAIL',        2, 'per_unit', 2.20,  1, NULL, 'sets'),
  (91, 12, 'PAILLAB',     3, 'per_unit', 0.40,  1, NULL, 'sets'),
  (92, 12, 'SACH100G',    4, 'per_unit', 0.10,  1, NULL, 'sets'),
  -- Recipe 13: RBC 500
  (93, 13, 'PAKO',        1, 'per_kg',   0.20,  1, NULL, 'kg'),
  (94, 13, 'SACH100G',    2, 'per_unit', 0.10,  1, NULL, 'sets'),
  (95, 13, 'PAIL',        3, 'per_unit', 2.20,  1, NULL, 'sets'),
  (96, 13, 'PAILLAB',     4, 'per_unit', 0.40,  1, NULL, 'sets'),
  -- Recipe 14: RootPrime+
  (97, 14, 'PAKO',        1, 'per_kg',   0.20,  1, NULL, 'kg'),
  (98, 14, 'SACH250G',    2, 'per_unit', 0.30,  1, NULL, 'sets'),
  -- Recipe 15: PlantPrime+
  (99,  15, 'PAKO',       1, 'per_kg',   0.20,  1, NULL, 'kg'),
  (100, 15, 'SACH50G',    2, 'per_unit', 0.50,  1, 2,    'sets'),
  -- Recipe 16: PlantGro+
  (101, 16, 'PAKO',       1, 'per_kg',   0.20,  1, NULL, 'kg'),
  (102, 16, 'SACH25G',    2, 'per_unit', 0.50,  1, 6,    'sets');

-- Resync sequences so future autoincrement inserts don't collide with the explicit ids above.
SELECT setval('recipes_id_seq',                 (SELECT COALESCE(MAX(id), 0) FROM recipes));
SELECT setval('recipe_lines_id_seq',            (SELECT COALESCE(MAX(id), 0) FROM recipe_lines));
SELECT setval('recipe_packaging_lines_id_seq',  (SELECT COALESCE(MAX(id), 0) FROM recipe_packaging_lines));

-- Finished products (unchanged from previous seed — production has not changed for these tables)
INSERT INTO finished_products (
  name,
  sku,
  default_units_per_pack,
  base_unit_cost_gbp,
  notes
)
VALUES (
  'Gaia Tabs 20 units 71g',
  'GAO014',
  20,
  1.34,
  NULL
);

WITH product_ref AS (
  SELECT id AS finished_product_id
  FROM finished_products
  WHERE sku = 'GAO014'
)
INSERT INTO finished_product_packaging_lines (
  finished_product_id,
  packaging_item_code,
  sort_order,
  usage_basis,
  cost_gbp,
  quantity_multiplier,
  units_per_pack
)
SELECT
  product_ref.finished_product_id,
  v.packaging_item_code,
  v.sort_order,
  v.usage_basis,
  v.cost_gbp,
  v.quantity_multiplier,
  v.units_per_pack
FROM product_ref
JOIN (
  VALUES
    ('PIL-20TABS'::text,      1, 'per_pack'::text, 0.83::numeric, 1::numeric, NULL::numeric),
    ('CART-6TUB'::text,       2, 'per_pack'::text, 0.12::numeric, 1::numeric, NULL::numeric),
    ('CART-8X6 /48TUB'::text, 3, 'per_pack'::text, 0.03::numeric, 1::numeric, NULL::numeric),
    ('XRO-L7166/6/A4'::text,  4, 'per_pack'::text, 0.08::numeric, 1::numeric, NULL::numeric),
    ('XRO-L7168/2/A4'::text,  5, 'per_pack'::text, 0.03::numeric, 1::numeric, NULL::numeric),
    ('PIL-WRAP'::text,        6, 'per_pack'::text, 0.24::numeric, 1::numeric, NULL::numeric),
    ('FILL'::text,            7, 'per_pack'::text, 0.42::numeric, 1::numeric, NULL::numeric)
) AS v(packaging_item_code, sort_order, usage_basis, cost_gbp, quantity_multiplier, units_per_pack)
  ON TRUE;
