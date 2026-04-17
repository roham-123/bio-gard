"use server";

import {
  getRecipe as dalGetRecipe,
  getIngredients as dalGetIngredients,
  createIngredient as dalCreateIngredient,
  updateIngredientCostPerKg as dalUpdateIngredientCostPerKg,
  createRecipe as dalCreateRecipe,
  updateRecipe as dalUpdateRecipe,
  getPackagingItems as dalGetPackagingItems,
  createPackagingItem as dalCreatePackagingItem,
  saveRecipePackagingLines as dalSaveRecipePackagingLines,
  createPurchaseOrder as dalCreatePurchaseOrder,
  getPurchaseOrders as dalGetPurchaseOrders,
  getStockSummary as dalGetStockSummary,
  type CreateRecipeLineInput,
  type CreateRecipePackagingLineInput,
} from "@/lib/db";

export async function getRecipe(recipeId: number) {
  return dalGetRecipe(recipeId);
}

export async function getIngredientsAction() {
  return dalGetIngredients();
}

export async function createIngredientAction(
  id: string,
  name: string,
  stockCfuPerG: number,
  costPerKgGbp: number
) {
  return dalCreateIngredient(id, name, stockCfuPerG, costPerKgGbp);
}

export async function updateIngredientCostPerKgAction(
  ingredientId: string,
  costPerKgGbp: number
) {
  return dalUpdateIngredientCostPerKg(ingredientId, costPerKgGbp);
}

export async function createRecipeAction(
  name: string,
  defaultBatchGrams: number,
  lines: CreateRecipeLineInput[],
  defaultKgPerSet = 1
) {
  return dalCreateRecipe(name, defaultBatchGrams, lines, defaultKgPerSet);
}

export async function updateRecipeAction(
  recipeId: number,
  name: string,
  defaultBatchGrams: number,
  lines: CreateRecipeLineInput[],
  defaultKgPerSet = 1
) {
  return dalUpdateRecipe(recipeId, name, defaultBatchGrams, lines, defaultKgPerSet);
}

export async function getPackagingItemsAction() {
  return dalGetPackagingItems();
}

export async function createPackagingItemAction(
  code: string,
  name: string,
  defaultCostGbp: number,
  defaultCostBasis: string
) {
  return dalCreatePackagingItem(code, name, defaultCostGbp, defaultCostBasis);
}

export async function saveRecipePackagingLinesAction(
  recipeId: number,
  lines: CreateRecipePackagingLineInput[]
) {
  return dalSaveRecipePackagingLines(recipeId, lines);
}

export async function createPurchaseOrderAction(
  recipeId: number,
  recipeName: string,
  batchGrams: number,
  units: number,
  detail: Record<string, unknown>
) {
  return dalCreatePurchaseOrder(recipeId, recipeName, batchGrams, units, detail);
}

export async function getPurchaseOrdersAction(filters?: {
  search?: string;
  from?: string;
  to?: string;
}) {
  return dalGetPurchaseOrders(filters);
}

export async function getStockSummaryAction(filters?: {
  from?: string;
  to?: string;
}) {
  return dalGetStockSummary(filters);
}
