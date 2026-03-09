"use server";

import {
  addCfuOption as dalAddCfuOption,
  deleteCfuOption as dalDeleteCfuOption,
  getRecipe as dalGetRecipe,
  updateRecipeLineCost as dalUpdateRecipeLineCost,
  updateRecipeLineDefaultCfuOption as dalUpdateRecipeLineDefaultCfuOption,
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
