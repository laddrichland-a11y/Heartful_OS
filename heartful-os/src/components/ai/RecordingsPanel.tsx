"use client";

import { useRef, useState } from "react";
import {
  addRecordingForAction,
  createRecordingUploadForAction,
  deleteClientRecordingAction,
  getRecordingDownloadUrlAction,
} from "@/lib/actions";
import type { Recording, StageNotesKey } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { FileAudio, Loader2, Music, Trash2 } from "@/components/ui/HeartfulIcon";

function formatBytes(bytes?: number): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function useRecordings(
  clientId: string,
  target: { sessionId: string } | { stage: StageNotesKey },
  initialRecordings: Recording[],
) {
  const [recordings, setRecordings] = useState(initialRecordings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setBusy(true);
    try {
      const contentType = file.type || "application/octet-stream";
      const result = await createRecordingUploadForAction(clientId, target, file.name, contentType);
      if (!result) {
        setError("Recording storage isn't set up yet — ask your admin to finish the Firebase Storage setup.");
        return;
      }
      const putRes = await fetch(result.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
      if (!putRes.ok) {
        setError("The upload didn't go through — check your connection and try again.");
        return;
      }
      const recording = await addRecordingForAction(clientId, target, file.name, result.storagePath, file.size);
      setRecordings((prev) => [recording, ...prev]);
    } catch {
      setError("The upload didn't go through — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function play(rec: Recording) {
    const url = await getRecordingDownloadUrlAction(rec.storage_path);
    if (url) window.open(url, "_blank");
    else setError("That recording couldn't be opened.");
  }

  async function remove(rec: Recording) {
    if (!window.confirm(`Delete "${rec.file_name ?? "this recording"}"? This can't be undone.`)) return;
    try {
      await deleteClientRecordingAction(clientId, rec.id);
      setRecordings((prev) => prev.filter((r) => r.id !== rec.id));
    } catch {
      setError("That recording couldn't be deleted — try again.");
    }
  }

  return { recordings, busy, error, upload, play, remove };
}

/** The "Upload recording" button — audio or video of the session, kept on the record. */
export function RecordingUploadButton({
  busy,
  onFile,
  className = "btn-ghost text-xs flex items-center gap-2 px-2 py-1 cursor-pointer",
  label = "Upload recording",
}: {
  busy: boolean;
  onFile: (file: File) => void;
  className?: string;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <label className={className} aria-disabled={busy}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileAudio className="h-3.5 w-3.5" />}
      {busy ? "Uploading…" : label}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="audio/*,video/*"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
    </label>
  );
}

export function RecordingsList({
  recordings,
  error,
  onPlay,
  onRemove,
}: {
  recordings: Recording[];
  error: string | null;
  onPlay: (rec: Recording) => void;
  onRemove: (rec: Recording) => void;
}) {
  if (!error && recordings.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {recordings.map((rec) => (
        <div key={rec.id} className="flex items-center gap-2 text-sm bg-ink-50 rounded-lg px-3 py-2">
          <Music className="h-3.5 w-3.5 text-ink-400 shrink-0" />
          <span className="text-ink-800 truncate">{rec.file_name ?? "Recording"}</span>
          <span className="text-xs text-ink-400 shrink-0">{formatBytes(rec.size_bytes)}</span>
          <span className="text-xs text-ink-400 shrink-0 ml-auto">{formatDateTime(rec.created_at)}</span>
          <button type="button" onClick={() => onPlay(rec)} className="text-xs text-clay-600 hover:text-clay-800 shrink-0">
            Play
          </button>
          <button
            type="button"
            onClick={() => onRemove(rec)}
            className="p-1 rounded hover:bg-ink-100 text-ink-400 hover:text-red-600 shrink-0"
            aria-label={`Delete recording ${rec.file_name ?? ""}`.trim()}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * A clearly labelled "Session Recording" area — heading, one-line explanation,
 * a proper button, and the list of what's already uploaded. Used on every
 * page where a session is worked on, so the upload is never hard to find.
 */
export function RecordingsSection({
  busy,
  error,
  recordings,
  onFile,
  onPlay,
  onRemove,
  showsInPortal = true,
}: {
  busy: boolean;
  error: string | null;
  recordings: Recording[];
  onFile: (file: File) => void;
  onPlay: (rec: Recording) => void;
  onRemove: (rec: Recording) => void;
  showsInPortal?: boolean;
}) {
  return (
    <div className="session-recordings-section space-y-2 rounded-xl border border-ink-100 bg-white/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <Music className="h-4 w-4 text-ink-500" aria-hidden="true" /> Session Recording
          </h4>
          <p className="text-xs text-ink-400">
            Upload the audio or video of this session (MP3, M4A, WAV, MP4, MOV). It&apos;s kept on the client record
            {showsInPortal ? " and the client can play it in their portal." : "."}
          </p>
        </div>
        <RecordingUploadButton
          busy={busy}
          onFile={onFile}
          label="Upload Recording"
          className="btn-secondary inline-flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer"
        />
      </div>
      <RecordingsList recordings={recordings} error={error} onPlay={onPlay} onRemove={onRemove} />
    </div>
  );
}

/** Self-contained recording box for places that don't already manage recordings. */
export function StageRecordingsBox({
  clientId,
  target,
  initialRecordings,
}: {
  clientId: string;
  target: { sessionId: string } | { stage: StageNotesKey };
  initialRecordings: Recording[];
}) {
  const rec = useRecordings(clientId, target, initialRecordings);
  return (
    <RecordingsSection
      busy={rec.busy}
      error={rec.error}
      recordings={rec.recordings}
      onFile={rec.upload}
      onPlay={rec.play}
      onRemove={rec.remove}
    />
  );
}
