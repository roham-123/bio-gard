"use client";

import { parseNumberInput } from "@/lib/format";
import { inputCls } from "@/components/ui/formClasses";

type Props = {
  recipeName: string;
  setRecipeName: (value: string) => void;
  batchSizeKg: string;
  setBatchSizeKg: (value: string) => void;
  defaultKgPerSet: string;
  setDefaultKgPerSet: (value: string) => void;
};

function HintGrams({ value }: { value: string }) {
  const parsed = parseNumberInput(value);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return (
    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
      = {(parsed * 1000).toLocaleString("en-GB", { maximumFractionDigits: 2 })} g
    </span>
  );
}

export default function RecipeMetaForm({
  recipeName,
  setRecipeName,
  batchSizeKg,
  setBatchSizeKg,
  defaultKgPerSet,
  setDefaultKgPerSet,
}: Props) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-600 dark:bg-zinc-800/50">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Formula Name</label>
          <input
            type="text"
            placeholder="e.g. RBC 500 WW10"
            value={recipeName}
            onChange={(e) => setRecipeName(e.target.value)}
            className={`${inputCls} w-72`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Default Batch Size (kg)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. 10"
              value={batchSizeKg}
              onChange={(e) => setBatchSizeKg(e.target.value)}
              className={`${inputCls} w-32`}
            />
            <HintGrams value={batchSizeKg} />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Default kg per set
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="e.g. 2 or 0.15"
              value={defaultKgPerSet}
              onChange={(e) => setDefaultKgPerSet(e.target.value)}
              className={`${inputCls} w-32`}
            />
            <HintGrams value={defaultKgPerSet} />
          </div>
        </div>
      </div>
    </div>
  );
}
