import { withClient } from "./client";
import { isMissingTableError } from "./client";
import { logAction } from "./audit";
import { BOOTSTRAP_FX_RATES } from "@/lib/fx";

export type FxSettings = {
  mode: "live" | "fixed";
  fixedRates: {
    GBP: number;
    EUR: number;
    PLN: number;
    USD: number;
  };
  /**
   * Most recently confirmed live rates from the upstream FX API, cached in
   * the database. `null` only before the very first successful fetch on a
   * fresh install — at that point callers must fall back to {@link BOOTSTRAP_FX_RATES}.
   */
  lastLiveRates: { GBP: number; EUR: number; PLN: number; USD: number } | null;
  /** Rate-validity date as reported by the upstream API (e.g. "2026-05-06"). */
  lastLiveRateDate: string | null;
  /** Wall-clock timestamp of the last successful upstream fetch. */
  lastLiveFetchedAt: string | null;
  updatedAt: string | null;
};

const DEFAULT_SETTINGS: FxSettings = {
  mode: "live",
  fixedRates: { ...BOOTSTRAP_FX_RATES },
  lastLiveRates: null,
  lastLiveRateDate: null,
  lastLiveFetchedAt: null,
  updatedAt: null,
};

type FxSettingsRow = {
  mode: "live" | "fixed";
  fixed_rate_eur: string;
  fixed_rate_pln: string;
  fixed_rate_usd: string;
  last_live_rate_eur: string | null;
  last_live_rate_pln: string | null;
  last_live_rate_usd: string | null;
  last_live_rate_date: string | null;
  last_live_fetched_at: string | null;
  updated_at: string;
};

function mapRow(row: FxSettingsRow): FxSettings {
  const liveEur = row.last_live_rate_eur != null ? Number(row.last_live_rate_eur) : null;
  const livePln = row.last_live_rate_pln != null ? Number(row.last_live_rate_pln) : null;
  const liveUsd = row.last_live_rate_usd != null ? Number(row.last_live_rate_usd) : null;
  const haveLiveCache = liveEur != null && livePln != null && liveUsd != null;
  return {
    mode: row.mode,
    fixedRates: {
      GBP: 1,
      EUR: Number(row.fixed_rate_eur),
      PLN: Number(row.fixed_rate_pln),
      USD: Number(row.fixed_rate_usd),
    },
    lastLiveRates: haveLiveCache
      ? { GBP: 1, EUR: liveEur!, PLN: livePln!, USD: liveUsd! }
      : null,
    lastLiveRateDate: row.last_live_rate_date,
    lastLiveFetchedAt: row.last_live_fetched_at,
    updatedAt: row.updated_at,
  };
}

export async function getFxSettings(): Promise<FxSettings> {
  return withClient(async (client) => {
    try {
      const r = await client.query<FxSettingsRow>(
        `SELECT mode,
                fixed_rate_eur, fixed_rate_pln, fixed_rate_usd,
                last_live_rate_eur, last_live_rate_pln, last_live_rate_usd,
                last_live_rate_date, last_live_fetched_at,
                updated_at
         FROM fx_settings
         WHERE id = 1`
      );
      const row = r.rows[0];
      return row ? mapRow(row) : DEFAULT_SETTINGS;
    } catch (error) {
      if (isMissingTableError(error)) return DEFAULT_SETTINGS;
      throw error;
    }
  });
}

export async function updateFxSettings(
  mode: "live" | "fixed",
  fixedRates: { EUR: number; PLN: number; USD: number }
): Promise<FxSettings> {
  return withClient(async (client) => {
    // Note: deliberately does NOT touch last_live_* columns. The user-managed
    // mode/fixed-rate state and the live-rate cache are independent.
    const r = await client.query<FxSettingsRow>(
      `INSERT INTO fx_settings (id, mode, fixed_rate_eur, fixed_rate_pln, fixed_rate_usd, updated_at)
       VALUES (1, $1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE SET
         mode = EXCLUDED.mode,
         fixed_rate_eur = EXCLUDED.fixed_rate_eur,
         fixed_rate_pln = EXCLUDED.fixed_rate_pln,
         fixed_rate_usd = EXCLUDED.fixed_rate_usd,
         updated_at = NOW()
       RETURNING mode,
                 fixed_rate_eur, fixed_rate_pln, fixed_rate_usd,
                 last_live_rate_eur, last_live_rate_pln, last_live_rate_usd,
                 last_live_rate_date, last_live_fetched_at,
                 updated_at`,
      [mode, fixedRates.EUR, fixedRates.PLN, fixedRates.USD]
    );
    const settings = mapRow(r.rows[0]);
    await logAction(client, "update_fx_settings", "fx_settings", 1, {
      mode: settings.mode,
      fixed_rate_eur: settings.fixedRates.EUR,
      fixed_rate_pln: settings.fixedRates.PLN,
      fixed_rate_usd: settings.fixedRates.USD,
    });
    return settings;
  });
}

/**
 * Persist the most recent successful upstream live rates. Touches only the
 * `last_live_*` cache columns — never touches the user's mode or fixed rates.
 *
 * Returns `false` (silently) when the `fx_settings` table doesn't exist yet,
 * so the caller can degrade gracefully on a pre-migration deploy.
 */
export async function recordLiveFxRates(input: {
  EUR: number;
  PLN: number;
  USD: number;
  date: string | null;
}): Promise<boolean> {
  return withClient(async (client) => {
    try {
      const result = await client.query(
        `UPDATE fx_settings
         SET last_live_rate_eur = $1,
             last_live_rate_pln = $2,
             last_live_rate_usd = $3,
             last_live_rate_date = $4,
             last_live_fetched_at = NOW()
         WHERE id = 1`,
        [input.EUR, input.PLN, input.USD, input.date]
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      if (isMissingTableError(error)) return false;
      throw error;
    }
  });
}
