CREATE TABLE IF NOT EXISTS finished_products (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  sku           TEXT UNIQUE,
  default_units_per_pack NUMERIC NOT NULL DEFAULT 1 CHECK (default_units_per_pack > 0),
  base_unit_cost_gbp NUMERIC NOT NULL DEFAULT 0 CHECK (base_unit_cost_gbp >= 0),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finished_product_packaging_lines (
  id                  SERIAL PRIMARY KEY,
  finished_product_id INT NOT NULL REFERENCES finished_products(id) ON DELETE CASCADE,
  packaging_item_code TEXT NOT NULL REFERENCES packaging_items(code),
  sort_order          INT NOT NULL,
  usage_basis         TEXT NOT NULL CHECK (usage_basis IN ('per_unit','per_pack')),
  cost_gbp            NUMERIC NOT NULL DEFAULT 0 CHECK (cost_gbp >= 0),
  quantity_multiplier NUMERIC NOT NULL DEFAULT 1 CHECK (quantity_multiplier > 0),
  units_per_pack      NUMERIC CHECK (units_per_pack > 0),
  UNIQUE (finished_product_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_finished_product_packaging_lines_product
  ON finished_product_packaging_lines(finished_product_id);

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'recipe'
    CHECK (source_type IN ('recipe','finished_product')),
  ADD COLUMN IF NOT EXISTS finished_product_id INT REFERENCES finished_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_name TEXT;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_finished_product
  ON purchase_orders(finished_product_id);
