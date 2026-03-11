"use server";

import {
  addCfuOption as dalAddCfuOption,
  deleteCfuOption as dalDeleteCfuOption,
  getRecipe as dalGetRecipe,
  updateRecipeLineCost as dalUpdateRecipeLineCost,
  updateRecipeLineDefaultCfuOption as dalUpdateRecipeLineDefaultCfuOption,
  getIngredients as dalGetIngredients,
  getIngredientCfuOptions as dalGetIngredientCfuOptions,
  createIngredient as dalCreateIngredient,
  createRecipe as dalCreateRecipe,
  type CreateRecipeLineInput,
} from "@/lib/db";

export async function addCfuOption(
  ingredientId: number,
  label: string,
  cfuPerGram: number,
  priceGbp?: number | null
) {
  return dalAddCfuOption(ingredientId, label, cfuPerGram, priceGbp ?? null);
}

export async function updateRecipeLineCost(recipeLineId: number, costPerKgGbp: number) {
  return dalUpdateRecipeLineCost(recipeLineId, costPerKgGbp);
}

export async function deleteCfuOption(optionId: number) {
  return dalDeleteCfuOption(optionId);
}

export async function updateRecipeLineDefaultCfuOption(
  recipeLineId: number,
  optionId: number | null
) {
  return dalUpdateRecipeLineDefaultCfuOption(recipeLineId, optionId);
}

export async function getRecipe(recipeId: number) {
  return dalGetRecipe(recipeId);
}

export async function getIngredientsAction() {
  return dalGetIngredients();
}

export async function getIngredientCfuOptionsAction(ingredientId: number) {
  return dalGetIngredientCfuOptions(ingredientId);
}

export async function createIngredientAction(
  name: string,
  isBacteria: boolean,
  code: string | null,
  costPerKgGbp: number
) {
  return dalCreateIngredient(name, isBacteria, code, costPerKgGbp);
}

export async function createRecipeAction(
  name: string,
  defaultBatchGrams: number,
  lines: CreateRecipeLineInput[]
) {
  return dalCreateRecipe(name, defaultBatchGrams, lines);
}
