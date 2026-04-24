CREATE TABLE IF NOT EXISTS recipe_labels (
  id            SERIAL PRIMARY KEY,
  recipe_id     INT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  mime_type     TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'application/pdf')),
  blob_url      TEXT NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipe_labels_recipe ON recipe_labels(recipe_id);
