import type { PoolClient } from "pg";
import { withClient, isMissingTableError } from "./client";
import { logAction } from "./audit";

export type LabelMimeType = "image/jpeg" | "image/png" | "application/pdf";

export type RecipeLabel = {
  id: number;
  recipe_id: number;
  file_name: string;
  mime_type: LabelMimeType;
  blob_url: string;
  created_at: string;
};

export type FinishedProductLabel = {
  id: number;
  finished_product_id: number;
  file_name: string;
  mime_type: LabelMimeType;
  blob_url: string;
  created_at: string;
};

type LabelKind = "recipe" | "finished_product";

type LabelConfig = {
  table: string;
  fkColumn: string;
  entityType: string;
  migrationFile: string;
};

const CONFIG: Record<LabelKind, LabelConfig> = {
  recipe: {
    table: "recipe_labels",
    fkColumn: "recipe_id",
    entityType: "recipe_labels",
    migrationFile: "db/migrate-recipe-labels.sql",
  },
  finished_product: {
    table: "finished_product_labels",
    fkColumn: "finished_product_id",
    entityType: "finished_product_labels",
    migrationFile: "db/migrate-finished-product-labels.sql",
  },
};

type LabelRow = {
  id: number;
  file_name: string;
  mime_type: LabelMimeType;
  blob_url: string;
  created_at: string;
} & Record<string, number | string>;

function migrationError(cfg: LabelConfig, op: "uploads" | "deletes" | "queries"): Error {
  const prefix =
    cfg.entityType === "finished_product_labels" ? "Finished product label" : "Label";
  return new Error(`${prefix} ${op} require DB migration: run ${cfg.migrationFile}`);
}

/**
 * Fetch labels for an entity. Returns [] if the labels table doesn't exist
 * yet (so the rest of the page still loads pre-migration).
 */
export async function fetchLabels<T>(
  client: PoolClient,
  kind: LabelKind,
  entityId: number,
  mapRow: (row: LabelRow) => T
): Promise<T[]> {
  const cfg = CONFIG[kind];
  try {
    const r = await client.query<LabelRow>(
      `SELECT id, ${cfg.fkColumn}, file_name, mime_type, blob_url, created_at
       FROM ${cfg.table}
       WHERE ${cfg.fkColumn} = $1
       ORDER BY created_at DESC`,
      [entityId]
    );
    return r.rows.map(mapRow);
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}

async function createLabel(
  kind: LabelKind,
  entityId: number,
  fileName: string,
  mimeType: LabelMimeType,
  blobUrl: string
): Promise<LabelRow> {
  const cfg = CONFIG[kind];
  return withClient(async (client) => {
    let r;
    try {
      r = await client.query<LabelRow>(
        `INSERT INTO ${cfg.table} (${cfg.fkColumn}, file_name, mime_type, blob_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id, ${cfg.fkColumn}, file_name, mime_type, blob_url, created_at`,
        [entityId, fileName, mimeType, blobUrl]
      );
    } catch (error) {
      if (isMissingTableError(error)) throw migrationError(cfg, "uploads");
      throw error;
    }
    const row = r.rows[0];
    await logAction(client, `create_${kind}_label`, cfg.entityType, row.id, {
      [cfg.fkColumn]: entityId,
      file_name: fileName,
      mime_type: mimeType,
      blob_url: blobUrl,
    });
    return row;
  });
}

async function deleteLabel(kind: LabelKind, labelId: number): Promise<LabelRow | null> {
  const cfg = CONFIG[kind];
  return withClient(async (client) => {
    let r;
    try {
      r = await client.query<LabelRow>(
        `DELETE FROM ${cfg.table}
         WHERE id = $1
         RETURNING id, ${cfg.fkColumn}, file_name, mime_type, blob_url, created_at`,
        [labelId]
      );
    } catch (error) {
      if (isMissingTableError(error)) throw migrationError(cfg, "deletes");
      throw error;
    }
    const row = r.rows[0];
    if (!row) return null;
    await logAction(client, `delete_${kind}_label`, cfg.entityType, row.id, {
      [cfg.fkColumn]: row[cfg.fkColumn],
      file_name: row.file_name,
      mime_type: row.mime_type,
      blob_url: row.blob_url,
    });
    return row;
  });
}

function toRecipeLabel(row: LabelRow): RecipeLabel {
  return {
    id: row.id,
    recipe_id: Number(row.recipe_id),
    file_name: row.file_name,
    mime_type: row.mime_type,
    blob_url: row.blob_url,
    created_at: row.created_at,
  };
}

function toFinishedProductLabel(row: LabelRow): FinishedProductLabel {
  return {
    id: row.id,
    finished_product_id: Number(row.finished_product_id),
    file_name: row.file_name,
    mime_type: row.mime_type,
    blob_url: row.blob_url,
    created_at: row.created_at,
  };
}

export async function createRecipeLabel(
  recipeId: number,
  fileName: string,
  mimeType: LabelMimeType,
  blobUrl: string
): Promise<RecipeLabel> {
  return toRecipeLabel(await createLabel("recipe", recipeId, fileName, mimeType, blobUrl));
}

export async function deleteRecipeLabel(labelId: number): Promise<RecipeLabel | null> {
  const row = await deleteLabel("recipe", labelId);
  return row ? toRecipeLabel(row) : null;
}

export async function createFinishedProductLabel(
  finishedProductId: number,
  fileName: string,
  mimeType: LabelMimeType,
  blobUrl: string
): Promise<FinishedProductLabel> {
  return toFinishedProductLabel(
    await createLabel("finished_product", finishedProductId, fileName, mimeType, blobUrl)
  );
}

export async function deleteFinishedProductLabel(
  labelId: number
): Promise<FinishedProductLabel | null> {
  const row = await deleteLabel("finished_product", labelId);
  return row ? toFinishedProductLabel(row) : null;
}

export const labelMappers = {
  recipe: toRecipeLabel,
  finished_product: toFinishedProductLabel,
};
