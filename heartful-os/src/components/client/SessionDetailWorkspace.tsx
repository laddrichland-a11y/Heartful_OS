"use client";

import { useEffect, useRef, useState } from "react";
import {
  AiSummary,
  ClientDocument,
  FormSubmission,
  FormTemplate,
  Recording,
  Session,
} from "@/lib/types";
import {
  cx,
  formatDateTime,
    SESSION_TYPE_LABELS,
  withManualNoteAutoTimestamp,
  insertManualNoteTimestamp,
  MANUAL_NOTE_MARKER,
} from "@/lib/utils";
import {
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  Loader2,
  FileText,
  History,
  CheckCircle2,
  Trash2,
  MessageSquareText,
  BookOpen,
  Save,
  AlertTriangle,
  X,
  Music,
  ScrollText,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
} from "@/components/ui/HeartfulIcon";
import SummaryCard from "@/components/ai/SummaryCard";
import StageFormsCard from "@/components/client/StageFormsCard";
import NotesFileUpload, { appendUploadedText } from "@/components/ai/NotesFileUpload";
import { RecordingsSection } from "@/components/ai/RecordingsPanel";
import ActionCardHeader from "@/components/client/ActionCardHeader";
import MilestoneToggleBanner from "@/components/client/MilestoneToggleBanner";
import JourneyPrepEmailButton from "@/components/client/JourneyPrepEmailButton";
import JourneySummaryTextButton from "@/components/client/JourneySummaryTextButton";
import JourneyTimingTimeline from "@/components/client/JourneyTimingTimeline";
import ElapsedTimer from "@/components/client/ElapsedTimer";
import { useNowTick } from "@/lib/useNowTick";
import {
  completeSessionAction,
  cancelSessionAction,
  deleteAiSummaryAction,
  updateAiSummaryAction,
  updateSessionManualNotesAction,
  updateSessionTranscriptAction,
  createRecordingUploadUrlAction,
  addRecordingAction,
  getRecordingDownloadUrlAction,
  deleteClientRecordingAction,
  setJourneyMarkerAction,
  updateJourneyMarkerTimeAction,
  updateInitialDoseAmountAction,
  updateBoosterDoseAmountAction,
} from "@/lib/actions";

type JourneyMarker = "started" | "ended" | "booster";
const BOOSTER_REMINDER_MINUTES = 90;

// Notes typed on the stage page before this session was on the calendar.
// Read-only here; they stay part of the record (never shown to the client).
function EarlierStageNotes({ notes }: { notes: string }) {
  if (!notes.trim()) return null;
  return (
    <details className="rounded-lg border border-ink-100 bg-white/60 px-3 py-2 text-sm">
      <summary className="cursor-pointer select-none text-xs font-medium text-ink-500 hover:text-ink-800">
        Notes added before this session was scheduled
      </summary>
      <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap text-ink-700">{notes}</p>
    </details>
  );
}

