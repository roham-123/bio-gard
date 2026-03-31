-- schema.sql
-- Simplified schema: 1 ingredient = 1 stock definition (no stock options)

CREATE TABLE IF NOT EXISTS recipes (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  default_batch_grams NUMERIC NOT NULL CHECK (default_batch_grams > 0)
);

CREATE TABLE IF NOT EXISTS ingredients (
  id              TEXT PRIMARY KEY,            -- user-defined code e.g. PRO0235-1E11
  name            TEXT NOT NULL,
  stock_cfu_per_g NUMERIC NOT NULL DEFAULT 0,  -- 0 for fillers, >0 for bacteria
  cost_per_kg_gbp NUMERIC NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recipe_lines (
  id                SERIAL PRIMARY KEY,
  recipe_id         INT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id     TEXT NOT NULL REFERENCES ingredients(id),
  sort_order        INT NOT NULL,

  target_total_cfu  NUMERIC NOT NULL DEFAULT 0,
  default_grams     NUMERIC NOT NULL DEFAULT 0,

  filler_mode       TEXT NOT NULL DEFAULT 'fixed' CHECK (filler_mode IN ('fixed','ratio','remainder')),
  filler_ratio      NUMERIC NOT NULL DEFAULT 0,

  UNIQUE (recipe_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_lines_recipe ON recipe_lines(recipe_id);

-- audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  detail      JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
