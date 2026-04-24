"use server";

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";
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
  getFxSettings as dalGetFxSettings,
  updateFxSettings as dalUpdateFxSettings,
  createRecipeLabel as dalCreateRecipeLabel,
  deleteRecipeLabel as dalDeleteRecipeLabel,
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

export async function getFxSettingsAction() {
  return dalGetFxSettings();
}

export async function updateFxSettingsAction(
  mode: "live" | "fixed",
  fixedRates: { EUR: number; PLN: number; USD: number }
) {
  return dalUpdateFxSettings(mode, fixedRates);
}

export async function uploadRecipeLabelAction(recipeId: number, file: File) {
  if (!file) {
    throw new Error("No file selected.");
  }
  if (!Number.isFinite(recipeId) || recipeId <= 0) {
    throw new Error("Invalid recipe ID.");
  }

  const allowedMimeTypes = new Set(["image/jpeg", "image/png", "application/pdf"]);
  if (!allowedMimeTypes.has(file.type)) {
    throw new Error("Unsupported file type. Use JPG, PNG, or PDF.");
  }

  const maxBytes = 50 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error("File is too large. Maximum size is 50MB.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `recipe-labels/${recipeId}/${Date.now()}-${safeName}`;
  let fileUrl: string;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    let blob;
    try {
      blob = await put(key, file, {
        access: "public",
        contentType: file.type,
        addRandomSuffix: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("BLOB_READ_WRITE_TOKEN")) {
        throw new Error(
          "Vercel Blob is not configured. Set BLOB_READ_WRITE_TOKEN in your environment variables (.env.local for local dev, Vercel project settings for production)."
        );
      }
      throw error;
    }
    fileUrl = blob.url;
  } else {
    // Local-dev fallback: store under public/uploads when Blob is not configured.
    const relativeDir = path.join("uploads", "recipe-labels", String(recipeId));
    const absoluteDir = path.join(process.cwd(), "public", relativeDir);
    await mkdir(absoluteDir, { recursive: true });
    const fileName = `${Date.now()}-${safeName}`;
    const absoluteFilePath = path.join(absoluteDir, fileName);
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await writeFile(absoluteFilePath, fileBuffer);
    fileUrl = `/${relativeDir}/${fileName}`.replaceAll("\\", "/");
  }

  return dalCreateRecipeLabel(
    recipeId,
    file.name,
    file.type as "image/jpeg" | "image/png" | "application/pdf",
    fileUrl
  );
}

export async function deleteRecipeLabelAction(labelId: number) {
  if (!Number.isFinite(labelId) || labelId <= 0) {
    throw new Error("Invalid label ID.");
  }

  const deleted = await dalDeleteRecipeLabel(labelId);
  if (!deleted) return { deleted: false };

  try {
    if (deleted.blob_url.startsWith("/uploads/")) {
      const absolutePath = path.join(process.cwd(), "public", deleted.blob_url.replace(/^\/+/, ""));
      await unlink(absolutePath);
    } else if (process.env.BLOB_READ_WRITE_TOKEN) {
      await del(deleted.blob_url);
    }
  } catch (error) {
    console.error("Label file cleanup failed:", error);
  }

  return { deleted: true };
}
