/**
 * Parse a user-entered number string. Returns NaN for empty or non-numeric input.
 *
 * `Number()` already handles scientific notation natively (e.g. "1.00e11",
 * "2.5E-3"), so this is just a trimmed wrapper. Callers should `Number.isNaN`
 * check the result.
 */
export function parseNumberInput(value: string): number {
  const s = value.trim();
  if (s === "") return NaN;
  return Number(s);
}

/**
 * Coerce to number; safe for values from DB (pg returns NUMERIC as string).
 */
function toNum(value: unknown): number {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Format a number for display; use scientific notation for very large/small values (e.g. 1.00E+11).
 * Accepts number or string (e.g. from DB).
 */
export function formatNumber(
  value: unknown,
  options?: { maxDecimals?: number; forceScientific?: boolean }
): string {
  const n = toNum(value);
  if (Number.isNaN(n)) return "";
  const { maxDecimals = 4, forceScientific = false } = options ?? {};
  const abs = Math.abs(n);
  const useScientific = forceScientific || abs >= 1e6 || (abs > 0 && abs < 1e-4);
  if (useScientific) {
    const exp = n.toExponential(maxDecimals);
    return exp.replace(/e([+-])(\d+)/i, "E$1$2");
  }
  const fixed = n.toFixed(maxDecimals);
  return parseFloat(fixed).toString();
}

export function formatCfu(value: unknown): string {
  const n = toNum(value);
  return formatNumber(n, { maxDecimals: 2, forceScientific: n >= 1e6 || (n > 0 && n < 0.01) });
}

export function formatGrams(value: unknown): string {
  return toNum(value).toFixed(2);
}

export function formatKg(value: unknown): string {
  return toNum(value).toFixed(3);
}

export function formatPercent(value: unknown): string {
  return (toNum(value) * 100).toFixed(2) + "%";
}

export type CurrencyCode = "GBP" | "EUR" | "PLN" | "USD";

export function formatCurrency(value: unknown, currency: CurrencyCode = "GBP"): string {
  const n = toNum(value);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Format an ISO timestamp as `dd MMM yyyy` in en-GB locale. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Format an ISO timestamp as `HH:mm` in en-GB locale. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
