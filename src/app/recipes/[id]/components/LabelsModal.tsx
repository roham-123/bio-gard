"use client";

import Image from "next/image";
import type { RecipeLabel } from "@/lib/db";

type Props = {
  open: boolean;
  labels: RecipeLabel[];
  selectedLabelId: number | null;
  isUploading: boolean;
  uploadError: string | null;
  onClose: () => void;
  onSelect: (id: number) => void;
  onUpload: (file: File) => Promise<void>;
  onRequestDelete: (label: RecipeLabel) => void;
};

export default function LabelsModal({
  open,
  labels,
  selectedLabelId,
  isUploading,
  uploadError,
  onClose,
  onSelect,
  onUpload,
  onRequestDelete,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 p-4">
      <div className="w-full max-w-4xl rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-600 dark:bg-zinc-800">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            Labels
          </h3>
          <div className="flex items-center gap-2">
            {selectedLabelId != null && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Done
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
            >
              Close
            </button>
          </div>
        </div>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Upload JPG, PNG, or PDF. Click a label to select it for the purchase order.
        </p>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            disabled={isUploading}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.currentTarget.value = "";
              if (!file) return;
              await onUpload(file);
            }}
            className="text-sm text-zinc-700 file:mr-3 file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-zinc-700 hover:file:bg-zinc-50 dark:text-zinc-300 dark:file:border-zinc-600 dark:file:bg-zinc-700 dark:file:text-zinc-200 dark:hover:file:bg-zinc-600"
          />
          {isUploading && <span className="text-xs text-zinc-500 dark:text-zinc-400">Uploading…</span>}
        </div>
        {uploadError && (
          <p className="mb-3 text-xs font-medium text-red-600 dark:text-red-300">{uploadError}</p>
        )}
        {labels.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-600 dark:text-zinc-400">
            No labels uploaded yet.
          </p>
        ) : (
          <div className="grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
            {labels.map((label) => {
              const isSelected = selectedLabelId === label.id;
              const isImage = label.mime_type === "image/jpeg" || label.mime_type === "image/png";
              return (
                <div
                  key={label.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(label.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(label.id);
                    }
                  }}
                  className={`relative rounded-lg border p-2 text-left transition-colors ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-900/20"
                      : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-700/40 dark:hover:bg-zinc-700"
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRequestDelete(label);
                    }}
                    className="absolute right-2 top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-500 shadow-sm transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                    aria-label={`Delete ${label.file_name}`}
                    title="Delete label"
                  >
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
                      <path d="M6 6L14 14M14 6L6 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                  <div className="mb-2 overflow-hidden rounded border border-zinc-200 bg-white dark:border-zinc-600 dark:bg-zinc-800">
                    {isImage ? (
                      <Image
                        src={label.blob_url}
                        alt={label.file_name}
                        width={640}
                        height={360}
                        className="h-36 w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-36 w-full items-center justify-center text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                        PDF
                      </div>
                    )}
                  </div>
                  <div className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-200">
                    {label.file_name}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
