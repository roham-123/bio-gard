"use client";

import { useEffect, useState } from "react";
import type { CurrencyCode } from "@/lib/format";
import { CURRENCIES, useFx } from "../FxProvider";

export default function FxRatesPage() {
  const {
    mode,
    setMode,
    liveRates,
    fixedRates,
    setFixedRate,
    liveRatesUpdatedAt,
    liveStatus,
    liveError,
  } = useFx();

  const isLive = mode === "live";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 sm:p-8">
        <header className="border-b border-zinc-200 pb-6 dark:border-zinc-600">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            FX Rates
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Choose between live rates (fetched from the Frankfurter FX API) or
            your own fixed rates. All rates are expressed as the amount of the
            target currency per 1 GBP.
          </p>
        </header>

        <section className="mt-6">
          <ModeToggle isLive={isLive} onChange={(live) => setMode(live ? "live" : "fixed")} />
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
            {isLive ? "Live rates" : "Fixed rates"}
          </h2>

          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-600">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-600">
              <thead>
                <tr className="bg-zinc-100 dark:bg-zinc-700/80">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Currency
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Rate (per 1 GBP)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-600">
                {CURRENCIES.filter((c) => c !== "GBP").map((code) => (
                  <RateRow
                    key={code}
                    code={code}
                    liveValue={liveRates[code]}
                    fixedValue={fixedRates[code]}
                    isLive={isLive}
                    onChangeFixed={(v) => setFixedRate(code, v)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {isLive && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {liveRatesUpdatedAt
                  ? `Last updated ${liveRatesUpdatedAt}. `
                  : "Rates refresh automatically. "}
                Rates refresh every 10 minutes while the app is open.
              </p>
              {liveStatus === "loading" && (
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Refreshing live rates...
                </p>
              )}
              {liveStatus === "error" && (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  Live API unavailable. Showing cached/default rates.
                  {liveError ? ` (${liveError})` : ""}
                </p>
              )}
            </div>
          )}
          {!isLive && (
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Fixed rates are stored locally in this browser. Toggle &ldquo;Live
              rates&rdquo; back on at any time to resume automatic updates.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

type ModeToggleProps = {
  isLive: boolean;
  onChange: (live: boolean) => void;
};

function ModeToggle({ isLive, onChange }: ModeToggleProps) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3">
      <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        Live rates
      </span>
      <span
        role="switch"
        aria-checked={isLive}
        tabIndex={0}
        onClick={() => onChange(!isLive)}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onChange(!isLive);
          }
        }}
        className={[
          "relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-800",
          isLive
            ? "border-emerald-600 bg-emerald-600"
            : "border-zinc-300 bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-700",
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className={[
            "inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform",
            isLive ? "translate-x-5" : "translate-x-1",
          ].join(" ")}
        />
      </span>
      <span
        className={[
          "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
          isLive
            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
            : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
        ].join(" ")}
      >
        {isLive ? "Live" : "Fixed"}
      </span>
    </label>
  );
}

type RateRowProps = {
  code: CurrencyCode;
  liveValue: number;
  fixedValue: number;
  isLive: boolean;
  onChangeFixed: (rate: number) => void;
};

function RateRow({ code, liveValue, fixedValue, isLive, onChangeFixed }: RateRowProps) {
  const [draft, setDraft] = useState(String(fixedValue));

  useEffect(() => {
    setDraft(String(fixedValue));
  }, [fixedValue]);

  const commit = () => {
    const parsed = parseFloat(draft);
    if (Number.isFinite(parsed) && parsed > 0) {
      onChangeFixed(parsed);
      setDraft(String(parsed));
    } else {
      setDraft(String(fixedValue));
    }
  };

  return (
    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-700/40">
      <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        GBP/{code}
      </td>
      <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">
        {isLive ? (
          <span className="font-mono tabular-nums">
            {Number(liveValue).toFixed(4)}
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.0001"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
              className="w-32 rounded-lg border-2 border-zinc-300 bg-white px-3 py-1.5 text-sm font-mono tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100"
              aria-label={`Fixed GBP to ${code} rate`}
            />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              (live {Number(liveValue).toFixed(4)})
            </span>
          </div>
        )}
      </td>
    </tr>
  );
}
