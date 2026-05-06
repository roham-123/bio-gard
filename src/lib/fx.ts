import type { CurrencyCode } from "@/lib/format";

/**
 * Hardcoded bootstrap FX rates used **only** before any live fetch has ever
 * succeeded against this database. After the first successful upstream API
 * call these are replaced by the cached `last_live_rate_*` columns in
 * `fx_settings`, so in normal operation these constants are unused.
 *
 * Treat this as a one-time seed. If you find yourself wanting to "update" them,
 * the right answer is almost always to fetch fresh live rates instead.
 */
export const BOOTSTRAP_FX_RATES: Record<CurrencyCode, number> = {
  GBP: 1,
  EUR: 1.17,
  PLN: 5.05,
  USD: 1.27,
};
