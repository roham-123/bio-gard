"use server";

import {
  getRecipe as dalGetRecipe,
  getIngredients as dalGetIngredients,
  createIngredient as dalCreateIngredient,
  updateIngredientCostPerKg as dalUpdateIngredientCostPerKg,
  createRecipe as dalCreateRecipe,
  updateRecipe as dalUpdateRecipe,
  type CreateRecipeLineInput,
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
