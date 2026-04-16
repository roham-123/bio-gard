-- Add purchase_orders table for PO history and reference tracking
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
