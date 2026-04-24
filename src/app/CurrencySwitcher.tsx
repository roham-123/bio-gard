"use client";

import { CURRENCIES, useFx } from "./FxProvider";

export default function CurrencySwitcher() {
  const { currency, setCurrency, mode } = useFx();

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {CURRENCIES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setCurrency(code)}
            className={[
              "rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
              currency === code
                ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500"
                : "border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600",
            ].join(" ")}
            aria-pressed={currency === code}
            title={`Use ${code}`}
          >
            {code}
          </button>
        ))}
      </div>
      <span
        className={[
          "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
          mode === "live"
            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
            : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
        ].join(" ")}
        title={mode === "live" ? "Using live FX rates" : "Using fixed FX rates"}
      >
        {mode === "live" ? "Live" : "Fixed"}
      </span>
    </div>
  );
}
