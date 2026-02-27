"use client";

import { useCallback, useMemo, useState } from "react";
import type { RecipeWithLines } from "@/lib/db";
import {
  calculate,
  recipeToLineInputs,
  getDefaultCfuOption,
  type LineInput,
  type LineResult,
} from "@/lib/calc";
import { formatNumber, formatCfu, formatPercent, formatCurrency, parseScientific } from "@/lib/format";
import { generateRecipePdf } from "@/lib/pdf";
import { addCfuOption, deleteCfuOption, updateRecipeLineCost } from "@/app/actions";

type Props = {
  recipe: RecipeWithLines;
};

export default function RecipeCalculator({ recipe }: Props) {
  const defaultBatchGrams = Number(recipe.default_batch_grams);
  const [batchGrams, setBatchGrams] = useState(defaultBatchGrams);
  const [batchInput, setBatchInput] = useState(String(defaultBatchGrams));
  const [selectedCfu, setSelectedCfu] = useState<Map<number, number>>(new Map());
  const [addCfuLineId, setAddCfuLineId] = useState<number | null>(null);
  const [newCfuLabel, setNewCfuLabel] = useState("");
  const [newCfuPerGram, setNewCfuPerGram] = useState("");
  const [newCfuPrice, setNewCfuPrice] = useState("");
  const [editingCostLineId, setEditingCostLineId] = useState<number | null>(null);
  const [costEditDraft, setCostEditDraft] = useState("");
  const [lineInputs, setLineInputs] = useState<LineInput[]>(() =>
    recipeToLineInputs(recipe)
  );

  const syncBatchFromInput = useCallback(() => {
    const parsed = parseScientific(batchInput);
    if (!Number.isNaN(parsed) && parsed > 0) {
      setBatchGrams(parsed);
      setBatchInput(String(parsed));
    }
  }, [batchInput]);

  const handleBatchBlur = () => syncBatchFromInput();
  const handleBatchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") syncBatchFromInput();
  };

  const selectedCfuMap = useMemo(() => {
    const m = new Map<number, number>();
    lineInputs.forEach((line) => {
      if (line.isBacteria && line.cfuOptions.length) {
        const optId =
          selectedCfu.get(line.lineId) ?? getDefaultCfuOption(line.cfuOptions)?.id;
        if (optId != null) m.set(line.lineId, optId);
      }
    });
    return m;
  }, [lineInputs, selectedCfu]);

  const result = useMemo(() => {
    return calculate(
      batchGrams,
      defaultBatchGrams,
      lineInputs,
      selectedCfuMap
    );
  }, [batchGrams, defaultBatchGrams, lineInputs, selectedCfuMap]);

  const handleAddCfuOption = useCallback(
    async (lineId: number, ingredientId: number) => {
      const cfu = parseScientific(newCfuPerGram);
      if (!newCfuLabel.trim() || Number.isNaN(cfu) || cfu < 0) return;
      const price = newCfuPrice.trim() === "" ? null : parseScientific(newCfuPrice);
      const priceGbp = price != null && !Number.isNaN(price) && price >= 0 ? price : null;
      const added = await addCfuOption(ingredientId, newCfuLabel.trim(), cfu, priceGbp);
      if (added) {
        setLineInputs((prev) =>
          prev.map((l) => {
            if (l.lineId !== lineId) return l;
            return {
              ...l,
              cfuOptions: [
                ...l.cfuOptions,
                {
                  id: added.id,
                  label: added.label,
                  cfu_per_gram: added.cfu_per_gram,
                  is_default: false,
                  price_gbp: added.price_gbp,
                },
              ],
            };
          })
        );
        setSelectedCfu((m) => new Map(m).set(lineId, added.id));
        setAddCfuLineId(null);
        setNewCfuLabel("");
        setNewCfuPerGram("");
        setNewCfuPrice("");
      }
    },
    [newCfuLabel, newCfuPerGram, newCfuPrice]
  );

  const handleDeleteCfuOption = useCallback(
    async (lineId: number, optionId: number) => {
      const line = lineInputs.find((l) => l.lineId === lineId);
      if (!line || line.cfuOptions.length <= 1) return;
      const deleted = await deleteCfuOption(optionId);
      if (deleted) {
        const remaining = line.cfuOptions.filter((o) => o.id !== optionId);
        const newDefault = remaining.find((o) => o.is_default) ?? remaining[0];
        setLineInputs((prev) =>
          prev.map((l) => {
            if (l.lineId !== lineId) return l;
            return { ...l, cfuOptions: remaining };
          })
        );
        setSelectedCfu((m) => {
          const next = new Map(m);
          if (next.get(lineId) === optionId) next.set(lineId, newDefault?.id ?? 0);
          return next;
        });
      }
    },
    [lineInputs]
  );

  const resultByLineId = useMemo(() => {
    const map = new Map<number, LineResult>();
    result.results.forEach((r) => map.set(r.lineId, r));
    return map;
  }, [result.results]);

  const handleCostEditStart = useCallback((lineId: number, currentCost: number) => {
    setEditingCostLineId(lineId);
    setCostEditDraft(String(currentCost));
  }, []);

  const handleCostEditSave = useCallback(
    (lineId: number) => {
      const n = parseScientific(costEditDraft);
      if (!Number.isNaN(n) && n >= 0) {
        setLineInputs((prev) =>
          prev.map((l) => (l.lineId === lineId ? { ...l, costPerKgGbp: n } : l))
        );
        updateRecipeLineCost(lineId, n);
      }
      setEditingCostLineId(null);
    },
    [costEditDraft]
  );

  const handleCostEditCancel = useCallback(() => {
    setEditingCostLineId(null);
  }, []);

  return (
    <div style={{ padding: "1rem 0" }}>
      <div style={{ marginBottom: "1rem" }}>
        <label>
          Batch size (g):{" "}
          <input
            type="text"
            value={batchInput}
            onChange={(e) => setBatchInput(e.target.value)}
            onBlur={handleBatchBlur}
            onKeyDown={handleBatchKeyDown}
            style={{ width: 140 }}
          />
        </label>
        <span style={{ marginLeft: "0.5rem", opacity: 0.8 }}>
          {batchGrams >= 1000 ? `= ${formatNumber(batchGrams / 1000)} kg` : ""}
        </span>
      </div>

      {result.error && (
        <div
          role="alert"
          style={{
            padding: "0.75rem",
            marginBottom: "1rem",
            background: "rgba(200,0,0,0.15)",
            border: "1px solid #c00",
            borderRadius: 4,
          }}
        >
          {result.error}
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--foreground)" }}>
              <th style={{ textAlign: "left", padding: "0.5rem" }}>Ingredient</th>
              <th style={{ textAlign: "right", padding: "0.5rem" }}>g</th>
              <th style={{ textAlign: "right", padding: "0.5rem" }}>%</th>
              <th style={{ textAlign: "left", padding: "0.5rem" }}>CFU/g</th>
              <th style={{ textAlign: "right", padding: "0.5rem" }}>Target CFU</th>
              <th style={{ textAlign: "right", padding: "0.5rem" }}>Total CFU</th>
              <th style={{ textAlign: "right", padding: "0.5rem" }}>Final CFU/g</th>
              <th style={{ textAlign: "right", padding: "0.5rem" }}>Cost/kg</th>
              <th style={{ textAlign: "right", padding: "0.5rem" }}>Cost</th>
              <th style={{ textAlign: "center", padding: "0.5rem", width: 100 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {lineInputs.map((line) => {
              const res = resultByLineId.get(line.lineId);
              const isBacteria = line.isBacteria;
              const selectedOptId =
                selectedCfu.get(line.lineId) ?? getDefaultCfuOption(line.cfuOptions)?.id;
              const selectedOpt = line.cfuOptions.find((o) => o.id === selectedOptId);
              const showAddCfu = addCfuLineId === line.lineId;

              return (
                <tr key={line.lineId} style={{ borderBottom: "1px solid #ccc" }}>
                  <td style={{ padding: "0.5rem" }}>
                    {line.ingredientCode ? `[${line.ingredientCode}] ` : ""}
                    {line.ingredientName}
                    {res?.warning && (
                      <span style={{ color: "#c00", marginLeft: 4 }} title={res.warning}>
                        ⚠
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: "right", padding: "0.5rem" }}>
                    {res ? formatNumber(res.grams, { maxDecimals: 2 }) : "—"}
                  </td>
                  <td style={{ textAlign: "right", padding: "0.5rem" }}>
                    {res ? formatPercent(res.percent) : "—"}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {isBacteria ? (
                      <div>
                        <select
                          value={selectedOptId ?? ""}
                          onChange={(e) => {
                            const optionId = Number(e.target.value);
                            setSelectedCfu((m) => new Map(m).set(line.lineId, optionId));
                            const opt = line.cfuOptions.find((o) => o.id === optionId);
                            if (opt?.price_gbp != null) {
                              setLineInputs((prev) =>
                                prev.map((l) =>
                                  l.lineId === line.lineId
                                    ? { ...l, costPerKgGbp: opt.price_gbp ?? l.costPerKgGbp }
                                    : l
                                )
                              );
                              updateRecipeLineCost(line.lineId, opt.price_gbp);
                            }
                          }}
                          style={{ minWidth: 120 }}
                        >
                          {line.cfuOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label} ({formatCfu(o.cfu_per_gram)})
                            </option>
                          ))}
                        </select>
                        {line.cfuOptions.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              selectedOptId != null &&
                              handleDeleteCfuOption(line.lineId, selectedOptId)
                            }
                            title="Delete selected CFU option"
                            style={{ marginLeft: 4, fontSize: "0.85rem" }}
                          >
                            Delete option
                          </button>
                        )}
                        {!showAddCfu ? (
                          <button
                            type="button"
                            onClick={() => setAddCfuLineId(line.lineId)}
                            style={{ marginLeft: 4, fontSize: "0.85rem" }}
                          >
                            + Add option
                          </button>
                        ) : (
                          <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                            <input
                              placeholder="Label"
                              value={newCfuLabel}
                              onChange={(e) => setNewCfuLabel(e.target.value)}
                              style={{ width: 80 }}
                            />
                            <input
                              placeholder="CFU/g (e.g. 1e11)"
                              value={newCfuPerGram}
                              onChange={(e) => setNewCfuPerGram(e.target.value)}
                              style={{ width: 100 }}
                            />
                            <input
                              placeholder="Price (£)"
                              value={newCfuPrice}
                              onChange={(e) => setNewCfuPrice(e.target.value)}
                              style={{ width: 90 }}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleAddCfuOption(line.lineId, line.ingredientId)
                              }
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAddCfuLineId(null);
                                setNewCfuLabel("");
                                setNewCfuPerGram("");
                                setNewCfuPrice("");
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ textAlign: "right", padding: "0.5rem" }}>
                    {isBacteria ? formatCfu(line.targetTotalCfu) : "—"}
                  </td>
                  <td style={{ textAlign: "right", padding: "0.5rem" }}>
                    {res ? formatCfu(res.totalCfu) : "—"}
                  </td>
                  <td style={{ textAlign: "right", padding: "0.5rem" }}>
                    {res && res.isBacteria ? formatCfu(res.finalCfuPerGram) : "—"}
                  </td>
                  <td style={{ textAlign: "right", padding: "0.5rem" }}>
                    {editingCostLineId === line.lineId ? (
                      <input
                        type="text"
                        value={costEditDraft}
                        onChange={(e) => setCostEditDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCostEditSave(line.lineId);
                          if (e.key === "Escape") handleCostEditCancel();
                        }}
                        style={{ width: 72, textAlign: "right" }}
                        autoFocus
                      />
                    ) : (
                      formatCurrency(line.costPerKgGbp)
                    )}
                  </td>
                  <td style={{ textAlign: "right", padding: "0.5rem" }}>
                    {res ? formatCurrency(res.costInProduct) : "—"}
                  </td>
                  <td style={{ textAlign: "center", padding: "0.5rem" }}>
                    {editingCostLineId === line.lineId ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCostEditSave(line.lineId)}
                          style={{ marginRight: 4, fontSize: "0.85rem" }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={handleCostEditCancel}
                          style={{ fontSize: "0.85rem" }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleCostEditStart(line.lineId, line.costPerKgGbp)}
                        style={{ fontSize: "0.85rem" }}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: "1rem",
          padding: "0.75rem",
          background: "var(--background)",
          border: "1px solid var(--foreground)",
          borderRadius: 4,
        }}
      >
        <p>
          <strong>Total grams:</strong> {formatNumber(result.totalGrams, { maxDecimals: 2 })}{" "}
          (batch: {formatNumber(batchGrams, { maxDecimals: 2 })} g)
        </p>
        <p>
          <strong>Total CFU:</strong> {formatCfu(result.totalCfu)}
        </p>
        <p>
          <strong>Total cost:</strong> {formatCurrency(result.totalCost)}
        </p>
        <p>
          <strong>Cost per kg:</strong> {formatCurrency(result.costPerKg)}
        </p>
        <p style={{ marginTop: "0.75rem" }}>
          <button
            type="button"
            onClick={() =>
              generateRecipePdf(recipe.name, batchGrams, result.results, {
                totalGrams: result.totalGrams,
                totalCfu: result.totalCfu,
                totalCost: result.totalCost,
                costPerKg: result.costPerKg,
              })
            }
            style={{ padding: "0.5rem 1rem", fontSize: "1rem" }}
          >
            Generate PDF
          </button>
        </p>
      </div>
    </div>
  );
}