export default function SessionDetailWorkspace({
  clientId,
  clientName,
  clientEmail,
  clientPhone,
  session,
  pastBriefings,
  pastCallSummaries,
  primarySummaries,
  milestoneKey,
  milestoneCompleted = false,
  formTemplates,
  formSubmissions,
  documents,
  practitionerName,
  practiceName,
  followUpScheduledAt,
  initialManualNotes = "",
  existingManualNotesSummary,
  initialTranscript = "",
  initialRecordings = [],
  earlierStageNotes = "",
  portalUrl,
  autoPrepare = false,
  stageStatus,
  canMarkComplete,
  canPrepare,
}: {
  clientId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  session: Session;
  pastBriefings: AiSummary[];
  pastCallSummaries: AiSummary[];
  primarySummaries: AiSummary[];
  milestoneKey?: string;
  milestoneCompleted?: boolean;
  formTemplates: FormTemplate[];
  formSubmissions: FormSubmission[];
  documents: ClientDocument[];
  practitionerName?: string;
  practiceName?: string;
  followUpScheduledAt?: string;
  initialManualNotes?: string;
  existingManualNotesSummary?: AiSummary;
  initialTranscript?: string;
  initialRecordings?: Recording[];
  /** Notes typed on this stage's page before the session was scheduled. */
  earlierStageNotes?: string;
  portalUrl: string;
  autoPrepare?: boolean;
  stageStatus?: "completed" | "current" | "upcoming" | "future";
  canMarkComplete?: boolean;
  canPrepare?: boolean;
}) {
  // Auto-expand the most recent past briefing so it's immediately visible
  const [expandedPast, setExpandedPast] = useState<string | null>(pastBriefings[0]?.id ?? null);
  const [actionBusy, setActionBusy] = useState<"complete" | "cancel" | null>(null);
  const [deletingBriefingId, setDeletingBriefingId] = useState<string | null>(null);
  const [localPastBriefings, setLocalPastBriefings] = useState(pastBriefings);

  // Primary session summaries (assessment, journey brief, etc.)
  const [expandedPrimary, setExpandedPrimary] = useState<string | null>(primarySummaries[0]?.id ?? null);
  const [localPrimarySummaries, setLocalPrimarySummaries] = useState(primarySummaries);

  async function deletePrimarySummary(summaryId: string) {
    if (!confirm("Delete this summary? This cannot be undone.")) return;
    await deleteAiSummaryAction(summaryId, clientId);
    setLocalPrimarySummaries((prev) => prev.filter((s) => s.id !== summaryId));
  }

  async function savePrimarySummary(summaryId: string, nextContent: Record<string, unknown>) {
    await updateAiSummaryAction(summaryId, clientId, nextContent);
    setLocalPrimarySummaries((prev) => prev.map((s) => (s.id === summaryId ? { ...s, content: nextContent } : s)));
  }

  // Transcripts & Recordings — the single, persisted place to paste the
  // transcript from a recording device (Plaud, iPhone Voice Memos, etc.)
  // and/or upload the actual audio file. Both the Session Analysis
  // generation and the Journey Day Summary - Client below generate from this
  // shared, persisted source (plus Manual Notes) instead of a one-off paste
  // box that was lost on reload.
  const [transcript, setTranscript] = useState(initialTranscript);
  const [transcriptSaving, setTranscriptSaving] = useState(false);
  const [transcriptSaved, setTranscriptSaved] = useState(false);
  const [recordings, setRecordings] = useState(initialRecordings);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function saveTranscript() {
    setTranscriptSaving(true);
    await updateSessionTranscriptAction(session.id, clientId, transcript);
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
      const result = await createRecordingUploadUrlAction(
        clientId,
        session.id,
        file.name,
        file.type || "application/octet-stream"
      );
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
      const recording = await addRecordingAction(clientId, session.id, file.name, result.storagePath, file.size);
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

  // Call summary state
  const [callSummaryBusy, setCallSummaryBusy] = useState(false);
  const [callSummaryError, setCallSummaryError] = useState<string | null>(null);
  const callSummaryRequestInFlight = useRef(false);
  const [newCallSummary, setNewCallSummary] = useState<AiSummary | null>(null);
  const [localCallSummaries, setLocalCallSummaries] = useState(pastCallSummaries);
  const [expandedCallSummary, setExpandedCallSummary] = useState<string | null>(pastCallSummaries[0]?.id ?? null);

  // Manual Notes (Journey Day only) — free-form running journal, separate
  // from the timestamped Structured Session Notes tracked on the dedicated
  // Journey Day overview page, with its own AI summary generation.
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
    await updateSessionManualNotesAction(session.id, clientId, manualNotes);
    setManualNotesSaving(false);
    setManualNotesSaved(true);
    setTimeout(() => setManualNotesSaved(false), 2000);
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

  // Journey Begin / Journey End / Booster Dose toggles (Journey Day only) —
  // stamp the session record (drives the client's History tab) and append a
  // matching line to Manual Notes above.
  const [journeyStartedAt, setJourneyStartedAt] = useState(session.journey_started_at ?? undefined);
  const [journeyEndedAt, setJourneyEndedAt] = useState(session.journey_ended_at ?? undefined);
  const [boosterDoseAt, setBoosterDoseAt] = useState(session.booster_dose_at ?? undefined);
  const [markerPending, setMarkerPending] = useState<JourneyMarker | null>(null);
  const [timeSavingMarker, setTimeSavingMarker] = useState<JourneyMarker | null>(null);
  const [markerError, setMarkerError] = useState<string | null>(null);

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

  async function toggleJourneyMarker(marker: JourneyMarker) {
    const isOn = !!markerTimestamp(marker);
    const previousMarkers = {
      started: journeyStartedAt,
      ended: journeyEndedAt,
      booster: boosterDoseAt,
    };

    // Make the record feel immediate while the server persists the timestamp
    // and matching Manual Notes line. Any failed write is rolled back below.
    const optimisticTimestamp = new Date().toISOString();
    const nextTimestamp = isOn ? undefined : optimisticTimestamp;
    if (marker === "started") setJourneyStartedAt(nextTimestamp);
    else if (marker === "ended") setJourneyEndedAt(nextTimestamp);
    else setBoosterDoseAt(nextTimestamp);

    setMarkerPending(marker);
    setMarkerError(null);
    try {
      // Notes use the practitioner's local time even when the server runs in UTC.
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const updated = await setJourneyMarkerAction(session.id, clientId, marker, !isOn, manualNotes, timeZone);
      if (updated) applyMarkerResult(updated);
      else {
        setJourneyStartedAt(previousMarkers.started);
        setJourneyEndedAt(previousMarkers.ended);
        setBoosterDoseAt(previousMarkers.booster);
        setMarkerError("Couldn't save that time. Please try again.");
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
      const updated = await updateJourneyMarkerTimeAction(session.id, clientId, marker, isoTimestamp);
      if (updated) applyMarkerResult(updated);
      else setMarkerError("Couldn't save that time. Please try again.");
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
  // by practice).
  const [initialDoseAmount, setInitialDoseAmount] = useState(session.initial_dose_amount ?? "");
  const [initialDoseSaving, setInitialDoseSaving] = useState(false);
  const [initialDoseSaved, setInitialDoseSaved] = useState(false);
  const [boosterDoseAmount, setBoosterDoseAmount] = useState(session.booster_dose_amount ?? "");
  const [recordedBoosterDoseAmount, setRecordedBoosterDoseAmount] = useState(session.booster_dose_amount ?? "");
  const [boosterDoseSaving, setBoosterDoseSaving] = useState(false);
  const [boosterDoseSaved, setBoosterDoseSaved] = useState(false);

  async function saveInitialDoseAmount() {
    setInitialDoseSaving(true);
    setMarkerError(null);
    try {
      await updateInitialDoseAmountAction(session.id, clientId, initialDoseAmount);
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
    setMarkerError(null);
    try {
      await updateBoosterDoseAmountAction(session.id, clientId, boosterDoseAmount);
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
  const boosterReminderStorageKey = `journey-booster-reminder-dismissed:${session.id}`;
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

  async function deletePastBriefing(summaryId: string) {
    if (!confirm("Delete this briefing? This cannot be undone.")) return;
    setDeletingBriefingId(summaryId);
    await deleteAiSummaryAction(summaryId, clientId);
    setLocalPastBriefings((prev) => prev.filter((b) => b.id !== summaryId));
    setDeletingBriefingId(null);
  }

  async function savePastBriefing(summaryId: string, nextContent: Record<string, unknown>) {
    await updateAiSummaryAction(summaryId, clientId, nextContent);
    setLocalPastBriefings((prev) => prev.map((b) => (b.id === summaryId ? { ...b, content: nextContent } : b)));
  }

  // "Journey Day" is the friendly name used everywhere else in the app
  // (client header pill, dedicated overview page) for a harm_reduction_support
  // session — SESSION_TYPE_LABELS keeps the more clinical/formal label for
  // records lists elsewhere, but this page's heading should match what the
  // user actually navigated here expecting to see.
  const label =
    session.session_type === "harm_reduction_support"
      ? "Journey Day"
      : SESSION_TYPE_LABELS[session.session_type] ?? session.session_type;
  const isScheduled = session.status === "scheduled";

  // Same rule as the phase workspaces: a session shows its own form(s), not
  // the practice-wide agreements that happen to be tagged to intake.

  async function generateCallSummary() {
    const combined = [manualNotes, transcript].filter(Boolean).join("\n\n---\n\n");
    if (!combined.trim() || callSummaryRequestInFlight.current) return;
    callSummaryRequestInFlight.current = true;
    setCallSummaryBusy(true);
    setCallSummaryError(null);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          summaryType: "session_call_summary",
          sessionId: session.id,
          sessionTypeLabel: label,
          transcript: combined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.summary) throw new Error(json.error ?? "Session summary could not be generated.");

      setNewCallSummary(json.summary);
      setLocalCallSummaries((prev) => [json.summary, ...prev]);
      setExpandedCallSummary(json.summary.id);

      // The transcript is deliberately KEPT after generating: it is part of
      // the session record (and each summary version also stores the exact
      // notes it was generated from). It used to be wiped here.
    } catch (error) {
      setCallSummaryError(error instanceof Error ? error.message : "Session summary could not be generated. Try again.");
    } finally {
      callSummaryRequestInFlight.current = false;
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

  return (
    <div className="session-detail-workspace w-full space-y-5">
      {milestoneKey && (
        <MilestoneToggleBanner
          clientId={clientId}
          milestoneKey={milestoneKey}
          label={label}
          meta={`${session.scheduled_at ? formatDateTime(session.scheduled_at) : "Date not scheduled"}${session.duration_minutes ? ` · ${session.duration_minutes} min` : ""}`}
          initialCompleted={milestoneCompleted}
          prepareMeSessionId={session.id}
          initialBriefing={pastBriefings[0]}
          autoPrepare={autoPrepare}
          stageStatus={stageStatus}
          canMarkComplete={canMarkComplete}
          canPrepare={canPrepare}
        />
      )}

      {/* Session header card — phase pages already have the stage workspace banner. */}
      {!milestoneKey && (
      <div className="client-surface p-5">
        {!milestoneKey && <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">{label}</h2>
            <p className="text-sm text-ink-500">{clientName}</p>
          </div>
          <span
            className={cx(
              "badge",
              session.status === "completed" && "bg-sage-100 text-sage-700",
              session.status === "scheduled" && "bg-clay-100 text-clay-700",
              (session.status === "cancelled" || session.status === "no_show") && "bg-ink-100 text-ink-500"
            )}
          >
            {session.status === "no_show" ? "No-show" : session.status.charAt(0).toUpperCase() + session.status.slice(1)}
          </span>
        </div>}

        {!milestoneKey && <div className="space-y-2 text-sm text-ink-600 mb-5">
          {session.scheduled_at && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-ink-400 shrink-0" />
              <span>{formatDateTime(session.scheduled_at)}</span>
              {session.duration_minutes && (
                <span className="text-ink-400">· {session.duration_minutes} min</span>
              )}
            </div>
          )}
          {session.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-ink-400 shrink-0" />
              <span>{session.location}</span>
            </div>
          )}
        </div>}

        {(session.session_type === "harm_reduction_support" && practitionerName || isScheduled || pastCallSummaries.length > 0) && (
          <div className="session-detail-actions">
            {session.session_type === "harm_reduction_support" && practitionerName && (
              <JourneyPrepEmailButton
                clientId={clientId}
                clientName={clientName}
                clientEmail={clientEmail}
                practitionerName={practitionerName}
                practiceName={practiceName}
                sessionScheduledAt={isScheduled ? session.scheduled_at : undefined}
                followUpScheduledAt={followUpScheduledAt}
              />
            )}
            {(isScheduled || pastCallSummaries.length > 0) && (
              <details className="session-actions-menu">
                  <summary aria-label="More session actions" title="More session actions">
                    <MoreHorizontal aria-hidden="true" />
                  </summary>
                  <div className="session-actions-menu-popover" role="menu" aria-label="Session actions">
                    {isScheduled && (
                      <>
                        <button
                          disabled={actionBusy === "complete"}
                          onClick={async () => {
                            setActionBusy("complete");
                            await completeSessionAction(session.id, clientId);
                            setActionBusy(null);
                          }}
                          className="session-actions-menu-item"
                          role="menuitem"
                        >
                          {actionBusy === "complete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Mark Complete
                        </button>
                        <button
                          disabled={actionBusy === "cancel"}
                          onClick={async () => {
                            if (!window.confirm("Cancel this session? This cannot be undone.")) return;
                            setActionBusy("cancel");
                            await cancelSessionAction(session.id, clientId);
                            setActionBusy(null);
                          }}
                          className="session-actions-menu-item session-actions-menu-item--destructive"
                          role="menuitem"
                        >
                          {actionBusy === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                          Cancel Session
                        </button>
                      </>
                    )}
                    {pastCallSummaries.length > 0 && (
                      <JourneySummaryTextButton
                        clientId={clientId}
                        clientName={clientName}
                        clientPhone={clientPhone}
                        practitionerName={practitionerName}
                        portalUrl={portalUrl}
                        ready
                        variant="menu"
                      />
                    )}
                  </div>
              </details>
            )}
          </div>
        )}
      </div>
      )}

      {/* Journey Timing + Manual Notes (Journey Day only) */}
      {session.session_type === "harm_reduction_support" && (
        <div className="card session-analysis-panel journey-timing-panel p-4">
          <h3 className="session-panel-heading mb-3 flex items-center gap-3">Journey Timing</h3>

          {markerError && <p className="journey-timing-error" role="alert">{markerError}</p>}

          {(journeyStartedAt || boosterDoseAt) && (
            <div className="flex flex-wrap gap-8 mb-4">
              <ElapsedTimer
                label="Journey Timer"
                since={journeyStartedAt}
                until={journeyEndedAt}
                onAdjustMinutes={journeyStartedAt ? (delta) => adjustMarkerMinutes("started", delta) : undefined}
                adjusting={timeSavingMarker === "started"}
              />
              {/* Journey End freezes this too — see the note in
                  JourneyDayWorkspace. */}
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
            hasSession
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
      )}
      {/* Forms for this session — the same shared list every stage page uses. */}
      <StageFormsCard
        clientId={clientId}
        sessionType={session.session_type}
        formTemplates={formTemplates}
        documents={documents}
        formSubmissions={formSubmissions}
      />

      {session.session_type === "harm_reduction_support" && (
        <div className="card p-4 space-y-3">
          <h3 className="session-panel-heading flex items-center gap-3">
            <FileText className="h-4 w-4 text-ink-400" />
            Manual Notes
          </h3>
          <p className="text-xs text-ink-400">
            A free-form running journal for the session. Your first note is timestamped automatically; type{" "}
            <span className="font-mono text-ink-600">{MANUAL_NOTE_MARKER}</span> alone on its own line to timestamp
            the next note, or click <span className="font-medium">Insert Timestamp</span> below for a guaranteed
            one-click stamp.
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
            placeholder="Write freely — impressions, context, anything worth remembering…"
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
            <div className="session-transcript-heading-row">
              <h3 className="session-panel-heading flex items-center gap-3">Session Transcript</h3>
            </div>
            <p className="text-xs text-ink-400">
              Paste the transcript from your recording device (Plaud, iPhone Voice Memos, etc.) or upload a transcript
              file. Together with your Manual Notes, this is what the Journey Day Summary below is generated from.
            </p>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={6}
              placeholder="Paste the session recording transcript here…"
              className="w-full border border-ink-200 rounded-xl px-3 py-2.5 text-sm text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-clay-200 resize-none"
            />
            <div className="session-transcript-actions session-transcript-actions--bottom">
              {transcriptSaved && <span className="text-xs text-sage-600">Saved</span>}
              <button
                disabled={transcriptSaving}
                onClick={saveTranscript}
                className="btn-ghost text-sm px-3 py-1.5 flex items-center gap-1.5"
              >
                {transcriptSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Transcript
              </button>
              <NotesFileUpload
                clientId={clientId}
                label="Upload Transcript File"
                className="btn-ghost text-sm px-3 py-1.5 flex items-center gap-1.5 cursor-pointer"
                onText={(text, fileName) => setTranscript((prev) => appendUploadedText(prev, fileName, text))}
              />
            </div>
            <RecordingsSection
              busy={uploadBusy}
              error={uploadError}
              recordings={recordings}
              onFile={(file) => void uploadRecordingFile(file)}
              onPlay={playOrDownloadRecording}
              onRemove={removeRecording}
            />
          </div>

          <EarlierStageNotes notes={earlierStageNotes} />

          {/* One summary per session, shared by practitioner and client — see
              the note on generateCallSummary. Any Practitioner Summary
              generated before that change still renders below. */}
          {manualNotesSummary && (
            <SummaryCard
              title="Journey Day Summary - Practitioner (archived)"
              content={manualNotesSummary.content}
              model={manualNotesSummary.model}
                sourceNotes={manualNotesSummary.source_notes}
              onDelete={deleteManualNotesSummary}
              onSave={saveManualNotesSummary}
            />
          )}

          <div className="pt-3 border-t border-ink-100 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="session-panel-heading flex items-center gap-3">
                <MessageSquareText className="h-4 w-4 text-ink-400" />
                Journey Day Summary
              </h3>
              <button
                disabled={callSummaryBusy || !(manualNotes.trim() || transcript.trim())}
                onClick={generateCallSummary}
                className="btn-primary shrink-0 text-sm px-4 py-2 flex items-center gap-2 disabled:opacity-50"
              >
                {callSummaryBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate Journey Day Summary
              </button>
            </div>

            {callSummaryError && <p role="alert" className="text-sm text-red-600">{callSummaryError}</p>}

            {localCallSummaries.length > 0 && (
              <div className="space-y-2">
                {localCallSummaries.map((cs) => (
                  <div key={cs.id}>
                    <button
                      type="button"
                      onClick={() => setExpandedCallSummary(expandedCallSummary === cs.id ? null : cs.id)}
                      aria-expanded={expandedCallSummary === cs.id}
                      aria-controls={`journey-day-summary-${cs.id}`}
                      className="flex items-center gap-2 text-sm text-ink-500 hover:text-ink-800 py-1 text-left w-full"
                    >
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>Journey Day Summary — {formatDateTime(cs.created_at)}</span>
                      {expandedCallSummary === cs.id ? (
                        <ChevronUp className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" />
                      )}
                    </button>
                    {expandedCallSummary === cs.id && (
                      <div id={`journey-day-summary-${cs.id}`} className="mt-2">
                        <SummaryCard
                          title={cs.title}
                          content={cs.content}
                          model={cs.model}
                sourceNotes={cs.source_notes}
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
                model={newCallSummary.model}
                sourceNotes={newCallSummary.source_notes}
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
      )}

      {/* Past briefings */}
      {localPastBriefings.length > 0 && (
        <div className="card p-4">
          <h3 className="session-panel-heading mb-3 flex items-center gap-3">
            <History className="h-4 w-4 text-ink-400" />
            Past Briefings
          </h3>
          <div className="space-y-2">
            {localPastBriefings.map((pb) => (
              <div key={pb.id}>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setExpandedPast(expandedPast === pb.id ? null : pb.id)}
                    className="flex items-center gap-2 text-sm text-ink-500 hover:text-ink-800 py-1 text-left"
                    aria-expanded={expandedPast === pb.id}
                    aria-controls={`past-briefing-${pb.id}`}
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>Briefing from {formatDateTime(pb.created_at)}</span>
                    <ChevronDown
                      className={cx(
                        "ml-2 h-3.5 w-3.5 shrink-0 transition-transform",
                        expandedPast === pb.id && "rotate-180"
                      )}
                      aria-hidden="true"
                    />
                  </button>
                  <button
                    disabled={deletingBriefingId === pb.id}
                    onClick={() => deletePastBriefing(pb.id)}
                    className="p-1 rounded hover:bg-red-50 text-ink-300 hover:text-red-500 transition-colors"
                    title="Delete briefing"
                  >
                    {deletingBriefingId === pb.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                {expandedPast === pb.id && (
                  <div id={`past-briefing-${pb.id}`} className="mt-2">
                    <SummaryCard
                      title="AI Session Brief"
                      content={pb.content}
                      model={pb.model}
                sourceNotes={pb.source_notes}
                      onSave={(next) => savePastBriefing(pb.id, next)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Primary session analysis (client_assessment_summary, journey_brief, etc.) */}
      {localPrimarySummaries.length > 0 && (
        <div className="card p-4">
          <h3 className="session-panel-heading mb-3 flex items-center gap-3">
            <BookOpen className="h-4 w-4 text-ink-400" />
            Session Analysis
          </h3>
          <div className="session-analysis-list">
            {localPrimarySummaries.map((ps) => (
              <div key={ps.id} className="session-analysis-item">
                <button
                  type="button"
                  onClick={() => setExpandedPrimary(expandedPrimary === ps.id ? null : ps.id)}
                  className="session-analysis-toggle"
                  aria-expanded={expandedPrimary === ps.id}
                  aria-controls={`session-analysis-content-${ps.id}`}
                >
                  <span className="session-analysis-heading">
                    <strong>{ps.title}</strong>
                    <time dateTime={ps.created_at}>{formatDateTime(ps.created_at).replace(", ", " · ")}</time>
                  </span>
                  <ChevronDown className="session-analysis-chevron" aria-hidden="true" />
                </button>
                {expandedPrimary === ps.id && (
                  <div id={`session-analysis-content-${ps.id}`} className="session-analysis-expanded">
                    <SummaryCard
                      title={ps.title}
                      content={ps.content}
                      model={ps.model}
                sourceNotes={ps.source_notes}
                      onDelete={() => deletePrimarySummary(ps.id)}
                      onSave={(next) => savePrimarySummary(ps.id, next)}
                      variant={ps.summary_type === "client_assessment_summary" ? "assessment" : ps.summary_type === "journey_brief" ? "journey" : "analysis"}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* For non-Journey-Day sessions: a transcript paste area and ONE
          summary generated from it, shared by practitioner and client.
          There used to be two — a Practitioner Summary free to carry
          clinical impressions, and a separate client-facing recap — which
          meant two buttons producing near-identical text and a standing risk
          of the clinical one reaching the portal. The surviving summary is
          the strictly factual, no-interpretation one, so what the
          practitioner reads and what the client reads cannot diverge.
          Interpretation lives in the phase-level summaries instead (Journey
          Brief on Preparation, Journey Summary on Journey Day). Journey Day
          sessions get the equivalent nested inside Manual Notes above. */}
      {session.session_type !== "harm_reduction_support" && (
        <>
          <div className="card p-4 space-y-3">
            <ActionCardHeader
              title={<><ScrollText className="h-4 w-4 text-ink-400" />Session Transcript</>}
              description={`Generate a factual recap from the transcript for you and ${clientName}'s Client Portal.`}
              action={<button
                type="button"
                disabled={callSummaryBusy || !transcript.trim()}
                onClick={generateCallSummary}
                className="btn-primary flex items-center gap-2 whitespace-nowrap px-4 py-2 text-sm disabled:opacity-50"
              >
                {callSummaryBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate Session Summary
              </button>}
            />
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={6}
              placeholder="Type or paste your notes / the full transcript here, or upload a .txt, .pdf or .docx file…"
              className="w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200 resize-y"
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-400" role="status">
                {transcriptSaving ? "Saving…" : transcriptSaved ? "Saved to the session record" : "Saved automatically as you type"}
              </span>
              <span className="ml-auto flex items-center gap-2">
                <NotesFileUpload
                  clientId={clientId}
                  onText={(text, fileName) => setTranscript((prev) => appendUploadedText(prev, fileName, text))}
                />
              </span>
            </div>
            <RecordingsSection
              busy={uploadBusy}
              error={uploadError}
              recordings={recordings}
              onFile={(file) => void uploadRecordingFile(file)}
              onPlay={playOrDownloadRecording}
              onRemove={removeRecording}
            />
            <EarlierStageNotes notes={earlierStageNotes} />
            {callSummaryError && <p role="alert" className="text-sm text-red-600">{callSummaryError}</p>}
          </div>

          {manualNotesSummary && (
            <SummaryCard
              title={`${label} Summary - Practitioner (archived)`}
              content={manualNotesSummary.content}
              model={manualNotesSummary.model}
                sourceNotes={manualNotesSummary.source_notes}
              onDelete={deleteManualNotesSummary}
              onSave={saveManualNotesSummary}
            />
          )}

          {(localCallSummaries.length > 0 || newCallSummary) && (
            <div className="card p-4 space-y-3">
              <h3 className="session-panel-heading flex items-center gap-3">
                <MessageSquareText className="h-4 w-4 text-ink-400" />
                Session Summary
              </h3>
              <p className="text-xs text-ink-400">
                A strictly factual recap — no interpretation, no clinical language. This is the session
                summary of record: yours, and the one shown to {clientName} in their Client Portal,
                automatically, once this session is marked complete.
              </p>

              {localCallSummaries.length > 0 && (
                <div className="space-y-2">
                  {localCallSummaries.map((cs) => (
                    <div key={cs.id}>
                      <button
                        type="button"
                        onClick={() => setExpandedCallSummary(expandedCallSummary === cs.id ? null : cs.id)}
                        aria-expanded={expandedCallSummary === cs.id}
                        aria-controls={`session-summary-${cs.id}`}
                        className="flex items-center gap-2 text-sm text-ink-500 hover:text-ink-800 py-1 text-left w-full"
                      >
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span>Session Summary — {formatDateTime(cs.created_at)}</span>
                        {expandedCallSummary === cs.id ? (
                          <ChevronUp className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" />
                        )}
                      </button>
                      {expandedCallSummary === cs.id && (
                        <div id={`session-summary-${cs.id}`} className="mt-2">
                          <SummaryCard
                            title={cs.title}
                            content={cs.content}
                            model={cs.model}
                sourceNotes={cs.source_notes}
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
                  model={newCallSummary.model}
                sourceNotes={newCallSummary.source_notes}
                  onDelete={() => deleteCallSummary(newCallSummary.id)}
                  onSave={(next) => saveCallSummary(newCallSummary.id, next)}
                />
              )}
            </div>
          )}
        </>
      )}

    </div>
  );
}
