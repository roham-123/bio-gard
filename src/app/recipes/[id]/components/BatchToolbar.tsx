"use client";

import Link from "next/link";
import { formatGrams, formatNumber } from "@/lib/format";

type Props = {
  recipeId: number;
  batchInput: string;
  setBatchInput: (v: string) => void;
  onBatchCommit: () => void;
  batchGrams: number;
  kgPerUnitInput: string;
  setKgPerUnitInput: (v: string) => void;
  onKgPerUnitCommit: () => void;
  kgPerUnit: number;
  units: number;
};

export default function BatchToolbar({
  recipeId,
  batchInput,
  setBatchInput,
  onBatchCommit,
  batchGrams,
  kgPerUnitInput,
  setKgPerUnitInput,
  onKgPerUnitCommit,
  kgPerUnit,
  units,
}: Props) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-600 dark:bg-zinc-800/50">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Batch size (kg)
          </label>
          <input
            type="text"
            value={batchInput}
            onChange={(e) => setBatchInput(e.target.value)}
            onBlur={onBatchCommit}
            onKeyDown={(e) => e.key === "Enter" && onBatchCommit()}
            className="w-28 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium tabular-nums shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
          />
          {batchGrams > 0 && (
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              = {formatGrams(batchGrams)} g
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            kg per set
          </label>
          <input
            type="text"
            value={kgPerUnitInput}
            onChange={(e) => setKgPerUnitInput(e.target.value)}
            onBlur={onKgPerUnitCommit}
            onKeyDown={(e) => e.key === "Enter" && onKgPerUnitCommit()}
            className="w-24 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium tabular-nums shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
          />
          {kgPerUnit > 0 && batchGrams > 0 && (
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              ≈ {formatNumber(units, { maxDecimals: 2 })} sets
            </span>
          )}
        </div>
        <div className="h-6 w-px bg-zinc-300 dark:bg-zinc-600" />
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/recipes/${recipeId}/edit`}
            className="rounded-lg border-2 border-emerald-500 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 dark:border-emerald-400 dark:bg-zinc-700 dark:text-emerald-300 dark:hover:bg-zinc-600 dark:focus:ring-offset-zinc-800"
          >
            Edit Formula
          </Link>
        </div>
      </div>
    </div>
  );
}
