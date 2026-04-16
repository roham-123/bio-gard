-- schema.sql
-- Simplified schema: 1 ingredient = 1 stock definition (no stock options)

CREATE TABLE IF NOT EXISTS recipes (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  default_batch_grams NUMERIC NOT NULL CHECK (default_batch_grams > 0),
  default_kg_per_set NUMERIC NOT NULL DEFAULT 1 CHECK (default_kg_per_set > 0)
);

CREATE TABLE IF NOT EXISTS packaging_items (
  code                TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  default_cost_gbp    NUMERIC NOT NULL DEFAULT 0 CHECK (default_cost_gbp >= 0),
  default_cost_basis  TEXT NOT NULL DEFAULT 'per_unit' CHECK (default_cost_basis IN ('per_unit','per_kg')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

CREATE TABLE IF NOT EXISTS recipe_packaging_lines (
  id                  SERIAL PRIMARY KEY,
  recipe_id           INT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  packaging_item_code TEXT NOT NULL REFERENCES packaging_items(code),
  sort_order          INT NOT NULL,
  usage_basis         TEXT NOT NULL CHECK (usage_basis IN ('per_set','per_kg','per_unit')),
  cost_gbp            NUMERIC NOT NULL DEFAULT 0 CHECK (cost_gbp >= 0),
  quantity_multiplier NUMERIC NOT NULL DEFAULT 1 CHECK (quantity_multiplier > 0),
  units_per_pack      NUMERIC CHECK (units_per_pack > 0),
  quantity_source     TEXT NOT NULL DEFAULT 'sets' CHECK (quantity_source IN ('sets','kg')),
  UNIQUE (recipe_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_recipe_packaging_lines_recipe ON recipe_packaging_lines(recipe_id);

-- purchase orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id            SERIAL PRIMARY KEY,
  po_reference  TEXT NOT NULL UNIQUE,
  recipe_id     INT REFERENCES recipes(id) ON DELETE SET NULL,
  recipe_name   TEXT NOT NULL,
  batch_grams   NUMERIC NOT NULL,
  units         NUMERIC NOT NULL DEFAULT 0,
  detail        JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created ON purchase_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_recipe ON purchase_orders(recipe_id);

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
