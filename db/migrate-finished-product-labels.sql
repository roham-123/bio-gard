CREATE TABLE IF NOT EXISTS finished_product_labels (
  id SERIAL PRIMARY KEY,
  finished_product_id INTEGER NOT NULL REFERENCES finished_products(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'application/pdf')),
  blob_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finished_product_labels_product_created
  ON finished_product_labels(finished_product_id, created_at DESC);
