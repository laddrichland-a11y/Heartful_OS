"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "@/components/ui/HeartfulIcon";

/** Adds an uploaded file's text to the end of the existing notes, with a
 *  small header so it's clear where that part came from. */
export function appendUploadedText(existing: string, fileName: string, text: string) {
  const block = `--- From uploaded file: ${fileName} ---\n${text}`;
  return existing.trim() ? `${existing.replace(/\s+$/, "")}\n\n${block}` : block;
}

// Upload a transcript / notes file (.txt, .pdf, .docx). The server reads the
// text out of it, and that text is added to the notes box — so it is saved
// with the rest of the notes and is what the AI actually reads.
export default function NotesFileUpload({
  clientId,
  onText,
  label = "Upload transcript",
  className = "btn-ghost text-xs flex items-center gap-2 px-2 py-1 cursor-pointer",
}: {
  clientId: string;
  onText: (text: string, fileName: string) => void;
  label?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.append("clientId", clientId);
      body.append("file", file);
      const res = await fetch("/api/extract-text", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || typeof json.text !== "string") {
        throw new Error(typeof json.error === "string" ? json.error : "That file couldn't be read.");
      }
      onText(json.text, file.name);
      setMessage({ kind: "ok", text: `Added the text from ${file.name}.` });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "That file couldn't be read." });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <label className={className} aria-disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {busy ? "Reading file…" : label}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          disabled={busy}
          accept=".txt,.md,.vtt,.srt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
      </label>
      {message && (
        <span role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "text-xs text-red-600" : "text-xs text-sage-600"}>
          {message.text}
        </span>
      )}
    </span>
  );
}
