"use client";

import { useEffect, useRef, useState } from "react";
import { AiSummary, ClientDocument, FormSubmission, FormTemplate, Recording } from "@/lib/types";
import {
  updateSessionManualNotesAction,
  updateSessionTranscriptAction,
  createRecordingUploadUrlAction,
  addRecordingAction,
  getRecordingDownloadUrlAction,
  deleteClientRecordingAction,
  ensureJourneyDaySessionAction,
  setJourneyMarkerAction,
  updateJourneyMarkerTimeAction,
  updateInitialDoseAmountAction,
  updateBoosterDoseAmountAction,
  deleteAiSummaryAction,
  updateAiSummaryAction,
} from "@/lib/actions";
import SummaryCard from "@/components/ai/SummaryCard";
import ActionCardHeader from "@/components/client/ActionCardHeader";
import JourneyTimingTimeline from "@/components/client/JourneyTimingTimeline";
import ElapsedTimer from "@/components/client/ElapsedTimer";
import { useNowTick } from "@/lib/useNowTick";
import { formatDateTime, withManualNoteAutoTimestamp, insertManualNoteTimestamp, MANUAL_NOTE_MARKER } from "@/lib/utils";
import {
  Save,
  Loader2,
  AlertTriangle,
  X,
  Clock,
  Sparkles,
  MessageSquareText,
  Music,
} from "@/components/ui/HeartfulIcon";
import { RecordingsSection, } from "@/components/ai/RecordingsPanel";
import StageFormsCard from "@/components/client/StageFormsCard";

const BOOSTER_REMINDER_MINUTES = 90;

type JourneyMarker = "started" | "ended" | "booster";

