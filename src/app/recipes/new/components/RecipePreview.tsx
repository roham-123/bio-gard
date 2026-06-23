"use client";

import { formatCfu } from "@/lib/format";
import { getFulvic80Violation, type calculate, type LineInput } from "@/lib/calc";
import {
  tableHeaderCellCls,
  tableHeaderRightCls,
} from "@/components/ui/formClasses";

type CalculateResult = ReturnType<typeof calculate>;

type Props = {
  previewBatchGrams: number;
  previewLineInputs: LineInput[];
  previewResult: CalculateResult | null;
  previewResultByLineId: Map<number, CalculateResult["results"][number]>;
  previewTotalFinalCfuPerGram: number;
};

export default function RecipePreview({
  previewBatchGrams,
  previewLineInputs,
  previewResult,
  previewResultByLineId,
  previewTotalFinalCfuPerGram,
}: Props) {
  const fulvic80Violation = previewResult ? getFulvic80Violation(previewResult.results) : null;

  return (
    <div className="rounded-xl border-2 border-zinc-200 bg-white shadow-md dark:border-zinc-600 dark:bg-zinc-800">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-600">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
          Live preview
        </h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Updates automatically while you edit this formula.
        </p>
      </div>
      {previewBatchGrams <= 0 ? (
        <p className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">
          Enter a valid default batch size to see preview values.
        </p>
      ) : previewLineInputs.length === 0 ? (
        <p className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">
          Select at least one ingredient row to see preview values.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-600">
              <thead>
                <tr className="bg-zinc-100 dark:bg-zinc-700/80">
                  <th className={tableHeaderCellCls}>#</th>
                  <th className={tableHeaderCellCls}>ID</th>
                  <th className={tableHeaderCellCls}>Ingredient</th>
                  <th className={tableHeaderRightCls}>g</th>
                  <th className={tableHeaderRightCls}>%</th>
                  <th className={tableHeaderRightCls}>Stock CFU/g</th>
                  <th className={tableHeaderRightCls}>Target CFU/g</th>
                  <th className={tableHeaderRightCls}>Final CFU/g</th>
                  <th className={tableHeaderRightCls}>Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-600">
                {previewLineInputs.map((line, idx) => {
                  const res = previewResultByLineId.get(idx + 1);
                  const isFulvic80Violation = fulvic80Violation?.lineId === idx + 1;
                  return (
                    <tr
                      key={line.lineId}
                      className={
                        isFulvic80Violation
                          ? "bg-red-50 hover:bg-red-50 dark:bg-red-950/30 dark:hover:bg-red-950/30"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-700/40"
                      }
                    >
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                        {idx + 1}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm font-mono text-zinc-700 dark:text-zinc-300">
                        {line.ingredientId}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                        {line.ingredientName || line.ingredientId}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                        {res
                          ? Math.round(res.grams).toLocaleString("en-GB", { maximumFractionDigits: 0 })
                          : "—"}
                      </td>
                      <td
                        className={`whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums ${
                          isFulvic80Violation
                            ? "font-semibold text-red-700 dark:text-red-300"
                            : "text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        {res ? `${(res.percent * 100).toFixed(2)}%` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                        {line.isBacteria ? formatCfu(line.stockCfuPerG) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                        {line.isBacteria && res && previewBatchGrams > 0
                          ? formatCfu(res.targetTotalCfu / previewBatchGrams)
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                        {res && res.isBacteria ? formatCfu(res.finalCfuPerGram) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                        {res ? `£${res.costInProduct.toFixed(2)}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 border-t border-zinc-200 px-4 py-3 text-sm sm:grid-cols-3 dark:border-zinc-600">
            <SummaryCard label="Total grams">
              {previewResult
                ? previewResult.totalGrams.toLocaleString("en-GB", { maximumFractionDigits: 2 })
                : "—"}
            </SummaryCard>
            <SummaryCard label="Total final CFU/g">
              {previewResult ? formatCfu(previewTotalFinalCfuPerGram) : "—"}
            </SummaryCard>
            <SummaryCard label="Total cost">
              {previewResult ? `£${previewResult.totalCost.toFixed(2)}` : "—"}
            </SummaryCard>
          </div>
          {previewResult?.error && (
            <div className="border-t border-zinc-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-zinc-600 dark:bg-red-950/40 dark:text-red-300">
              {previewResult.error}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-700/40">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-right font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
        {children}
      </p>
    </div>
  );
}
