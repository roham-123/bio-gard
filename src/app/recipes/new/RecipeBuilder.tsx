"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Ingredient, RecipeWithLines } from "@/lib/db";
import { parseNumberInput } from "@/lib/format";
import { calculate, getFulvic80Violation, type LineInput } from "@/lib/calc";
import {
  createRecipeAction,
  updateRecipeAction,
  createIngredientAction,
  updateIngredientCostPerKgAction,
} from "@/app/actions";
import { btnPrimary, btnSecondary } from "@/components/ui/formClasses";
import RecipeMetaForm from "./components/RecipeMetaForm";
import IngredientLinesTable from "./components/IngredientLinesTable";
import RecipePreview from "./components/RecipePreview";
import {
  builderLineFromRecipe,
  emptyBuilderLine,
  type BuilderLine,
} from "./components/builderTypes";

type Props = {
  ingredients: Ingredient[];
  existingRecipe?: RecipeWithLines;
};

export default function RecipeBuilder({ ingredients: initialIngredients, existingRecipe }: Props) {
  const router = useRouter();
  const isEditMode = !!existingRecipe;

  const [recipeName, setRecipeName] = useState(existingRecipe?.name ?? "");
  const [batchSizeKg, setBatchSizeKg] = useState(
    existingRecipe ? String(existingRecipe.default_batch_grams / 1000) : ""
  );
  const [defaultKgPerSet, setDefaultKgPerSet] = useState(
    existingRecipe ? String(existingRecipe.default_kg_per_set) : "1"
  );
  const [lines, setLines] = useState<BuilderLine[]>(
    existingRecipe && existingRecipe.lines.length > 0
      ? existingRecipe.lines.map(builderLineFromRecipe)
      : [emptyBuilderLine()]
  );
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [costDraftByLineUid, setCostDraftByLineUid] = useState<Record<string, string>>({});

  const previewBatchKg = parseNumberInput(batchSizeKg);
  const previewBatchGrams =
    !Number.isNaN(previewBatchKg) && previewBatchKg > 0 ? previewBatchKg * 1000 : 0;

  const previewLineInputs = useMemo<LineInput[]>(
    () =>
      lines
        .filter((line) => line.ingredientId != null)
        .map((line, idx) => {
          const targetCfu = parseNumberInput(line.targetTotalCfu) || 0;
          const defaultGrams = line.isBacteria
            ? line.stockCfuPerG > 0
              ? targetCfu / line.stockCfuPerG
              : 0
            : parseNumberInput(line.defaultGrams) || 0;
          return {
            lineId: idx + 1,
            ingredientId: line.ingredientId!,
            ingredientName: line.ingredientName,
            isBacteria: line.isBacteria,
            stockCfuPerG: line.stockCfuPerG,
            costPerKgGbp: line.costPerKgGbp,
            targetTotalCfu: targetCfu,
            defaultGrams,
            fillerMode: line.fillerMode,
            fillerRatio: line.fillerMode === "ratio" ? parseNumberInput(line.fillerRatio) || 0 : 0,
            sortOrder: idx + 1,
          };
        }),
    [lines]
  );

  const previewResult = useMemo(
    () =>
      previewBatchGrams > 0 && previewLineInputs.length > 0
        ? calculate(previewBatchGrams, previewBatchGrams, previewLineInputs)
        : null,
    [previewBatchGrams, previewLineInputs]
  );

  const previewResultByLineId = useMemo(() => {
    const map = new Map<number, ReturnType<typeof calculate>["results"][number]>();
    previewResult?.results.forEach((res) => map.set(res.lineId, res));
    return map;
  }, [previewResult]);

  const previewTotalFinalCfuPerGram = useMemo(
    () =>
      previewResult
        ? previewResult.results.reduce(
            (sum, res) => sum + (res.isBacteria ? res.finalCfuPerGram : 0),
            0
          )
        : 0,
    [previewResult]
  );

  const highlightedLineUids = useMemo(() => {
    const fulvic80Violation = previewResult ? getFulvic80Violation(previewResult.results) : null;
    if (!fulvic80Violation) return new Set<string>();
    const validLines = lines.filter((line) => line.ingredientId != null);
    const line = validLines[fulvic80Violation.lineId - 1];
    return line ? new Set([line.uid]) : new Set<string>();
  }, [lines, previewResult]);

  const updateLine = useCallback((uid: string, patch: Partial<BuilderLine>) => {
    setLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  }, []);

  const handleIngredientSelect = useCallback(
    (uid: string, value: string) => {
      if (value === "__new__") {
        updateLine(uid, { showNewIngredient: true, ingredientId: null, ingredientName: "" });
        return;
      }
      const ing = ingredients.find((i) => i.id === value);
      if (!ing) return;
      const isBacteria = ing.stock_cfu_per_g > 0;
      updateLine(uid, {
        ingredientId: ing.id,
        ingredientName: ing.name,
        isBacteria,
        stockCfuPerG: ing.stock_cfu_per_g,
        costPerKgGbp: ing.cost_per_kg_gbp,
        fillerMode: "fixed",
        showNewIngredient: false,
      });
    },
    [ingredients, updateLine]
  );

  const handleCreateIngredient = useCallback(
    async (line: BuilderLine) => {
      const id = line.newIngId.trim();
      const name = line.newIngName.trim();
      if (!id) {
        setError("Ingredient ID is required.");
        return;
      }
      if (!name) {
        setError("Ingredient name is required.");
        return;
      }
      const stockCfu = parseNumberInput(line.newIngStockCfu) || 0;
      const costPerKg = parseNumberInput(line.newIngCostPerKg) || 0;
      try {
        const ing = await createIngredientAction(id, name, stockCfu, costPerKg);
        setIngredients((prev) => [...prev, ing].sort((a, b) => a.name.localeCompare(b.name)));
        const isBacteria = ing.stock_cfu_per_g > 0;
        updateLine(line.uid, {
          ingredientId: ing.id,
          ingredientName: ing.name,
          isBacteria,
          stockCfuPerG: ing.stock_cfu_per_g,
          costPerKgGbp: ing.cost_per_kg_gbp,
          fillerMode: "fixed",
          showNewIngredient: false,
          newIngId: "",
          newIngName: "",
          newIngStockCfu: "",
          newIngCostPerKg: "",
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to create ingredient");
      }
    },
    [updateLine]
  );

  const persistIngredientCost = useCallback(
    async (ingredientId: string, rawValue: string) => {
      const parsed = parseNumberInput(rawValue);
      if (Number.isNaN(parsed) || parsed < 0) {
        setError("Cost/kg must be a valid non-negative number.");
        return;
      }
      try {
        const updated = await updateIngredientCostPerKgAction(ingredientId, parsed);
        if (!updated) return;
        setIngredients((prev) =>
          prev.map((ing) => (ing.id === ingredientId ? { ...ing, cost_per_kg_gbp: parsed } : ing))
        );
        setLines((prev) =>
          prev.map((l) => (l.ingredientId === ingredientId ? { ...l, costPerKgGbp: parsed } : l))
        );
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to update ingredient cost");
      }
    },
    []
  );

  const beginCostEdit = useCallback((uid: string, currentValue: number) => {
    setCostDraftByLineUid((prev) => ({ ...prev, [uid]: String(currentValue) }));
  }, []);

  const setCostDraft = useCallback((uid: string, rawValue: string) => {
    setCostDraftByLineUid((prev) => ({ ...prev, [uid]: rawValue }));
  }, []);

  const commitCostEdit = useCallback(
    async (line: BuilderLine) => {
      const raw = costDraftByLineUid[line.uid] ?? String(line.costPerKgGbp);
      const parsed = parseNumberInput(raw);
      if (Number.isNaN(parsed) || parsed < 0) {
        setError("Cost/kg must be a valid non-negative number.");
        setCostDraftByLineUid((prev) => {
          const next = { ...prev };
          delete next[line.uid];
          return next;
        });
        return;
      }
      updateLine(line.uid, { costPerKgGbp: parsed });
      if (line.ingredientId) {
        await persistIngredientCost(line.ingredientId, raw);
      }
      setCostDraftByLineUid((prev) => {
        const next = { ...prev };
        delete next[line.uid];
        return next;
      });
    },
    [costDraftByLineUid, persistIngredientCost, updateLine]
  );

  const addRow = useCallback(() => setLines((prev) => [...prev, emptyBuilderLine()]), []);
  const removeRow = useCallback(
    (uid: string) => setLines((prev) => prev.filter((l) => l.uid !== uid)),
    []
  );

  const handleSave = useCallback(async () => {
    setError(null);
    const name = recipeName.trim();
    if (!name) {
      setError("Recipe name is required.");
      return;
    }
    const batchKg = parseNumberInput(batchSizeKg);
    if (Number.isNaN(batchKg) || batchKg <= 0) {
      setError("Default batch size must be a positive number.");
      return;
    }
    const batchGrams = batchKg * 1000;
    const kgPerSet = parseNumberInput(defaultKgPerSet);
    if (Number.isNaN(kgPerSet) || kgPerSet <= 0) {
      setError("Default kg per set must be a positive number.");
      return;
    }
    const validLines = lines.filter((l) => l.ingredientId != null);
    if (validLines.length === 0) {
      setError("Add at least one ingredient row.");
      return;
    }

    const lineInputs = validLines.map((l, idx) => {
      const targetCfu = parseNumberInput(l.targetTotalCfu) || 0;
      const defaultGrams = l.isBacteria
        ? l.stockCfuPerG > 0
          ? targetCfu / l.stockCfuPerG
          : 0
        : parseNumberInput(l.defaultGrams) || 0;
      return {
        ingredientId: l.ingredientId!,
        sortOrder: idx + 1,
        targetTotalCfu: targetCfu,
        defaultGrams,
        fillerMode: l.fillerMode,
        fillerRatio: l.fillerMode === "ratio" ? parseNumberInput(l.fillerRatio) || 0 : 0,
      };
    });

    const savePreview = calculate(batchGrams, batchGrams, previewLineInputs);
    if (!savePreview.formulaValid) {
      setError(savePreview.error ?? "Formula is invalid.");
      return;
    }

    setSaving(true);
    try {
      if (isEditMode) {
        await updateRecipeAction(existingRecipe!.id, name, batchGrams, lineInputs, kgPerSet);
        router.push(`/recipes/${existingRecipe!.id}`);
      } else {
        const result = await createRecipeAction(name, batchGrams, lineInputs, kgPerSet);
        router.push(`/recipes/${result.id}`);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : isEditMode
            ? "Failed to update recipe"
            : "Failed to create recipe"
      );
      setSaving(false);
    }
  }, [
    batchSizeKg,
    defaultKgPerSet,
    existingRecipe,
    isEditMode,
    lines,
    previewLineInputs,
    recipeName,
    router,
  ]);

  return (
    <div className="space-y-6">
      <RecipeMetaForm
        recipeName={recipeName}
        setRecipeName={setRecipeName}
        batchSizeKg={batchSizeKg}
        setBatchSizeKg={setBatchSizeKg}
        defaultKgPerSet={defaultKgPerSet}
        setDefaultKgPerSet={setDefaultKgPerSet}
      />

      {error && (
        <div
          role="alert"
          className="rounded-xl border-2 border-red-300 bg-red-50 px-5 py-4 shadow-sm dark:border-red-800 dark:bg-red-950"
        >
          <p className="text-sm font-bold text-red-800 dark:text-red-200">Error</p>
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <IngredientLinesTable
        lines={lines}
        ingredients={ingredients}
        isEditMode={isEditMode}
        highlightedLineUids={highlightedLineUids}
        costDraftByLineUid={costDraftByLineUid}
        updateLine={updateLine}
        removeRow={removeRow}
        onIngredientSelect={handleIngredientSelect}
        onCreateIngredient={handleCreateIngredient}
        onBeginCostEdit={beginCostEdit}
        onCostDraftChange={setCostDraft}
        onCommitCostEdit={commitCostEdit}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={addRow} className={btnSecondary}>
          + Add Row
        </button>
        {isEditMode && existingRecipe ? (
          <Link href={`/recipes/${existingRecipe.id}`} className={btnSecondary}>
            Cancel
          </Link>
        ) : (
          <Link href="/recipes" className={btnSecondary}>
            Cancel
          </Link>
        )}
        <button type="button" onClick={handleSave} disabled={saving} className={btnPrimary}>
          {saving ? "Saving..." : isEditMode ? "Update Formula" : "Save Formula"}
        </button>
      </div>

      <RecipePreview
        previewBatchGrams={previewBatchGrams}
        previewLineInputs={previewLineInputs}
        previewResult={previewResult}
        previewResultByLineId={previewResultByLineId}
        previewTotalFinalCfuPerGram={previewTotalFinalCfuPerGram}
      />
    </div>
  );
}
