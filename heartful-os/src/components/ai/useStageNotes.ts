"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveStageNotesAction } from "@/lib/actions";
import type { StageNotesKey } from "@/lib/types";
import type { NotesSaveState } from "@/components/ai/TranscriptInput";

const AUTOSAVE_DELAY_MS = 1000;

/**
 * The notes box on a stage page, saved to the client record as you type.
 * Replaces the old browser-only (localStorage) draft that was wiped after
 * every Generate click and never reached the client record.
 *
 * `flush()` saves immediately — call it before generating so the saved copy
 * always matches what the AI was given.
 */
export function useStageNotes(clientId: string, stage: StageNotesKey, initialContent: string) {
  const [notes, setNotesState] = useState(initialContent);
  const [saveState, setSaveState] = useState<NotesSaveState>("idle");
  const latest = useRef(initialContent);
  const lastSaved = useRef(initialContent);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const content = latest.current;
    if (content === lastSaved.current) return true;
    setSaveState("saving");
    try {
      await saveStageNotesAction(clientId, stage, content);
      lastSaved.current = content;
      setSaveState(latest.current === content ? "saved" : "saving");
      return true;
    } catch {
      setSaveState("error");
      return false;
    }
  }, [clientId, stage]);

  const setNotes = useCallback((value: string) => {
    latest.current = value;
    setNotesState(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void save(); }, AUTOSAVE_DELAY_MS);
  }, [save]);

  // Save anything pending if the practitioner navigates away mid-typing.
  useEffect(() => () => {
    if (timer.current && latest.current !== lastSaved.current) {
      clearTimeout(timer.current);
      void saveStageNotesAction(clientId, stage, latest.current).catch(() => undefined);
    }
  }, [clientId, stage]);

  // Warn before closing the tab while something is unsaved.
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (latest.current !== lastSaved.current) event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return { notes, setNotes, saveState, flush: save };
}
