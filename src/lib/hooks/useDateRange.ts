"use client";

import { useCallback, useState } from "react";

export type DateRangePreset = "last_month" | "last_30_days";

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function resolveDateRangePreset(preset: DateRangePreset): { from: string; to: string } {
  const now = new Date();
  if (preset === "last_month") {
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthFirst = new Date(
      firstOfThisMonth.getFullYear(),
      firstOfThisMonth.getMonth() - 1,
      1
    );
    const lastMonthLast = new Date(firstOfThisMonth.getTime() - 24 * 60 * 60 * 1000);
    return { from: toIsoDate(lastMonthFirst), to: toIsoDate(lastMonthLast) };
  }
  // last_30_days
  const start = new Date(now);
  start.setDate(start.getDate() - 29);
  return { from: toIsoDate(start), to: toIsoDate(now) };
}

/**
 * Manage a `from`/`to` date range with preset shortcuts. Component owns the
 * actual fetch — this hook only maintains the input state.
 */
export function useDateRange(initial: { from?: string; to?: string } = {}) {
  const [fromDate, setFromDate] = useState(initial.from ?? "");
  const [toDate, setToDate] = useState(initial.to ?? "");

  const reset = useCallback(() => {
    setFromDate("");
    setToDate("");
  }, []);

  const applyPreset = useCallback((preset: DateRangePreset) => {
    const { from, to } = resolveDateRangePreset(preset);
    setFromDate(from);
    setToDate(to);
    return { from, to };
  }, []);

  return {
    fromDate,
    toDate,
    setFromDate,
    setToDate,
    reset,
    applyPreset,
  };
}
