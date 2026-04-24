"use client";

import type { RecipeLabel } from "@/lib/db";

type Props = {
  label: RecipeLabel | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DeleteLabelDialog({ label, isDeleting, onCancel, onConfirm }: Props) {
  if (!label) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-600 dark:bg-zinc-800">
        <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
          Delete label?
        </h4>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{label.file_name}</span>?
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">This action cannot be undone.</p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
