"use client";

import { useEffect, useRef } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="confirm-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <h2 id="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-description">{description}</p>
        <div className="confirm-dialog-actions">
          <button ref={cancelRef} type="button" className="btn-secondary" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="confirm-dialog-danger" disabled={busy} onClick={onConfirm}>
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
