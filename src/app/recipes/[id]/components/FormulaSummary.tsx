"use client";

import type { RecipeLabel } from "@/lib/db";
import { formatCfu, formatGrams, formatKg } from "@/lib/format";

type Props = {
  formulaValid: boolean;
  totalGrams: number;
  totalFinalCfuPerGram: number;
  totalCost: number;
  costPerKg: number;
  units: number;
  selectedLabel: RecipeLabel | null;
  onOpenLabels: () => void;
  onGeneratePurchaseOrder: () => void;
  isGeneratingPo: boolean;
  formatDisplayCurrency: (gbp: number) => string;
};

export default function FormulaSummary({
  formulaValid,
  totalGrams,
  totalFinalCfuPerGram,
  totalCost,
  costPerKg,
  units,
  selectedLabel,
  onOpenLabels,
  onGeneratePurchaseOrder,
  isGeneratingPo,
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
        Microbial Formula Summary
        {!formulaValid && (
          <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-bold uppercase text-red-700 dark:bg-red-900/50 dark:text-red-300">
            Invalid
          </span>
        )}
      </h2>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-4 sm:block">
          <dt className="font-medium text-zinc-600 dark:text-zinc-400">Total grams</dt>
          <dd className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {formatKg(totalGrams / 1000)} kg ({formatGrams(totalGrams)} g)
          </dd>
        </div>
        <div className="flex justify-between gap-4 sm:block">
          <dt className="font-medium text-zinc-600 dark:text-zinc-400">Total final CFU/g</dt>
          <dd className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {formatCfu(totalFinalCfuPerGram)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 sm:block">
          <dt className="font-medium text-zinc-600 dark:text-zinc-400">Total cost</dt>
          <dd className={valueClass}>
            {formulaValid
              ? formatDisplayCurrency(totalCost)
              : `~${formatDisplayCurrency(totalCost)} (partial)`}
          </dd>
        </div>
        <div className="flex justify-between gap-4 sm:block">
          <dt className="font-medium text-zinc-600 dark:text-zinc-400">Cost per kg</dt>
          <dd className={valueClass}>
            {formulaValid ? formatDisplayCurrency(costPerKg) : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-4 sm:block">
          <dt className="font-medium text-zinc-600 dark:text-zinc-400">Cost per set</dt>
          <dd className={valueClass}>
            {formulaValid && units > 0 ? formatDisplayCurrency(totalCost / units) : "—"}
          </dd>
        </div>
      </dl>
      <div className="mt-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onOpenLabels}
            className="rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 dark:focus:ring-offset-zinc-800"
          >
            Labels
          </button>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {selectedLabel ? `Selected: ${selectedLabel.file_name}` : "No label selected"}
          </span>
        </div>
        <button
          type="button"
          disabled={!formulaValid || isGeneratingPo}
          onClick={onGeneratePurchaseOrder}
          className={[
            "rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2",
            formulaValid && !isGeneratingPo
              ? "bg-zinc-800 text-white hover:bg-zinc-700 focus:ring-zinc-500 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:focus:ring-offset-zinc-800"
              : "cursor-not-allowed bg-zinc-300 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-500",
          ].join(" ")}
        >
          {isGeneratingPo
            ? "Generating…"
            : formulaValid
              ? "Generate Purchase Order"
              : "Purchase order unavailable — fix formula"}
        </button>
      </div>
    </div>
  );
}
