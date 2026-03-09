-- schema.sql
-- lean schema for a calculator prototype

CREATE TABLE IF NOT EXISTS recipes (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  default_batch_grams NUMERIC NOT NULL CHECK (default_batch_grams > 0)
);

CREATE TABLE IF NOT EXISTS ingredients (
  id            SERIAL PRIMARY KEY,
  code          TEXT,           -- optional, like PRO0235
  name          TEXT NOT NULL,
  is_bacteria   BOOLEAN NOT NULL DEFAULT FALSE,
  cost_per_kg_gbp NUMERIC NOT NULL DEFAULT 0
);

-- inventory CFU options per ingredient (user can add more later)
-- in prototype, we seed the \"Default\" option with the sheet's col D value
CREATE TABLE IF NOT EXISTS ingredient_cfu_options (
  id              SERIAL PRIMARY KEY,
  ingredient_id   INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  cfu_per_gram    NUMERIC NOT NULL DEFAULT 0,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  price_gbp       NUMERIC NULL,   -- price for this batch/option
  UNIQUE (ingredient_id, label)
);

-- per recipe line (row)
-- target_total_cfu is constant for bacteria rows. for fillers, set 0.
-- filler_mode:
--   'fixed' = grams scale with batch (or remain fixed; for prototype we keep as fixed grams for default)
--   'ratio' = takes a share of remaining grams (by filler_ratio)
--   'remainder' = takes ALL remaining grams after bacteria and fixed fillers
CREATE TABLE IF NOT EXISTS recipe_lines (
  id                SERIAL PRIMARY KEY,
  recipe_id         INT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id     INT NOT NULL REFERENCES ingredients(id),
  sort_order        INT NOT NULL,

  target_total_cfu  NUMERIC NOT NULL DEFAULT 0,   -- bacteria target
  default_grams     NUMERIC NOT NULL DEFAULT 0,   -- sheet grams at default batch

  filler_mode       TEXT NOT NULL DEFAULT 'fixed' CHECK (filler_mode IN ('fixed','ratio','remainder')),
  filler_ratio      NUMERIC NOT NULL DEFAULT 0,   -- only used when filler_mode='ratio'
  cost_per_kg_gbp   NUMERIC NULL,                  -- override; when null use ingredient cost

  -- Optional per-recipe default CFU stock option.
  -- When set, UI prefers this option over the ingredient-wide default.
  default_cfu_option_id INT NULL REFERENCES ingredient_cfu_options(id) ON DELETE SET NULL,

  UNIQUE (recipe_id, ingredient_id)
);

-- helpful indexes
CREATE INDEX IF NOT EXISTS idx_recipe_lines_recipe ON recipe_lines(recipe_id);
CREATE INDEX IF NOT EXISTS idx_cfu_options_ing ON ingredient_cfu_options(ingredient_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(name);

-- audit log for tracking all mutations (inserts, updates, deletes)
CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  action      TEXT NOT NULL,          -- e.g. 'delete_cfu_option', 'add_cfu_option'
  entity_type TEXT NOT NULL,          -- e.g. 'ingredient_cfu_options', 'recipe_lines'
  entity_id   INT,                    -- PK of affected row (null if not applicable)
  detail      JSONB NOT NULL DEFAULT '{}',  -- before/after snapshots, context
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- add columns for existing DBs (no-op if already present)
ALTER TABLE recipe_lines ADD COLUMN IF NOT EXISTS cost_per_kg_gbp NUMERIC NULL;
ALTER TABLE recipe_lines ADD COLUMN IF NOT EXISTS default_cfu_option_id INT NULL;
ALTER TABLE ingredient_cfu_options ADD COLUMN IF NOT EXISTS price_gbp NUMERIC NULL;
