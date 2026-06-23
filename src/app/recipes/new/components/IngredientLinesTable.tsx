"use client";

import type { Ingredient } from "@/lib/db";
import { formatCfu } from "@/lib/format";
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputCls,
  selectCls,
  tableHeaderCellCls,
  tableHeaderCenterCls,
  tableHeaderRightCls,
} from "@/components/ui/formClasses";
import type { BuilderLine, FillerMode } from "./builderTypes";

type Props = {
  lines: BuilderLine[];
  ingredients: Ingredient[];
  isEditMode: boolean;
  highlightedLineUids?: Set<string>;
  costDraftByLineUid: Record<string, string>;
  updateLine: (uid: string, patch: Partial<BuilderLine>) => void;
  removeRow: (uid: string) => void;
  onIngredientSelect: (uid: string, value: string) => void;
  onCreateIngredient: (line: BuilderLine) => void;
  onBeginCostEdit: (uid: string, currentValue: number) => void;
  onCostDraftChange: (uid: string, rawValue: string) => void;
  onCommitCostEdit: (line: BuilderLine) => void;
};

export default function IngredientLinesTable({
  lines,
  ingredients,
  isEditMode,
  highlightedLineUids,
  costDraftByLineUid,
  updateLine,
  removeRow,
  onIngredientSelect,
  onCreateIngredient,
  onBeginCostEdit,
  onCostDraftChange,
  onCommitCostEdit,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border-2 border-zinc-200 bg-white shadow-md dark:border-zinc-600 dark:bg-zinc-800">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-600">
        <thead>
          <tr className="bg-zinc-100 dark:bg-zinc-700/80">
            <th className={tableHeaderCellCls}>#</th>
            <th className={tableHeaderCellCls}>Ingredient</th>
            <th className={tableHeaderCenterCls}>Type</th>
            <th className={tableHeaderRightCls}>Stock CFU/g</th>
            <th className={tableHeaderRightCls}>Cost/kg</th>
            <th className={tableHeaderCellCls}>Mode</th>
            <th className={tableHeaderRightCls}>Ratio</th>
            <th className={tableHeaderRightCls}>Target CFU</th>
            <th className={tableHeaderRightCls}>Default g</th>
            <th className="px-3 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-600">
          {lines.map((line, idx) => (
            <tr
              key={line.uid}
              className={
                highlightedLineUids?.has(line.uid)
                  ? "bg-red-50 hover:bg-red-50 dark:bg-red-950/30 dark:hover:bg-red-950/30"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-700/40"
              }
            >
              <td className="whitespace-nowrap px-3 py-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                {idx + 1}
              </td>

              <td className="px-3 py-3 text-sm">
                <div className="space-y-2">
                  <select
                    value={line.showNewIngredient ? "__new__" : line.ingredientId ?? ""}
                    onChange={(e) => onIngredientSelect(line.uid, e.target.value)}
                    className={`${selectCls} min-w-[200px]`}
                  >
                    <option value="">Select ingredient...</option>
                    <option value="__new__">+ Create new ingredient</option>
                    {ingredients.map((i) => (
                      <option key={i.id} value={i.id} className="font-semibold">
                        {i.stock_cfu_per_g > 0 ? "\u{1F9EC} " : ""}[{i.id}] {i.name}
                      </option>
                    ))}
                  </select>
                  {line.showNewIngredient && (
                    <div className="space-y-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-600 dark:bg-zinc-700/50">
                      <input
                        placeholder="ID (e.g. PRO0235-1E11)"
                        value={line.newIngId}
                        onChange={(e) => updateLine(line.uid, { newIngId: e.target.value })}
                        className={`${inputCls} w-full`}
                      />
                      <input
                        placeholder="Name"
                        value={line.newIngName}
                        onChange={(e) => updateLine(line.uid, { newIngName: e.target.value })}
                        className={`${inputCls} w-full`}
                      />
                      <input
                        placeholder="Stock CFU/g (0 for filler)"
                        value={line.newIngStockCfu}
                        onChange={(e) => updateLine(line.uid, { newIngStockCfu: e.target.value })}
                        className={`${inputCls} w-full`}
                      />
                      <input
                        placeholder="Cost/kg (£)"
                        value={line.newIngCostPerKg}
                        onChange={(e) => updateLine(line.uid, { newIngCostPerKg: e.target.value })}
                        className={`${inputCls} w-full`}
                      />
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => onCreateIngredient(line)} className={btnPrimary}>
                          Create
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateLine(line.uid, { showNewIngredient: false, newIngId: "", newIngName: "" })
                          }
                          className={btnSecondary}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </td>

              <td className="px-3 py-3 text-center text-xs font-semibold">
                {line.ingredientId ? (
                  line.isBacteria ? (
                    <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                      Bacteria
                    </span>
                  ) : (
                    <span className="rounded bg-zinc-200 px-2 py-1 text-zinc-600 dark:bg-zinc-600 dark:text-zinc-300">
                      Filler
                    </span>
                  )
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </td>

              <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                {line.ingredientId && line.isBacteria ? formatCfu(line.stockCfuPerG) : "—"}
              </td>

              <td className="whitespace-nowrap px-3 py-3 text-right text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                {line.ingredientId ? (
                  isEditMode ? (
                    <input
                      type="text"
                      value={costDraftByLineUid[line.uid] ?? String(line.costPerKgGbp)}
                      onFocus={() => onBeginCostEdit(line.uid, line.costPerKgGbp)}
                      onChange={(e) => onCostDraftChange(line.uid, e.target.value)}
                      onBlur={() => onCommitCostEdit(line)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.currentTarget.blur();
                        }
                      }}
                      className={`${inputCls} w-24 text-right`}
                    />
                  ) : (
                    `£${line.costPerKgGbp.toFixed(2)}`
                  )
                ) : (
                  "—"
                )}
              </td>

              <td className="px-3 py-3 text-sm">
                <select
                  value={line.fillerMode}
                  disabled={line.isBacteria}
                  onChange={(e) => updateLine(line.uid, { fillerMode: e.target.value as FillerMode })}
                  className={`${selectCls} w-28 ${line.isBacteria ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  <option value="fixed">Fixed</option>
                  <option value="ratio">Ratio</option>
                  <option value="remainder">Remainder</option>
                </select>
              </td>

              <td className="px-3 py-3 text-right">
                <input
                  type="text"
                  placeholder="\u2014"
                  value={line.fillerRatio}
                  disabled={line.fillerMode !== "ratio"}
                  onChange={(e) => updateLine(line.uid, { fillerRatio: e.target.value })}
                  className={`${inputCls} w-20 text-right ${line.fillerMode !== "ratio" ? "opacity-40 cursor-not-allowed" : ""}`}
                />
              </td>

              <td className="px-3 py-3 text-right">
                <input
                  type="text"
                  placeholder={line.isBacteria ? "e.g. 1e13" : "\u2014"}
                  value={line.targetTotalCfu}
                  disabled={!line.isBacteria}
                  onChange={(e) => updateLine(line.uid, { targetTotalCfu: e.target.value })}
                  className={`${inputCls} w-24 text-right ${!line.isBacteria ? "opacity-40 cursor-not-allowed" : ""}`}
                />
              </td>

              <td className="px-3 py-3 text-right">
                {!line.isBacteria && line.fillerMode === "fixed" ? (
                  <input
                    type="text"
                    placeholder="g"
                    value={line.defaultGrams}
                    onChange={(e) => updateLine(line.uid, { defaultGrams: e.target.value })}
                    className={`${inputCls} w-24 text-right`}
                  />
                ) : (
                  <span className="text-xs text-zinc-400">{line.isBacteria ? "auto" : "\u2014"}</span>
                )}
              </td>

              <td className="px-3 py-3">
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(line.uid)}
                    className={btnDanger}
                    title="Remove row"
                  >
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
