"use server";

import * as db from "@/lib/db";
import type {
  CreateFinishedProductInput,
  CreateFinishedProductPackagingLineInput,
  CreateRecipeLineInput,
  CreateRecipePackagingLineInput,
  FinishedProductLabel,
  RecipeLabel,
} from "@/lib/db";
import { deleteLabelFile, uploadLabelFile } from "@/lib/labelStorage";

// Server actions are required to be defined as async function declarations
// (Next.js disallows re-exports in a "use server" module). Each action below
// is a thin pass-through to the underlying DAL function in src/lib/db.

export async function getRecipe(recipeId: number) {
  return db.getRecipe(recipeId);
}

export async function createRecipeAction(
  name: string,
  defaultBatchGrams: number,
  lines: CreateRecipeLineInput[],
  defaultKgPerSet?: number
) {
  return db.createRecipe(name, defaultBatchGrams, lines, defaultKgPerSet);
}

export async function updateRecipeAction(
  recipeId: number,
  name: string,
  defaultBatchGrams: number,
  lines: CreateRecipeLineInput[],
  defaultKgPerSet?: number
) {
  return db.updateRecipe(recipeId, name, defaultBatchGrams, lines, defaultKgPerSet);
}

export async function getIngredientsAction() {
  return db.getIngredients();
}

export async function createIngredientAction(
  id: string,
  name: string,
  stockCfuPerG: number,
  costPerKgGbp: number
) {
  return db.createIngredient(id, name, stockCfuPerG, costPerKgGbp);
}

export async function updateIngredientCostPerKgAction(ingredientId: string, costPerKgGbp: number) {
  return db.updateIngredientCostPerKg(ingredientId, costPerKgGbp);
}

export async function getFinishedProductsAction(filters?: { search?: string }) {
  return db.getFinishedProducts(filters);
}

export async function getFinishedProductAction(productId: number) {
  return db.getFinishedProduct(productId);
}

export async function createFinishedProductAction(input: CreateFinishedProductInput) {
  return db.createFinishedProduct(input);
}

export async function updateFinishedProductAction(
  productId: number,
  input: CreateFinishedProductInput
) {
  return db.updateFinishedProduct(productId, input);
}

export async function saveFinishedProductPackagingLinesAction(
  productId: number,
  lines: CreateFinishedProductPackagingLineInput[]
) {
  return db.saveFinishedProductPackagingLines(productId, lines);
}

export async function getPackagingItemsAction() {
  return db.getPackagingItems();
}

export async function createPackagingItemAction(
  code: string,
  name: string,
  defaultCostGbp: number,
  defaultCostBasis: string
) {
  return db.createPackagingItem(code, name, defaultCostGbp, defaultCostBasis);
}

export async function saveRecipePackagingLinesAction(
  recipeId: number,
  lines: CreateRecipePackagingLineInput[]
) {
  return db.saveRecipePackagingLines(recipeId, lines);
}

export async function createPurchaseOrderAction(
  recipeId: number,
  recipeName: string,
  batchGrams: number,
  units: number,
  detail: Record<string, unknown>
) {
  return db.createPurchaseOrder(recipeId, recipeName, batchGrams, units, detail);
}

export async function createFinishedProductPurchaseOrderAction(
  finishedProductId: number,
  productName: string,
  units: number,
  detail: Record<string, unknown>
) {
  return db.createFinishedProductPurchaseOrder(finishedProductId, productName, units, detail);
}

export async function getPurchaseOrdersAction(filters?: {
  search?: string;
  from?: string;
  to?: string;
}) {
  return db.getPurchaseOrders(filters);
}

export async function getStockSummaryAction(filters?: { from?: string; to?: string }) {
  return db.getStockSummary(filters);
}

export async function getFxSettingsAction() {
  return db.getFxSettings();
}

export async function updateFxSettingsAction(
  mode: "live" | "fixed",
  fixedRates: { EUR: number; PLN: number; USD: number }
) {
  return db.updateFxSettings(mode, fixedRates);
}

async function deleteLabelById<T extends { blob_url: string }>(
  labelId: number,
  deleteRow: (id: number) => Promise<T | null>
): Promise<{ deleted: boolean }> {
  if (!Number.isFinite(labelId) || labelId <= 0) {
    throw new Error("Invalid label ID.");
  }
  const deleted = await deleteRow(labelId);
  if (!deleted) return { deleted: false };
  await deleteLabelFile(deleted.blob_url);
  return { deleted: true };
}

export async function uploadRecipeLabelAction(
  recipeId: number,
  file: File
): Promise<RecipeLabel> {
  const { url, mimeType } = await uploadLabelFile("recipe", recipeId, file);
  return db.createRecipeLabel(recipeId, file.name, mimeType, url);
}

export async function deleteRecipeLabelAction(labelId: number) {
  return deleteLabelById(labelId, db.deleteRecipeLabel);
}

export async function uploadFinishedProductLabelAction(
  productId: number,
  file: File
): Promise<FinishedProductLabel> {
  const { url, mimeType } = await uploadLabelFile("finished_product", productId, file);
  return db.createFinishedProductLabel(productId, file.name, mimeType, url);
}

export async function deleteFinishedProductLabelAction(labelId: number) {
  return deleteLabelById(labelId, db.deleteFinishedProductLabel);
}
