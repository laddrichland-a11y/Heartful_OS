"use client";

import { useState } from "react";
import { Upload, FileAudio } from "@/components/ui/HeartfulIcon";

export default function TranscriptInput({
  value,
  onChange,
  label = "Transcript",
  hideLabel = false,
  inlineUploadActions = false,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  hideLabel?: boolean;
  /** Hide the label without lifting upload actions into a preceding header. */
  inlineUploadActions?: boolean;
}) {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className={hideLabel && !inlineUploadActions ? "transcript-input transcript-input--heading-actions space-y-2" : "transcript-input space-y-2"}>
      <div className="flex items-center justify-between">
        {!hideLabel && <label className="text-sm font-medium text-ink-800">{label}</label>}
        <div className="transcript-upload-actions flex items-center gap-2">
          <label className="btn-ghost text-xs flex items-center gap-2 px-2 py-1 cursor-pointer">
            <Upload className="h-3.5 w-3.5" /> Upload transcript
            <input
              type="file"
              className="hidden"
              accept=".txt,.pdf,.doc,.docx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFileName(f.name);
                  if (f.type === "text/plain") {
                    f.text().then(onChange);
                  } else {
                    onChange(`[Uploaded file: ${f.name} — content extraction simulated for demo]`);
                  }
                }
              }}
            />
          </label>
          <label className="btn-ghost text-xs flex items-center gap-2 px-2 py-1 cursor-pointer">
            <FileAudio className="h-3.5 w-3.5" /> Upload recording
            <input type="file" className="hidden" accept="audio/*,video/*" onChange={() => undefined} />
          </label>
        </div>
      </div>
      {fileName && <div className="text-xs text-ink-400">Loaded: {fileName}</div>}
      <textarea
        aria-label={hideLabel ? label : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        placeholder="Paste the session transcript here, or upload a file above..."
        className="w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
      />
    </div>
  );
}
