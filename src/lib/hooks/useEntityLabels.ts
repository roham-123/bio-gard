"use client";

import { useCallback, useMemo, useState } from "react";

type LabelLike = {
  id: number;
  file_name: string;
  mime_type: "image/jpeg" | "image/png" | "application/pdf";
  blob_url: string;
};

type DeleteTarget = { id: number; file_name: string } | null;

type Options<T extends LabelLike> = {
  initial: T[];
  upload: (file: File) => Promise<T>;
  remove: (labelId: number) => Promise<unknown>;
};

/**
 * Encapsulates the labels state machine shared by RecipeCalculator and
 * FinishedProductCalculator: list, selection, upload, delete confirmation.
 */
export function useEntityLabels<T extends LabelLike>({ initial, upload, remove }: Options<T>) {
  const [labels, setLabels] = useState<T[]>(initial);
  const [selectedLabelId, setSelectedLabelId] = useState<number | null>(null);
  const [isLabelsModalOpen, setIsLabelsModalOpen] = useState(false);
  const [isUploadingLabel, setIsUploadingLabel] = useState(false);
  const [labelUploadError, setLabelUploadError] = useState<string | null>(null);
  const [labelToDelete, setLabelToDelete] = useState<DeleteTarget>(null);
  const [isDeletingLabel, setIsDeletingLabel] = useState(false);

  const selectedLabel = useMemo(
    () => labels.find((label) => label.id === selectedLabelId) ?? null,
    [labels, selectedLabelId]
  );

  const handleUpload = useCallback(
    async (file: File) => {
      setIsUploadingLabel(true);
      setLabelUploadError(null);
      try {
        const created = await upload(file);
        setLabels((prev) => [created, ...prev]);
      } catch (err) {
        setLabelUploadError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setIsUploadingLabel(false);
      }
    },
    [upload]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!labelToDelete) return;
    setIsDeletingLabel(true);
    setLabelUploadError(null);
    try {
      await remove(labelToDelete.id);
      setLabels((prev) => prev.filter((label) => label.id !== labelToDelete.id));
      setSelectedLabelId((current) => (current === labelToDelete.id ? null : current));
      setLabelToDelete(null);
    } catch (err) {
      setLabelUploadError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setIsDeletingLabel(false);
    }
  }, [labelToDelete, remove]);

  const openModal = useCallback(() => setIsLabelsModalOpen(true), []);
  const closeModal = useCallback(() => setIsLabelsModalOpen(false), []);
  const cancelDelete = useCallback(() => setLabelToDelete(null), []);

  return {
    labels,
    selectedLabel,
    selectedLabelId,
    setSelectedLabelId,
    isLabelsModalOpen,
    openModal,
    closeModal,
    isUploadingLabel,
    labelUploadError,
    handleUpload,
    labelToDelete,
    setLabelToDelete,
    cancelDelete,
    isDeletingLabel,
    handleConfirmDelete,
  };
}
