CREATE TABLE IF NOT EXISTS fx_settings (
  id                INT PRIMARY KEY CHECK (id = 1),
  mode              TEXT NOT NULL CHECK (mode IN ('live', 'fixed')) DEFAULT 'live',
  fixed_rate_eur    NUMERIC NOT NULL DEFAULT 1.17 CHECK (fixed_rate_eur > 0),
  fixed_rate_pln    NUMERIC NOT NULL DEFAULT 5.05 CHECK (fixed_rate_pln > 0),
  fixed_rate_usd    NUMERIC NOT NULL DEFAULT 1.27 CHECK (fixed_rate_usd > 0),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO fx_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
