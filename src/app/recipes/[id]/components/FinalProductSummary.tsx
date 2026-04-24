"use client";

type Props = {
  formulaValid: boolean;
  batchGrams: number;
  units: number;
  finalTotalCost: number;
  finalCostPerKg: number;
  finalCostPerUnit: number;
  formatDisplayCurrency: (gbp: number) => string;
};

export default function FinalProductSummary({
  formulaValid,
  batchGrams,
  units,
  finalTotalCost,
  finalCostPerKg,
  finalCostPerUnit,
  formatDisplayCurrency,
}: Props) {
  const valueClass = `font-semibold tabular-nums ${
    formulaValid ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
  }`;

  return (
    <div
      className={[
        "rounded-xl border-2 p-6 shadow-md",
        formulaValid
          ? "border-zinc-200 bg-zinc-50/80 dark:border-zinc-600 dark:bg-zinc-800/50"
          : "border-red-200 bg-red-50/60 dark:border-red-800 dark:bg-red-950/30",
      ].join(" ")}
    >
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
        Final product summary
        {!formulaValid && (
          <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-bold uppercase text-red-700 dark:bg-red-900/50 dark:text-red-300">
            Invalid
          </span>
        )}
      </h2>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-4 sm:block">
          <dt className="font-medium text-zinc-600 dark:text-zinc-400">Total cost</dt>
          <dd className={valueClass}>
            {formulaValid
              ? formatDisplayCurrency(finalTotalCost)
              : `~${formatDisplayCurrency(finalTotalCost)} (partial)`}
          </dd>
        </div>
        <div className="flex justify-between gap-4 sm:block">
          <dt className="font-medium text-zinc-600 dark:text-zinc-400">Cost per kg</dt>
          <dd className={valueClass}>
            {batchGrams > 0
              ? formulaValid
                ? formatDisplayCurrency(finalCostPerKg)
                : `~${formatDisplayCurrency(finalCostPerKg)}`
              : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-4 sm:block">
          <dt className="font-medium text-zinc-600 dark:text-zinc-400">Cost per set</dt>
          <dd className={valueClass}>
            {units > 0
              ? formulaValid
                ? formatDisplayCurrency(finalCostPerUnit)
                : `~${formatDisplayCurrency(finalCostPerUnit)}`
              : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
