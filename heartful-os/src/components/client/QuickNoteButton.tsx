"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, StickyNote, X } from "@/components/ui/HeartfulIcon";
import { addClientQuickNoteAction } from "@/lib/actions";
import { formatDateTime } from "@/lib/utils";

export default function QuickNoteButton({
  clientId,
  clientName,
  compact = false,
}: {
  clientId: string;
  clientName: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [openedAt, setOpenedAt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    textareaRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) setOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, saving]);

  function openComposer() {
    setContent("");
    setError("");
    setSaved(false);
    setOpenedAt(new Date().toISOString());
    setOpen(true);
  }

  function closeComposer() {
    if (saving) return;
    setOpen(false);
    setError("");
  }

  async function saveNote() {
    if (!content.trim() || saving) return;
    setSaving(true);
    setError("");

    try {
      await addClientQuickNoteAction(clientId, content);
      setSaved(true);
      setShowSuccess(true);
      router.refresh();
      window.setTimeout(() => {
        setOpen(false);
        setSaved(false);
      }, 650);
      window.setTimeout(() => setShowSuccess(false), 2600);
    } catch {
      setError("The note couldn’t be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openComposer}
        className={`btn-secondary wn-quick-note-button text-xs px-3 py-1.5 flex items-center gap-1.5${compact ? " is-compact" : ""}`}
        aria-label={compact ? `Add a quick note for ${clientName}` : undefined}
        title={compact ? "Quick note" : undefined}
      >
        <StickyNote className="h-3.5 w-3.5" /> <span>Quick note</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeComposer();
          }}
        >
          <div className="card w-full max-w-lg bg-white p-6" role="dialog" aria-modal="true" aria-labelledby="quick-note-title">
            {saved ? (
              <div className="flex min-h-40 flex-col items-center justify-center text-center" role="status">
                <CheckCircle2 className="mb-3 h-8 w-8 text-green-600" />
                <h2 className="font-medium text-ink-900">Note saved</h2>
                <p className="mt-1 text-sm text-ink-500">Added to {clientName}&apos;s history.</p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 id="quick-note-title" className="flex items-center gap-2 font-medium text-ink-900">
                      <StickyNote className="h-4 w-4 text-clay-500" /> Quick note
                    </h2>
                    <p className="mt-1 text-xs text-ink-400">
                      For {clientName} · {openedAt ? formatDateTime(openedAt) : "Now"}
                    </p>
                  </div>
                  <button type="button" className="btn-ghost p-1" onClick={closeComposer} aria-label="Close quick note">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <label htmlFor="quick-note-content" className="text-xs font-medium text-ink-500">Note</label>
                <textarea
                  ref={textareaRef}
                  id="quick-note-content"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  rows={6}
                  placeholder="Capture a thought…"
                  className="mt-1 w-full resize-y rounded-xl border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") saveNote();
                  }}
                />
                <p className="mt-1 text-xs text-ink-400">Client and date/time are added automatically.</p>
                {error && <p className="mt-2 text-xs text-red-600" role="alert">{error}</p>}

                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" className="btn-ghost px-3 py-2 text-sm" onClick={closeComposer}>Cancel</button>
                  <button
                    type="button"
                    className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm"
                    disabled={!content.trim() || saving}
                    onClick={saveNote}
                  >
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {saving ? "Saving…" : "Save note"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showSuccess && !open && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-green-200 bg-white px-4 py-3 text-sm font-medium text-ink-700 shadow-lg" role="status">
          <CheckCircle2 className="h-4 w-4 text-green-600" /> Note saved to client history
        </div>
      )}
    </>
  );
}