export default function JourneyDayWorkspace({
  clientId,
  clientName,
  sessionId,
  initialManualNotes = "",
  existingManualNotesSummary,
  initialJourneyStartedAt,
  initialJourneyEndedAt,
  initialInitialDoseAmount = "",
  initialBoosterDoseAt,
  initialBoosterDoseAmount = "",
  pastCallSummaries = [],
  initialTranscript = "",
  initialRecordings = [],
  initialStageRecordings = [],
  formTemplates = [],
  documents = [],
  formSubmissions = [],
}: {
  clientId: string;
  clientName: string;
  sessionId: string;
  initialManualNotes?: string;
  existingManualNotesSummary?: AiSummary;
  initialJourneyStartedAt?: string | null;
  initialJourneyEndedAt?: string | null;
  initialInitialDoseAmount?: string;
  initialBoosterDoseAt?: string | null;
  initialBoosterDoseAmount?: string;
  pastCallSummaries?: AiSummary[];
  initialTranscript?: string;
  initialRecordings?: Recording[];
  /** Recordings added here before a Journey Day session was scheduled. */
  initialStageRecordings?: Recording[];
  formTemplates?: FormTemplate[];
  documents?: ClientDocument[];
  formSubmissions?: FormSubmission[];
}) {
  // Transcripts & Recordings — the single, persisted place to paste the
  // transcript from a recording device (Plaud, iPhone Voice Memos, etc.)
  // and/or upload the actual audio file. This replaces pasting transcripts
  // into Manual Notes and the old ephemeral per-card paste boxes: both the
  // clinician-facing Journey Summary and the client-facing Client Journey
  // Summary below now generate from this shared transcript (plus Manual
  // Notes), and it survives page reloads instead of being lost.
  // The Journey Day appointment is created automatically the first time
  // anything on this page is saved (a note, a dose, Journey Begin, a
  // recording…), dated right then — no need to schedule it first.
  const [activeSessionId, setActiveSessionId] = useState(sessionId);
  const [sessionCreatedNotice, setSessionCreatedNotice] = useState(false);
  const pendingSession = useRef<Promise<string> | null>(null);
  async function ensureSession(): Promise<string> {
    if (activeSessionId) return activeSessionId;
    if (!pendingSession.current) {
      pendingSession.current = ensureJourneyDaySessionAction(clientId)
        .then((id) => {
          setActiveSessionId(id);
          setSessionCreatedNotice(true);
          return id;
        })
        .catch((error) => {
          pendingSession.current = null;
          throw error;
        });
    }
    return pendingSession.current;
  }

  const [transcript, setTranscript] = useState(initialTranscript);
  const [transcriptSaving, setTranscriptSaving] = useState(false);
  const [transcriptSaved, setTranscriptSaved] = useState(false);
  const [recordings, setRecordings] = useState(() => [...initialRecordings, ...initialStageRecordings]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function saveTranscript() {
    setTranscriptSaving(true);
    await updateSessionTranscriptAction(await ensureSession(), clientId, transcript);
    setTranscriptSaving(false);
    setTranscriptSaved(true);
    setTimeout(() => setTranscriptSaved(false), 2000);
  }

  // Autosave the transcript ~1.5s after typing stops, same pattern as
  // Manual Notes below.
  const transcriptFirstRender = useRef(true);
  useEffect(() => {
    if (transcriptFirstRender.current) {
      transcriptFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      saveTranscript();
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  async function uploadRecordingFile(file: File) {
    setUploadError(null);
    setUploadBusy(true);
    try {
      const sid = await ensureSession();
      const result = await createRecordingUploadUrlAction(clientId, sid, file.name, file.type || "application/octet-stream");
      if (!result) {
        setUploadError("Audio storage isn't set up yet — ask your admin to finish the Firebase Storage setup.");
        return;
      }
      const putRes = await fetch(result.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) {
        setUploadError("The upload didn't go through — check your connection and try again.");
        return;
      }
      const recording = await addRecordingAction(clientId, sid, file.name, result.storagePath, file.size);
      setRecordings((prev) => [recording, ...prev]);
    } catch {
      setUploadError("The upload didn't go through — check your connection and try again.");
    } finally {
      setUploadBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function playOrDownloadRecording(rec: Recording) {
    const url = await getRecordingDownloadUrlAction(rec.storage_path);
    if (url) window.open(url, "_blank");
  }

  async function removeRecording(rec: Recording) {
    if (!window.confirm(`Delete "${rec.file_name ?? "this recording"}"? This can't be undone.`)) return;
    await deleteClientRecordingAction(clientId, rec.id);
    setRecordings((prev) => prev.filter((r) => r.id !== rec.id));
  }

  // Journey Day Summary - Client — a strictly factual, non-interpretive recap.
  // Unlike the Journey Summary above (practitioner-only analysis) and the
  // Manual Notes summary (also practitioner-only), this one is
  // client-facing: it automatically shows up in the client's Portal under
  // Past Appointments once this session is marked complete.
  const [callSummaryBusy, setCallSummaryBusy] = useState(false);
  const [callSummaryError, setCallSummaryError] = useState<string | null>(null);
  const [newCallSummary, setNewCallSummary] = useState<AiSummary | null>(null);
  const [localCallSummaries, setLocalCallSummaries] = useState(pastCallSummaries);
  const [expandedCallSummary, setExpandedCallSummary] = useState<string | null>(pastCallSummaries[0]?.id ?? null);

  async function generateCallSummary() {
    const combined = [manualNotes, transcript].filter(Boolean).join("\n\n---\n\n");
    if (!combined.trim()) return;
    setCallSummaryBusy(true);
    setCallSummaryError(null);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          summaryType: "session_call_summary",
          sessionId: await ensureSession(),
          sessionTypeLabel: "Journey Day",
          transcript: combined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.summary) throw new Error(json.error ?? "Journey Day summary could not be generated.");
      setNewCallSummary(json.summary);
      setLocalCallSummaries((prev) => [json.summary, ...prev]);
      setExpandedCallSummary(json.summary.id);
    } catch (error) {
      setCallSummaryError(error instanceof Error ? error.message : "Journey Day summary could not be generated. Try again.");
    } finally {
      setCallSummaryBusy(false);
    }
  }

  async function deleteCallSummary(summaryId: string) {
    if (!window.confirm("Delete this summary version? This can't be undone. Your notes and transcript are not affected.")) return;
    await deleteAiSummaryAction(summaryId, clientId);
    setLocalCallSummaries((prev) => prev.filter((cs) => cs.id !== summaryId));
    setNewCallSummary((prev) => (prev?.id === summaryId ? null : prev));
  }

  async function saveCallSummary(summaryId: string, nextContent: Record<string, unknown>) {
    await updateAiSummaryAction(summaryId, clientId, nextContent);
    setLocalCallSummaries((prev) => prev.map((cs) => (cs.id === summaryId ? { ...cs, content: nextContent } : cs)));
    setNewCallSummary((prev) => (prev?.id === summaryId ? { ...prev, content: nextContent } : prev));
  }

  // Manual Notes — a free-form running journal for the Journey Day session.
  const [manualNotes, setManualNotes] = useState(initialManualNotes);
  const [manualNotesSaving, setManualNotesSaving] = useState(false);
  const [manualNotesSaved, setManualNotesSaved] = useState(false);
  const [manualNotesSummary, setManualNotesSummary] = useState(existingManualNotesSummary);
  const manualNotesRef = useRef<HTMLTextAreaElement>(null);

  // Explicit, always-works alternative to typing /// — inserts a fresh
  // timestamp line and refocuses the box with the cursor at the end.
  function insertTimestamp() {
    const next = insertManualNoteTimestamp(manualNotes);
    const el = manualNotesRef.current;
    if (el) {
      // Update the actual DOM node synchronously (not via requestAnimationFrame)
      // so focus/cursor/scroll land correctly in the same tick, before React's
      // own re-render — and pass { preventScroll: true } to focus(), since by
      // default the browser scrolls the page to bring a newly-focused element
      // into view, which is what was causing the whole page to jump to the
      // top of the notes card instead of staying put.
      el.value = next;
      el.focus({ preventScroll: true });
      el.selectionStart = el.selectionEnd = next.length;
      el.scrollTop = el.scrollHeight;
    }
    setManualNotes(next);
  }

  async function saveManualNotes() {
    setManualNotesSaving(true);
    try {
      await updateSessionManualNotesAction(await ensureSession(), clientId, manualNotes);
      setManualNotesSaved(true);
      setTimeout(() => setManualNotesSaved(false), 2000);
    } catch {
      // Autosave runs on a timer — swallow the failure rather than
      // interrupting typing; the explicit Save button reports it.
    } finally {
      setManualNotesSaving(false);
    }
  }

  async function deleteManualNotesSummary() {
    if (!manualNotesSummary) return;
    if (!window.confirm("Delete this archived summary? This can't be undone. Your notes are not affected.")) return;
    await deleteAiSummaryAction(manualNotesSummary.id, clientId);
    setManualNotesSummary(undefined);
  }

  async function saveManualNotesSummary(nextContent: Record<string, unknown>) {
    if (!manualNotesSummary) return;
    await updateAiSummaryAction(manualNotesSummary.id, clientId, nextContent);
    setManualNotesSummary({ ...manualNotesSummary, content: nextContent });
  }

  // Autosave Manual Notes ~1.5s after typing stops, so a stray page refresh,
  // browser crash, or deploy-triggered reload can't lose more than a
  // moment's typing — the explicit Save button above still works too, this
  // is just a safety net on top of it.
  const manualNotesFirstRender = useRef(true);
  useEffect(() => {
    if (manualNotesFirstRender.current) {
      manualNotesFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      saveManualNotes();
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualNotes]);

  // Journey Begin / Journey End / Booster Dose toggles — stamp the session
  // record (which drives the client's History tab), and append a matching
  // line to Manual Notes. Kept here rather than in a self-contained
  // component so the Manual Notes textarea above updates immediately with
  // the new line instead of waiting for a page reload.
  const [journeyStartedAt, setJourneyStartedAt] = useState(initialJourneyStartedAt ?? undefined);
  const [journeyEndedAt, setJourneyEndedAt] = useState(initialJourneyEndedAt ?? undefined);
  const [boosterDoseAt, setBoosterDoseAt] = useState(initialBoosterDoseAt ?? undefined);
  const [markerPending, setMarkerPending] = useState<JourneyMarker | null>(null);
  const [timeSavingMarker, setTimeSavingMarker] = useState<JourneyMarker | null>(null);
  const [markerError, setMarkerError] = useState<string | null>(null);

  // Everything on this page writes to a Journey Day session record. A client
  // with no harm_reduction_support session on the calendar yet (a freshly
  // created client, say) renders this workspace with an empty sessionId —
  // in which case there is nothing to stamp, and the controls below are
  // shown disabled with an explanation rather than firing writes that can't
  // land.
  // Always usable: the session is created automatically on first save.
  const hasSession = true;

  function markerTimestamp(marker: JourneyMarker) {
    return marker === "started" ? journeyStartedAt : marker === "ended" ? journeyEndedAt : boosterDoseAt;
  }

  function applyMarkerResult(updated: {
    journey_started_at?: string | null;
    journey_ended_at?: string | null;
    booster_dose_at?: string | null;
    manual_notes?: string;
  }) {
    setJourneyStartedAt(updated.journey_started_at ?? undefined);
    setJourneyEndedAt(updated.journey_ended_at ?? undefined);
    setBoosterDoseAt(updated.booster_dose_at ?? undefined);
    if (updated.manual_notes !== undefined) setManualNotes(updated.manual_notes);
  }

  // Note the try/finally on both writers below: if the server action
  // rejects, the spinner has to come down and say so. Without it a failed
  // toggle left the switch spinning forever with no error anywhere — which
  // is exactly what a missing session used to look like from the outside.
  async function toggleJourneyMarker(marker: JourneyMarker) {
    const isOn = !!markerTimestamp(marker);
    const previousMarkers = {
      started: journeyStartedAt,
      ended: journeyEndedAt,
      booster: boosterDoseAt,
    };

    // Reflect the action at once. Recording the precise timestamp and the
    // accompanying manual-note entry still happens on the server; if that
    // write fails, restore the prior state rather than leaving a false record.
    const optimisticTimestamp = new Date().toISOString();
    const nextTimestamp = isOn ? undefined : optimisticTimestamp;
    if (marker === "started") setJourneyStartedAt(nextTimestamp);
    else if (marker === "ended") setJourneyEndedAt(nextTimestamp);
    else setBoosterDoseAt(nextTimestamp);

    setMarkerPending(marker);
    setMarkerError(null);
    try {
      // Server actions run in the Netlify function (UTC), which has no idea
      // what timezone the practitioner is actually in — pass the browser's
      // zone along so the note line written into Manual Notes lands in local
      // time instead of UTC.
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const updated = await setJourneyMarkerAction(await ensureSession(), clientId, marker, !isOn, manualNotes, timeZone);
      if (updated) applyMarkerResult(updated);
      else {
        setJourneyStartedAt(previousMarkers.started);
        setJourneyEndedAt(previousMarkers.ended);
        setBoosterDoseAt(previousMarkers.booster);
        setMarkerError("Couldn't save that time — the Journey Day session record wasn't found.");
      }
    } catch {
      setJourneyStartedAt(previousMarkers.started);
      setJourneyEndedAt(previousMarkers.ended);
      setBoosterDoseAt(previousMarkers.booster);
      setMarkerError("Couldn't save that time. Check your connection and try again.");
    } finally {
      setMarkerPending(null);
    }
  }

  async function updateMarkerTime(marker: JourneyMarker, isoTimestamp: string) {
    setTimeSavingMarker(marker);
    setMarkerError(null);
    try {
      const updated = await updateJourneyMarkerTimeAction(await ensureSession(), clientId, marker, isoTimestamp);
      if (updated) applyMarkerResult(updated);
      else setMarkerError("Couldn't save that time — the Journey Day session record wasn't found.");
    } catch {
      setMarkerError("Couldn't save that time. Check your connection and try again.");
    } finally {
      setTimeSavingMarker(null);
    }
  }

  // Quick +/- adjustment for a running timer (Journey Timer, Booster Timer)
  // — for when the practitioner forgot to toggle the marker at the actual
  // moment. Adding minutes to the elapsed count moves the start time
  // earlier; subtracting moves it later.
  function adjustMarkerMinutes(marker: JourneyMarker, deltaMinutes: number) {
    const current = markerTimestamp(marker);
    if (!current) return;
    const newIso = new Date(new Date(current).getTime() - deltaMinutes * 60_000).toISOString();
    updateMarkerTime(marker, newIso);
  }

  // Initial dose + booster dose amounts — plain text (units/substances vary
  // by practice), shown at the top of the page alongside the timing toggles.
  const [initialDoseAmount, setInitialDoseAmount] = useState(initialInitialDoseAmount);
  const [initialDoseSaving, setInitialDoseSaving] = useState(false);
  const [initialDoseSaved, setInitialDoseSaved] = useState(false);
  const [boosterDoseAmount, setBoosterDoseAmount] = useState(initialBoosterDoseAmount);
  const [recordedBoosterDoseAmount, setRecordedBoosterDoseAmount] = useState(initialBoosterDoseAmount);
  const [boosterDoseSaving, setBoosterDoseSaving] = useState(false);
  const [boosterDoseSaved, setBoosterDoseSaved] = useState(false);

  async function saveInitialDoseAmount() {
    setInitialDoseSaving(true);
    try {
      await updateInitialDoseAmountAction(await ensureSession(), clientId, initialDoseAmount);
      setInitialDoseSaved(true);
      setTimeout(() => setInitialDoseSaved(false), 2000);
    } catch {
      setMarkerError("Couldn't save the dose amount. Check your connection and try again.");
    } finally {
      setInitialDoseSaving(false);
    }
  }

  async function saveBoosterDoseAmount() {
    setBoosterDoseSaving(true);
    try {
      await updateBoosterDoseAmountAction(await ensureSession(), clientId, boosterDoseAmount);
      setRecordedBoosterDoseAmount(boosterDoseAmount);
      setBoosterDoseSaved(true);
      setTimeout(() => setBoosterDoseSaved(false), 2000);
    } catch {
      setMarkerError("Couldn't save the dose amount. Check your connection and try again.");
    } finally {
      setBoosterDoseSaving(false);
    }
  }

  // 90-minute booster-dose assessment reminder — only ticks (and only
  // matters) while the journey is actively underway.
  //
  // Dismissal is persisted to localStorage (keyed by session) rather than
  // just component state, because plain state resets to false on any page
  // reload or navigation-and-back — which, over a multi-hour session,
  // happens often enough that the reminder kept resurfacing every time the
  // practitioner reopened the tab, even after they'd already dismissed it.
  const boosterReminderStorageKey = `journey-booster-reminder-dismissed:${activeSessionId || "new"}`;
  const [boosterReminderDismissed, setBoosterReminderDismissedState] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(boosterReminderStorageKey) === "1";
  });
  function dismissBoosterReminder() {
    setBoosterReminderDismissedState(true);
    if (typeof window !== "undefined") window.localStorage.setItem(boosterReminderStorageKey, "1");
  }
  const journeyInProgress = !!journeyStartedAt && !journeyEndedAt;
  const timingNow = useNowTick(30_000, journeyInProgress);
  const minutesSinceStart = journeyStartedAt ? (timingNow - new Date(journeyStartedAt).getTime()) / 60_000 : 0;
  const showBoosterReminder =
    journeyInProgress && minutesSinceStart >= BOOSTER_REMINDER_MINUTES && !boosterDoseAt && !boosterReminderDismissed;

  return (
    <>
    <div className="mb-6">
      <StageFormsCard
        clientId={clientId}
        sessionType="harm_reduction_support"
        formTemplates={formTemplates}
        documents={documents}
        formSubmissions={formSubmissions}
      />
    </div>
    {sessionCreatedNotice && (
      <p className="mb-4 rounded-xl border border-sage-200 bg-sage-50 px-4 py-2.5 text-sm text-sage-800" role="status">
        A Journey Day session for today was added to the calendar, and everything on this page is saved to it.
      </p>
    )}
    <fieldset disabled={!hasSession} className="contents">
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-3 card journey-timing-panel p-4">
        <h2 className="font-semibold text-ink-900 mb-3">Journey Timing</h2>


        {markerError && (
          <p className="journey-timing-error" role="alert">
            {markerError}
          </p>
        )}

        {(journeyStartedAt || boosterDoseAt) && (
          <div className="flex flex-wrap gap-8 mb-4">
            <ElapsedTimer
              label="Journey Timer"
              since={journeyStartedAt}
              until={journeyEndedAt}
              onAdjustMinutes={journeyStartedAt ? (delta) => adjustMarkerMinutes("started", delta) : undefined}
              adjusting={timeSavingMarker === "started"}
            />
            {/* `until` matters: the booster clock measures time inside the
                journey, so Journey End stops it exactly as it stops the
                Journey Timer. Without it this kept counting after the
                journey was over. */}
            <ElapsedTimer
              label="Time Since Booster"
              since={boosterDoseAt}
              until={journeyEndedAt}
              onAdjustMinutes={boosterDoseAt ? (delta) => adjustMarkerMinutes("booster", delta) : undefined}
              adjusting={timeSavingMarker === "booster"}
            />
          </div>
        )}

        {showBoosterReminder && (
          <div className="journey-timing-reminder">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold">90 minutes in — assess for a booster dose</p>
              <p className="text-xs mt-0.5">
                Add a booster dose once given, and log the amount — or dismiss if none is needed.
              </p>
            </div>
            <button
              onClick={dismissBoosterReminder}
              className="journey-timing-reminder-dismiss"
              aria-label="Dismiss reminder"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <JourneyTimingTimeline
          hasSession={hasSession}
          journeyStartedAt={journeyStartedAt}
          boosterDoseAt={boosterDoseAt}
          journeyEndedAt={journeyEndedAt}
          markerPending={markerPending}
          timeSavingMarker={timeSavingMarker}
          onMarkerToggle={toggleJourneyMarker}
          onMarkerTimeChange={updateMarkerTime}
          initialDoseAmount={initialDoseAmount}
          onInitialDoseChange={setInitialDoseAmount}
          onInitialDoseSave={saveInitialDoseAmount}
          initialDoseSaving={initialDoseSaving}
          initialDoseSaved={initialDoseSaved}
          boosterDoseAmount={boosterDoseAmount}
          recordedBoosterDoseAmount={recordedBoosterDoseAmount}
          onBoosterDoseChange={setBoosterDoseAmount}
          onBoosterDoseSave={saveBoosterDoseAmount}
          boosterDoseSaving={boosterDoseSaving}
          boosterDoseSaved={boosterDoseSaved}
        />
      </div>

      <div className="lg:col-span-3 flex flex-col gap-6">
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold text-ink-900">Manual Notes</h2>
        <p className="text-xs text-ink-400">
          A free-form running journal for the session — separate from the timestamped notes above. Your first note is
          timestamped automatically; type <span className="font-mono text-ink-600">{MANUAL_NOTE_MARKER}</span> alone
          on its own line to timestamp the next note, or click <span className="font-medium">Insert Timestamp</span>{" "}
          below for a guaranteed one-click stamp.
        </p>
        <textarea
          ref={manualNotesRef}
          value={manualNotes}
          onChange={(e) => {
            const el = e.target;
            const scrollTop = el.scrollTop;
            const { value, cursorPos } = withManualNoteAutoTimestamp(manualNotes, el.value, el.selectionStart);
            if (value !== el.value) {
              // Mutate the DOM node synchronously, in the same tick as this
              // keystroke, rather than deferring the cursor fix to
              // requestAnimationFrame. Typing fires faster than animation
              // frames, so a deferred correction from one keystroke could
              // land after the next keystroke already fired — scrambling
              // the cursor position on fast typing. Setting it here keeps
              // every keystroke self-consistent.
              el.value = value;
              el.selectionStart = el.selectionEnd = cursorPos;
              el.scrollTop = scrollTop;
            }
            setManualNotes(value);
          }}
          rows={6}
          placeholder="Write freely — impressions, context, anything worth remembering that doesn't fit the timestamped format above…"
          className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-clay-200 resize-none"
        />
        <div className="flex items-center gap-2 flex-wrap">
          {manualNotesSaved && <span className="text-xs text-sage-600">Saved</span>}
          <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={insertTimestamp}
            className="btn-ghost text-sm px-3 py-1.5 flex items-center gap-1.5"
          >
            <Clock className="h-3.5 w-3.5" />
            Insert Timestamp
          </button>
          <button
            disabled={manualNotesSaving}
            onClick={saveManualNotes}
            className="btn-ghost text-sm px-3 py-1.5 flex items-center gap-1.5"
          >
            {manualNotesSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Notes
          </button>
          </div>
        </div>

        <div className="pt-3 border-t border-ink-100 space-y-3">
          <h3 className="font-semibold text-ink-900 text-sm">Session Transcript</h3>
          <p className="text-xs text-ink-400">
            Paste the transcript from your recording device (Plaud, iPhone Voice Memos, etc.) and/or upload the actual
            audio file here. This is the single saved source the Journey Day Summary below generates from.
          </p>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={6}
            placeholder="Paste the session recording transcript here…"
            className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-clay-200 resize-none"
          />
          <div className="flex items-center gap-2 flex-wrap">
            {transcriptSaved && <span className="text-xs text-sage-600">Saved</span>}
            <button
              disabled={transcriptSaving}
              onClick={saveTranscript}
              className="btn-ghost text-sm px-3 py-1.5 flex items-center gap-1.5"
            >
              {transcriptSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Transcript
            </button>
          </div>

          {/* With no session yet, the same box is shown at the top of the page
              instead (this area is locked until a session is scheduled). */}
          {hasSession && (
            <RecordingsSection
              busy={uploadBusy}
              error={uploadError}
              recordings={recordings}
              onFile={(file) => void uploadRecordingFile(file)}
              onPlay={playOrDownloadRecording}
              onRemove={removeRecording}
            />
          )}
        </div>

        {/* One summary per session, shared by practitioner and client. The
            separate practitioner-only generator was removed — interpretation
            belongs in Journey Summary, further down this page. Summaries
            generated before that change still render here. */}
        {manualNotesSummary && (
          <SummaryCard
            title="Journey Day Summary - Practitioner (archived)"
            content={manualNotesSummary.content}
            model={manualNotesSummary.model} sourceNotes={manualNotesSummary.source_notes}
            onDelete={deleteManualNotesSummary}
            onSave={saveManualNotesSummary}
          />
        )}

        <div className="pt-3 border-t border-ink-100 space-y-3">
          <ActionCardHeader
            title={<><MessageSquareText className="h-4 w-4 text-ink-400" />Journey Day Summary</>}
            description={`A factual recap shown to ${clientName} in the Client Portal when this session is complete.`}
            action={<button
              disabled={callSummaryBusy || !(manualNotes.trim() || transcript.trim())}
              onClick={generateCallSummary}
              className="btn-primary flex items-center gap-2 whitespace-nowrap px-4 py-2 text-sm disabled:opacity-50"
            >
              {callSummaryBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate Journey Day Summary
            </button>}
          />

          {callSummaryError && <p role="alert" className="text-sm text-red-600">{callSummaryError}</p>}

          {localCallSummaries.length > 0 && (
            <div className="space-y-2">
              {localCallSummaries.map((cs) => (
                <div key={cs.id}>
                  <button
                    onClick={() => setExpandedCallSummary(expandedCallSummary === cs.id ? null : cs.id)}
                    className="flex items-center gap-2 text-sm text-ink-500 hover:text-ink-800 py-1 text-left w-full"
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>Journey Day Summary — {formatDateTime(cs.created_at)}</span>
                    <span className="ml-auto text-xs">{expandedCallSummary === cs.id ? "▲" : "▼"}</span>
                  </button>
                  {expandedCallSummary === cs.id && (
                    <div className="mt-2">
                      <SummaryCard
                        title={cs.title}
                        content={cs.content}
                        model={cs.model} sourceNotes={cs.source_notes}
                        onDelete={() => deleteCallSummary(cs.id)}
                        onSave={(next) => saveCallSummary(cs.id, next)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {newCallSummary && localCallSummaries.every((cs) => cs.id !== newCallSummary.id) && (
            <SummaryCard
              title={newCallSummary.title}
              content={newCallSummary.content}
              model={newCallSummary.model} sourceNotes={newCallSummary.source_notes}
              onDelete={() => deleteCallSummary(newCallSummary.id)}
              onSave={(next) => saveCallSummary(newCallSummary.id, next)}
            />
          )}

          {(transcript.trim() || recordings.length > 0) && (
            <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-3 space-y-2">
              <p className="text-xs uppercase tracking-wide text-ink-400">Transcript &amp; Recording Used</p>
              {transcript.trim() && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-ink-600 hover:text-ink-900 text-xs font-medium">
                    View transcript
                  </summary>
                  <p className="whitespace-pre-wrap mt-2 max-h-56 overflow-y-auto text-ink-700">{transcript}</p>
                </details>
              )}
              {recordings.length > 0 && (
                <div className="space-y-1">
                  {recordings.map((rec) => (
                    <button
                      key={rec.id}
                      onClick={() => playOrDownloadRecording(rec)}
                      className="flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-800"
                    >
                      <Music className="h-3.5 w-3.5" />
                      {rec.file_name ?? "Recording"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
      </div>
    </div>
    </fieldset>
    </>
  );
}
