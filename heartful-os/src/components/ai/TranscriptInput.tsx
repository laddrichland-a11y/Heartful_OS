"use client";

import NotesFileUpload, { appendUploadedText } from "@/components/ai/NotesFileUpload";
import { RecordingsSection, useRecordings } from "@/components/ai/RecordingsPanel";
import type { Recording, StageNotesKey } from "@/lib/types";

export type NotesSaveState = "idle" | "saving" | "saved" | "error";

export default function TranscriptInput({
  clientId,
  value,
  onChange,
  label = "Transcript",
  hideLabel = false,
  inlineUploadActions = false,
  saveState,
  stage,
  initialRecordings = [],
}: {
  clientId: string;
  value: string;
  onChange: (v: string) => void;
  label?: string;
  hideLabel?: boolean;
  /** Hide the label without lifting upload actions into a preceding header. */
  inlineUploadActions?: boolean;
  /** Autosave status shown under the box (see useStageNotes). */
  saveState?: NotesSaveState;
  /** Stage page this box belongs to — recordings uploaded here are kept on that stage. */
  stage: StageNotesKey;
  initialRecordings?: Recording[];
}) {
  const rec = useRecordings(clientId, { stage }, initialRecordings);
  return (
    <div className={hideLabel && !inlineUploadActions ? "transcript-input transcript-input--heading-actions space-y-2" : "transcript-input space-y-2"}>
      <div className="flex items-center justify-between">
        {!hideLabel && <label className="text-sm font-medium text-ink-800">{label}</label>}
        <div className="transcript-upload-actions flex items-center gap-2">
          <NotesFileUpload clientId={clientId} onText={(text, fileName) => onChange(appendUploadedText(value, fileName, text))} />
        </div>
      </div>
      <textarea
        aria-label={hideLabel ? label : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        placeholder="Type or paste your notes / the session transcript here, or upload a .txt, .pdf or .docx file above…"
        className="w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
      />
      {saveState && saveState !== "idle" && (
        <p
          role={saveState === "error" ? "alert" : "status"}
          className={saveState === "error" ? "text-xs text-red-600" : "text-xs text-ink-400"}
        >
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "Saved to the client record"}
          {saveState === "error" && "Couldn't save — check your connection. Your text is still here; keep this page open."}
        </p>
      )}
      <RecordingsSection
        busy={rec.busy}
        error={rec.error}
        recordings={rec.recordings}
        onFile={rec.upload}
        onPlay={rec.play}
        onRemove={rec.remove}
      />
    </div>
  );
}
