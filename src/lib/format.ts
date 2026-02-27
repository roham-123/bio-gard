/**
 * Parse numeric input that may be in scientific notation (e.g. 1.00e11, 2.5E-3).
 */
export function parseScientific(value: string): number {
  const s = value.trim();
  if (s === "") return NaN;
  const n = Number(s);
  return n;
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
  if (n !== n) return ""; // NaN
  const { maxDecimals = 4, forceScientific = false } = options ?? {};
  const abs = Math.abs(n);
  const useScientific =
    forceScientific || abs >= 1e6 || (abs > 0 && abs < 1e-4);
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

export function formatPercent(value: unknown): string {
  return formatNumber(toNum(value) * 100, { maxDecimals: 2 }) + "%";
}

export function formatCurrency(value: unknown): string {
  return "£" + formatNumber(value, { maxDecimals: 2 });
}
