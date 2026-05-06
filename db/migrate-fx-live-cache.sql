-- Cache columns for the most recently confirmed live rates from the upstream
-- FX API (Frankfurter). Populated by `/api/fx-rates` on every successful fetch
-- and read back when the upstream API is unreachable. Independent from the
-- user-managed `fixed_rate_*` columns.
ALTER TABLE fx_settings
  ADD COLUMN IF NOT EXISTS last_live_rate_eur NUMERIC
    CHECK (last_live_rate_eur IS NULL OR last_live_rate_eur > 0);

ALTER TABLE fx_settings
  ADD COLUMN IF NOT EXISTS last_live_rate_pln NUMERIC
    CHECK (last_live_rate_pln IS NULL OR last_live_rate_pln > 0);

ALTER TABLE fx_settings
  ADD COLUMN IF NOT EXISTS last_live_rate_usd NUMERIC
    CHECK (last_live_rate_usd IS NULL OR last_live_rate_usd > 0);

-- The rate-validity date as reported by the upstream API (e.g. "2026-05-06").
ALTER TABLE fx_settings
  ADD COLUMN IF NOT EXISTS last_live_rate_date TEXT;

-- The wall-clock timestamp when we successfully recorded the rates above.
ALTER TABLE fx_settings
  ADD COLUMN IF NOT EXISTS last_live_fetched_at TIMESTAMPTZ;
