"use client";

import type { LineInput, LineResult } from "@/lib/calc";
import { formatCfu, formatGrams, formatKg, formatNumber, formatPercent } from "@/lib/format";

type Props = {
  lineInputs: LineInput[];
  resultByLineId: Map<number, LineResult>;
  formulaValid: boolean;
  units: number;
  formatDisplayCurrency: (gbp: number) => string;
};

export default function FormulaTable({
  lineInputs,
  resultByLineId,
  formulaValid,
  units,
  formatDisplayCurrency,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border-2 border-zinc-200 bg-white shadow-md dark:border-zinc-600 dark:bg-zinc-800">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-600">
        <thead>
          <tr className="bg-zinc-100 dark:bg-zinc-700/80">
            <th className="px-3 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              ID
            </th>
            <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              Ingredient
            </th>
            <th className="px-3 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">g</th>
            <th className="px-3 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">kg</th>
            <th className="px-3 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">g/set</th>
            <th className="px-3 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">%</th>
            <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Stock CFU/g</th>
            <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Target CFU</th>
            <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Final CFU/g</th>
            <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Cost/kg</th>
            <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-600">
          {lineInputs.map((line) => {
            const res = resultByLineId.get(line.lineId);
            const isBacteria = line.isBacteria;
            const isOverflow = res?.overflow;
            const isFillerInvalid =
              !formulaValid && !isBacteria && (line.fillerMode === "ratio" || line.fillerMode === "remainder");

            return (
              <tr
                key={line.lineId}
                className={[
                  "transition-colors",
                  isOverflow
                    ? "bg-red-50 dark:bg-red-950/40"
                    : isFillerInvalid
                      ? "bg-amber-50/60 opacity-60 dark:bg-amber-950/20"
                      : isBacteria
                        ? "bg-emerald-50/50 dark:bg-emerald-950/10"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-700/40",
                ].join(" ")}
              >
                <td className="whitespace-nowrap px-3 py-3 text-sm font-mono font-bold text-zinc-700 dark:text-zinc-200">
                  {line.ingredientId}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                  {line.ingredientName}
                  {res?.warning && (
                    <span
                      className="ml-1 text-red-500"
                      title={res.warning}
                      aria-label={res.warning}
                    >
                      ⚠
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                  {res ? formatNumber(Math.round(res.grams), { maxDecimals: 0 }) : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                  {res ? formatKg(res.grams / 1000) : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                  {res && units > 0 ? formatGrams(res.grams / units) : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                  {res ? formatPercent(res.percent) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                  {isBacteria ? formatCfu(line.stockCfuPerG) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                  {isBacteria && res ? formatCfu(res.targetTotalCfu) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                  {res && res.isBacteria ? formatCfu(res.finalCfuPerGram) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                  {formatDisplayCurrency(line.costPerKgGbp)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                  {res ? formatDisplayCurrency(res.costInProduct) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
