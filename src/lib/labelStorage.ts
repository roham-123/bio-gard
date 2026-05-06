import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";

export type LabelKind = "recipe" | "finished_product";

export type LabelMimeType = "image/jpeg" | "image/png" | "application/pdf";

const ALLOWED_MIME_TYPES = new Set<LabelMimeType>([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);

const MAX_BYTES = 50 * 1024 * 1024;

const STORAGE_PREFIX: Record<LabelKind, string> = {
  recipe: "recipe-labels",
  finished_product: "finished-product-labels",
};

const ENTITY_LABEL: Record<LabelKind, string> = {
  recipe: "recipe",
  finished_product: "finished product",
};

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function isProductionRuntime(): boolean {
  return Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
}

/**
 * Validate the uploaded file and persist it (Vercel Blob in prod, local FS in dev).
 * Returns the canonical URL the file is reachable at.
 */
export async function uploadLabelFile(
  kind: LabelKind,
  entityId: number,
  file: File
): Promise<{ url: string; mimeType: LabelMimeType }> {
  if (!file) throw new Error("No file selected.");
  if (!Number.isFinite(entityId) || entityId <= 0) {
    throw new Error(`Invalid ${ENTITY_LABEL[kind]} ID.`);
  }
  if (!ALLOWED_MIME_TYPES.has(file.type as LabelMimeType)) {
    throw new Error("Unsupported file type. Use JPG, PNG, or PDF.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("File is too large. Maximum size is 50MB.");
  }

  const mimeType = file.type as LabelMimeType;
  const safeName = safeFileName(file.name);
  const key = `${STORAGE_PREFIX[kind]}/${entityId}/${Date.now()}-${safeName}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const blob = await put(key, file, {
        access: "public",
        contentType: mimeType,
        addRandomSuffix: false,
      });
      return { url: blob.url, mimeType };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("BLOB_READ_WRITE_TOKEN")) {
        throw new Error(
          "Vercel Blob is not configured. Set BLOB_READ_WRITE_TOKEN in your environment variables (.env.local for local dev, Vercel project settings for production)."
        );
      }
      throw error;
    }
  }

  if (isProductionRuntime()) {
    // Local-FS fallback can't work on Vercel (read-only filesystem). Fail loudly.
    throw new Error(
      "File uploads are not configured. Set BLOB_READ_WRITE_TOKEN in the Vercel project's Environment Variables."
    );
  }

  const relativeDir = path.join("uploads", STORAGE_PREFIX[kind], String(entityId));
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);
  await mkdir(absoluteDir, { recursive: true });
  const fileName = `${Date.now()}-${safeName}`;
  const absoluteFilePath = path.join(absoluteDir, fileName);
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absoluteFilePath, fileBuffer);
  const url = `/${relativeDir}/${fileName}`.replaceAll("\\", "/");
  return { url, mimeType };
}

/**
 * Best-effort cleanup of a label asset's underlying file. Errors are logged
 * but never re-thrown — DB row deletion is the source of truth.
 */
export async function deleteLabelFile(blobUrl: string): Promise<void> {
  try {
    if (blobUrl.startsWith("/uploads/")) {
      const absolutePath = path.join(process.cwd(), "public", blobUrl.replace(/^\/+/, ""));
      await unlink(absolutePath);
    } else if (process.env.BLOB_READ_WRITE_TOKEN) {
      await del(blobUrl);
    }
  } catch (error) {
    console.error("Label file cleanup failed:", error);
  }
}
