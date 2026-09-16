"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  User,
  Mail,
  Phone,
  Tag,
  FileText,
  Sparkles,
  Loader2,
  CalendarPlus,
  CheckCircle2,
  XCircle,
  Trash2,
  ArrowRight,
  Clock,
  MessageSquare,
  Save,
  Plus,
  X,
  AlertTriangle,
  Pencil,
  PauseCircle,
  ChevronRight,
  CalendarDays,
  Circle,
} from "lucide-react";
import {
  updateProspectAction,
  deleteProspectAction,
  scheduleProspectCallAction,
  updateProspectCallAction,
  deleteProspectCallAction,
  convertProspectToClientAction,
  addProspectTranscriptAction,
  updateProspectTranscriptAction,
  deleteProspectTranscriptAction,
  generateProspectTranscriptSummaryAction,
  checkScheduleConflictsAction,
  ScheduleConflict,
} from "@/lib/actions";
import { Prospect, ProspectCall, ProspectTranscript, PROSPECT_STATUS_LABELS } from "@/lib/types";
import { cx, formatDate, formatDateTime } from "@/lib/utils";
import SummaryCard from "@/components/ai/SummaryCard";
import ProspectSummaryEmailModal from "@/components/prospect/ProspectSummaryEmailModal";
import HoldControl from "@/components/HoldControl";

const STATUS_COLORS: Record<Prospect["status"], string> = {
  new: "bg-ink-100 text-ink-600",
  intro_scheduled: "bg-clay-100 text-clay-700",
  intro_complete: "bg-sage-100 text-sage-700",
  considering: "bg-plum-100 text-plum-700",
  converted: "bg-sage-200 text-sage-800",
  declined: "bg-ink-100 text-ink-400",
};

export default function ProspectWorkspace({
  prospect: initialProspect,
  calls: initialCalls,
  transcripts: initialTranscripts,
  practitionerName,
  practiceName,
}: {
  prospect: Prospect;
  calls: ProspectCall[];
  transcripts: ProspectTranscript[];
  practitionerName: string;
  practiceName?: string;
}) {
  const [prospect, setProspect] = useState(initialProspect);
  const [calls, setCalls] = useState(initialCalls);
  const [, startTransition] = useTransition();

  // Notes
  const [notes, setNotes] = useState(prospect.notes ?? "");
  const [notesSaveState, setNotesSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const savedNotesRef = useRef(prospect.notes ?? "");
  const latestNotesRef = useRef(prospect.notes ?? "");
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Transcript
  const [transcript, setTranscript] = useState(prospect.fathom_transcript ?? "");
  const [savedTranscript, setSavedTranscript] = useState(prospect.fathom_transcript ?? "");
  const [transcriptSaving, setTranscriptSaving] = useState(false);
  const transcriptRef = useRef<HTMLTextAreaElement>(null);

  // AI summary
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryContent, setSummaryContent] = useState<Record<string, unknown> | null>(
    prospect.ai_summary_content ?? null
  );
  const [summaryModel, setSummaryModel] = useState(prospect.ai_summary_model);

  // Client-facing summary (used for the "Email Prospect" step)
  const [clientSummaryContent, setClientSummaryContent] = useState<Record<string, unknown> | null>(
    prospect.client_summary_content ?? null
  );
  const [clientSummaryModel, setClientSummaryModel] = useState(prospect.client_summary_model);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  // Schedule call modal
  const [showCallForm, setShowCallForm] = useState(false);

  // Edit info form
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(prospect.full_name);
  const [editEmail, setEditEmail] = useState(prospect.email ?? "");
  const [editPhone, setEditPhone] = useState(prospect.phone ?? "");
  const [editReferral, setEditReferral] = useState(prospect.referral_source ?? "");
  const [editStatus, setEditStatus] = useState<Prospect["status"]>(prospect.status);
  const [editSaving, setEditSaving] = useState(false);

  // Convert busy
  const [convertBusy, setConvertBusy] = useState(false);

  useAutoResizeTextarea(notesRef, notes, 84);
  useAutoResizeTextarea(transcriptRef, transcript, 112);

  useEffect(() => {
    latestNotesRef.current = notes;
    if (notes === savedNotesRef.current) return;
    setNotesSaveState("idle");
    const timer = window.setTimeout(async () => {
      const valueToSave = notes;
      setNotesSaveState("saving");
      await updateProspectAction(prospect.id, { notes: valueToSave });
      savedNotesRef.current = valueToSave;
      if (latestNotesRef.current === valueToSave) setNotesSaveState("saved");
    }, 700);
    return () => window.clearTimeout(timer);
  }, [notes, prospect.id]);

  async function saveTranscript() {
    setTranscriptSaving(true);
    await updateProspectAction(prospect.id, { fathom_transcript: transcript });
    setSavedTranscript(transcript);
    setTranscriptSaving(false);
  }

  async function generateSummary() {
    if (!transcript.trim()) return;
    setSummaryBusy(true);
    try {
      const res = await fetch("/api/ai/prospect-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: prospect.id, transcript }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setSummaryModel(`route-error: ${json.error ?? res.status}`);
        return;
      }
      setSummaryContent(json.content);
      setSummaryModel(json.model);
      setClientSummaryContent(json.client_content ?? null);
      setClientSummaryModel(json.client_model);
      setProspect((p) => ({ ...p, status: "intro_complete", ai_summary_generated_at: json.generated_at }));
    } catch (err) {
      setSummaryModel(`fetch-error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSummaryBusy(false);
    }
  }

  async function deletePractitionerSummary() {
    if (!confirm("Delete the practitioner summary? This can't be undone — you can regenerate it from the transcript anytime.")) return;
    setSummaryContent(null);
    setSummaryModel(undefined);
    await updateProspectAction(prospect.id, {
      ai_summary_content: null,
      ai_summary_model: null,
      ai_summary_generated_at: null,
    });
  }

  async function deleteClientSummary() {
    if (!confirm("Delete the client-facing summary? This can't be undone — you can regenerate it from the transcript anytime.")) return;
    setClientSummaryContent(null);
    setClientSummaryModel(undefined);
    await updateProspectAction(prospect.id, {
      client_summary_content: null,
      client_summary_model: null,
      client_summary_generated_at: null,
    });
  }

  async function saveEdit() {
    setEditSaving(true);
    const updated = await updateProspectAction(prospect.id, {
      full_name: editName,
      email: editEmail || undefined,
      phone: editPhone || undefined,
      referral_source: editReferral || undefined,
      status: editStatus,
    });
    if (updated) setProspect(updated);
    setEditSaving(false);
    setEditOpen(false);
  }

  async function markCallComplete(callId: string) {
    startTransition(async () => {
      await updateProspectCallAction(callId, prospect.id, { status: "completed" });
      setCalls((prev) => prev.map((c) => (c.id === callId ? { ...c, status: "completed" } : c)));
    });
  }

  async function cancelCall(callId: string) {
    startTransition(async () => {
      await updateProspectCallAction(callId, prospect.id, { status: "cancelled" });
      setCalls((prev) => prev.map((c) => (c.id === callId ? { ...c, status: "cancelled" } : c)));
    });
  }

  async function removeCall(callId: string) {
    if (!confirm("Delete this call?")) return;
    await deleteProspectCallAction(callId, prospect.id);
    setCalls((prev) => prev.filter((c) => c.id !== callId));
  }

  async function handleDelete() {
    if (!confirm(`Delete ${prospect.full_name}'s prospect record? This cannot be undone.`)) return;
    await deleteProspectAction(prospect.id);
  }

  async function handleConvert() {
    if (!confirm(`Convert ${prospect.full_name} to a full client? This will create a new client record.`)) return;
    setConvertBusy(true);
    await convertProspectToClientAction(prospect.id);
  }

  const upcomingCalls = calls.filter(
    (c) => c.status === "scheduled" && new Date(c.scheduled_at) >= new Date()
  );
  const nextCall = [...upcomingCalls].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
  const transcriptDirty = transcript !== savedTranscript;
  const category = prospect.referral_source ?? "Not specified";
  const lastActivityAt = [
    prospect.updated_at,
    ...calls.map((call) => call.created_at),
    ...initialTranscripts.map((item) => item.updated_at),
  ].filter(Boolean).sort().at(-1) ?? prospect.created_at;

  const nextStep = prospect.status === "converted"
    ? { title: "Open the client record", detail: "Continue their care from the client workspace.", label: "View client", action: () => undefined }
    : !nextCall
      ? { title: "Schedule an introductory call", detail: "Choose a time to learn what support they’re looking for.", label: "Schedule call", action: () => setShowCallForm(true) }
      : !transcript.trim()
        ? { title: "Add the call transcript", detail: "Paste the conversation after the introductory call.", label: "Add transcript", action: () => transcriptRef.current?.focus() }
        : transcriptDirty
          ? { title: "Save the call transcript", detail: "Save your changes before generating a summary.", label: "Save transcript", action: saveTranscript }
          : !summaryContent
            ? { title: "Generate the call summary", detail: "Turn the saved transcript into a concise practitioner brief.", label: "Generate summary", action: generateSummary }
            : { title: "Convert prospect to client", detail: "The call is documented and this prospect is ready to move forward.", label: "Convert to client", action: handleConvert };

  return (
    <div className="prospect-workspace">
      <Link href="/prospects" className="prospect-breadcrumb">
        <ArrowRight className="rotate-180" aria-hidden="true" />
        Prospects
      </Link>

      <header className="prospect-header">
        {prospect.on_hold_at && (
          <div className="prospect-hold-banner">
            <PauseCircle className="h-4 w-4 shrink-0" />
            <span className="font-medium">On hold</span>
            {prospect.hold_reason && <span>— {prospect.hold_reason}</span>}
            {prospect.hold_follow_up_at && (
              <span className="text-amber-700">
                · follow up {new Date(prospect.hold_follow_up_at).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
        <div className="prospect-header-row">
          <div className="min-w-0">
            <div className="prospect-title-row">
              <h1>{prospect.full_name}</h1>
              <button type="button" className="prospect-title-edit" aria-label="Edit prospect information" title="Edit prospect information" onClick={() => setEditOpen(true)}>
                <Pencil aria-hidden="true" />
              </button>
              <span className={cx("badge", STATUS_COLORS[prospect.status])}>
                {PROSPECT_STATUS_LABELS[prospect.status]}
              </span>
            </div>
            <p className="prospect-category"><Tag aria-hidden="true" /> {category}</p>
          </div>
          <div className="prospect-header-actions">
            {prospect.status !== "converted" && (
              <>
                <HoldControl
                  kind="prospect"
                  recordId={prospect.id}
                  name={prospect.full_name}
                  onHold={Boolean(prospect.on_hold_at)}
                  followUpAt={prospect.hold_follow_up_at}
                  reason={prospect.hold_reason}
                />
                <button
                  type="button"
                  disabled={convertBusy}
                  onClick={handleConvert}
                  className="btn-primary"
                >
                  {convertBusy ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                  Convert to Client
                </button>
              </>
            )}
            {prospect.converted_client_id && (
              <Link
                href={`/clients/${prospect.converted_client_id}`}
                className="btn-primary"
              >
                <User /> View Client Record
              </Link>
            )}
          </div>
        </div>
      </header>

      {editOpen && (
        <section className="prospect-edit-panel">
          <div className="prospect-section-heading">
            <div><span>Prospect details</span><h2>Edit information</h2></div>
            <button type="button" className="prospect-icon-button" aria-label="Close edit panel" onClick={() => setEditOpen(false)}><X /></button>
          </div>
          <div className="prospect-edit-grid">
              <div>
                <label>Name</label>
                <input
                  autoComplete="off"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div>
                <label>Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as Prospect["status"])}
                >
                  {Object.entries(PROSPECT_STATUS_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Email</label>
                <input
                  type="email"
                  autoComplete="off"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
              <div>
                <label>Phone</label>
                <input
                  autoComplete="off"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>
              <div className="prospect-edit-wide">
                <label>Interest / category</label>
                <input
                  autoComplete="off"
                  placeholder="e.g. Psychology"
                  value={editReferral}
                  onChange={(e) => setEditReferral(e.target.value)}
                />
              </div>
          </div>
          <div className="prospect-edit-actions">
              <button
                onClick={handleDelete}
                className="prospect-delete-action"
              >
                <Trash2 /> Delete record
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditOpen(false)} className="btn-secondary">Cancel</button>
                <button
                  disabled={editSaving}
                  onClick={saveEdit}
                  className="btn-primary"
                >
                  {editSaving ? <Loader2 className="animate-spin" /> : <Save />} Save changes
                </button>
              </div>
          </div>
        </section>
      )}

      <div className="prospect-page-grid">
        <main className="prospect-main-canvas">
          <section className="prospect-content-section">
            <div className="prospect-section-heading">
              <div><span>Private workspace</span><h2><MessageSquare /> Notes</h2></div>
              <p className={cx("prospect-save-status", notesSaveState === "saved" && "is-saved")} aria-live="polite">
                {notesSaveState === "saving" ? "Saving…" : notesSaveState === "saved" ? "Saved" : "Autosaves as you type"}
              </p>
            </div>
            <textarea
              ref={notesRef}
              className="prospect-notes-input"
              rows={3}
              placeholder="Add context, preferences, or anything to remember…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </section>

          <section className="prospect-content-section prospect-transcript-section">
            <div className="prospect-section-heading">
              <div><span>Introductory call</span><h2><FileText /> Call transcript</h2></div>
              {savedTranscript.trim() && !transcriptDirty && <span className="prospect-saved-pill"><CheckCircle2 /> Saved</span>}
            </div>
            <p className="prospect-section-description">Add and save the transcript before generating an AI summary.</p>
            <textarea
              ref={transcriptRef}
              className="prospect-transcript-input"
              rows={4}
              placeholder="Paste the call transcript here…"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
            />
            <AdditionalTranscripts prospectId={prospect.id} initialTranscripts={initialTranscripts} primaryActions={<>
              <button
                disabled={transcriptSaving || !transcript.trim() || !transcriptDirty}
                onClick={saveTranscript}
                className="btn-secondary"
              >
                {transcriptSaving ? <Loader2 className="animate-spin" /> : <Save />} Save transcript
              </button>
              <button
                disabled={summaryBusy || !savedTranscript.trim() || transcriptDirty}
                onClick={generateSummary}
                className="btn-primary"
                title={transcriptDirty ? "Save the transcript before generating a summary" : undefined}
              >
                {summaryBusy ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate AI summary
              </button>
            </>} />

            {summaryContent && (
              <div className="prospect-summary-wrap">
            <SummaryCard
              title="Intro Call Summary (Practitioner)"
              content={summaryContent}
              model={summaryModel}
              onDelete={deletePractitionerSummary}
            />
            {prospect.ai_summary_generated_at && (
              <p className="text-xs text-ink-400 mt-1">
                Generated {formatDateTime(prospect.ai_summary_generated_at)}
              </p>
            )}
              </div>
            )}

            {clientSummaryContent && (
              <div className="prospect-summary-wrap">
            <SummaryCard
              title="Summary for the Client"
              content={clientSummaryContent}
              model={clientSummaryModel}
              onDelete={deleteClientSummary}
            />
                <div className="flex justify-end mt-2">
              <button
                onClick={() => setEmailModalOpen(true)}
                    className="btn-secondary"
              >
                    <Mail /> Email prospect
              </button>
                </div>
              </div>
            )}

          </section>
        </main>

        <aside className="prospect-context-rail" aria-label="Prospect context">
          <section className="prospect-next-step">
            <span className="prospect-rail-eyebrow">Next step</span>
            <h2>{nextStep.title}</h2>
            <p>{nextStep.detail}</p>
            {prospect.status === "converted" && prospect.converted_client_id ? (
              <Link href={`/clients/${prospect.converted_client_id}`} className="prospect-next-action">
                {nextStep.label} <ChevronRight />
              </Link>
            ) : (
              <button type="button" onClick={nextStep.action} className="prospect-next-action">
                {nextStep.label} <ChevronRight />
              </button>
            )}
          </section>

          <section className="prospect-rail-card">
            <div className="prospect-rail-heading"><CalendarDays /><h2>Next call</h2></div>
            {nextCall ? (
              <div className="prospect-next-call">
                <strong>{nextCall.call_type === "intro_call" ? "Introductory call" : "Follow-up call"}</strong>
                <time dateTime={nextCall.scheduled_at}>{formatDateTime(nextCall.scheduled_at)}</time>
                <span className="prospect-call-status"><Circle /> Scheduled</span>
              </div>
            ) : (
              <p className="prospect-rail-empty">No call scheduled</p>
            )}
            {calls.some((call) => call.id !== nextCall?.id) && (
              <div className="prospect-call-list">
                {calls.filter((call) => call.id !== nextCall?.id).slice(0, 4).map((call) => (
                  <CallRow
                    key={call.id}
                    call={call}
                    onComplete={() => markCallComplete(call.id)}
                    onCancel={() => cancelCall(call.id)}
                    onDelete={() => removeCall(call.id)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="prospect-rail-card">
            <div className="prospect-rail-heading"><User /><h2>Prospect context</h2></div>
            <dl className="prospect-context-list">
              <div><dt>Created</dt><dd>{formatDate(prospect.created_at)}</dd></div>
              <div><dt>Last activity</dt><dd>{formatDate(lastActivityAt)}</dd></div>
            </dl>
          </section>

          {(prospect.email || prospect.phone) && (
            <section className="prospect-rail-card">
              <div className="prospect-rail-heading"><Mail /><h2>Contact</h2></div>
              <div className="prospect-contact-list">
                {prospect.email && <a href={`mailto:${prospect.email}`}><Mail /> <span>{prospect.email}</span></a>}
                {prospect.phone && <a href={`tel:${prospect.phone}`}><Phone /> <span>{prospect.phone}</span></a>}
              </div>
            </section>
          )}
        </aside>
      </div>

      {/* Schedule call modal */}
      {showCallForm && (
        <ScheduleCallModal
          prospectId={prospect.id}
          prospectName={prospect.full_name}
          onClose={() => setShowCallForm(false)}
          onScheduled={(call) => {
            setCalls((prev) => [...prev, call].sort((a, b) => (a.scheduled_at < b.scheduled_at ? -1 : 1)));
            setShowCallForm(false);
          }}
        />
      )}

      {clientSummaryContent && (
        <ProspectSummaryEmailModal
          open={emailModalOpen}
          onClose={() => setEmailModalOpen(false)}
          prospectName={prospect.full_name}
          prospectEmail={prospect.email}
          practitionerName={practitionerName}
          practiceName={practiceName}
          summary={clientSummaryContent}
        />
      )}
    </div>
  );
}

function useAutoResizeTextarea(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  minHeight: number
) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.max(minHeight, element.scrollHeight)}px`;
  }, [minHeight, ref, value]);
}

// ---------------------------------------------------------------------------
// Modal overlay — dims page, centers content, closes on backdrop click or Esc
// ---------------------------------------------------------------------------
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Deliberately does NOT close on backdrop click. Native <input type="date">
  // / <input type="time"> pickers can dispatch a stray click on the page once
  // dismissed (e.g. after picking a value from the time dropdown), which used
  // to land on this backdrop and close the whole modal before the user could
  // submit. Closing is now only ever triggered by Cancel/X or Escape.
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
    >
      <div ref={ref} className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schedule Call modal — used both from the header button and the Calls card.
// Runs a conflict check against other sessions/calls/Google Calendar busy
// blocks before saving; if there's an overlap, requires an explicit
// "Schedule Anyway" confirmation rather than silently double-booking.
// ---------------------------------------------------------------------------
function ScheduleCallModal({
  prospectId,
  prospectName,
  onClose,
  onScheduled,
}: {
  prospectId: string;
  prospectName: string;
  onClose: () => void;
  onScheduled: (call: ProspectCall) => void;
}) {
  const [callType, setCallType] = useState<"intro_call" | "follow_up">("follow_up");
  const [callDate, setCallDate] = useState("");
  const [callTime, setCallTime] = useState("");
  const [callDuration, setCallDuration] = useState("30");
  const [callNotes, setCallNotes] = useState("");
  const [callSaving, setCallSaving] = useState(false);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [conflicts, setConflicts] = useState<ScheduleConflict[] | null>(null);
  const [conflictsAcknowledged, setConflictsAcknowledged] = useState(false);

  async function submit() {
    if (!callDate || !callTime) return;
    const scheduled_at = new Date(`${callDate}T${callTime}`).toISOString();
    const duration = parseInt(callDuration) || 30;

    // Re-check conflicts if the time/duration changed since the last check
    // (or on first submit) — require explicit acknowledgment before saving.
    if (!conflictsAcknowledged) {
      setCheckingConflicts(true);
      const found = await checkScheduleConflictsAction(scheduled_at, duration);
      setCheckingConflicts(false);
      if (found.length > 0) {
        setConflicts(found);
        return;
      }
    }

    setCallSaving(true);
    const call = await scheduleProspectCallAction({
      prospect_id: prospectId,
      prospect_name: prospectName,
      call_type: callType,
      scheduled_at,
      duration_minutes: duration,
      notes: callNotes || undefined,
    });
    setCallSaving(false);
    onScheduled(call);
  }

  return (
    <Modal onClose={onClose}>
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-ink-900 flex items-center gap-2">
            <CalendarPlus className="h-4 w-4 text-clay-500" />
            Schedule a Call with {prospectName}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-ink-50 text-ink-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-ink-600 block mb-1">Call type</label>
            <select
              className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-300"
              value={callType}
              onChange={(e) => {
                setCallType(e.target.value as "intro_call" | "follow_up");
                setConflictsAcknowledged(false);
              }}
            >
              <option value="follow_up">Follow-up Call</option>
              <option value="intro_call">Intro Call</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600 block mb-1">Duration (min)</label>
            <input
              type="number"
              className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-300"
              value={callDuration}
              onChange={(e) => {
                setCallDuration(e.target.value);
                setConflictsAcknowledged(false);
                setConflicts(null);
              }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600 block mb-1">Date</label>
            <input
              type="date"
              className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-300"
              value={callDate}
              onChange={(e) => {
                setCallDate(e.target.value);
                setConflictsAcknowledged(false);
                setConflicts(null);
              }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600 block mb-1">Time</label>
            <input
              type="time"
              className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-300"
              value={callTime}
              onChange={(e) => {
                setCallTime(e.target.value);
                setConflictsAcknowledged(false);
                setConflicts(null);
              }}
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-ink-600 block mb-1">Notes (optional)</label>
            <input
              className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-300"
              placeholder="Topics to cover…"
              value={callNotes}
              onChange={(e) => setCallNotes(e.target.value)}
            />
          </div>
        </div>

        {conflicts && conflicts.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <p className="font-medium mb-1">This time overlaps with:</p>
                <ul className="space-y-0.5">
                  {conflicts.map((c, i) => (
                    <li key={i}>
                      {c.title} — {formatDateTime(c.start_at)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex justify-end mt-2">
              <button
                onClick={() => {
                  setConflictsAcknowledged(true);
                  setConflicts(null);
                }}
                className="text-xs font-medium text-amber-800 hover:text-amber-900 underline"
              >
                Schedule anyway
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="btn-ghost text-sm px-3 py-1.5">Cancel</button>
          <button
            disabled={callSaving || checkingConflicts || !callDate || !callTime}
            onClick={submit}
            className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1.5"
          >
            {callSaving || checkingConflicts ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />}
            {checkingConflicts ? "Checking…" : "Schedule"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CallRow({
  call,
  onComplete,
  onCancel,
  onDelete,
}: {
  call: ProspectCall;
  onComplete: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const isUpcoming = call.status === "scheduled" && new Date(call.scheduled_at) >= new Date();

  return (
    <div className="flex items-center justify-between py-2 border-b border-ink-100 last:border-0 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <Clock className="h-3.5 w-3.5 text-ink-400 shrink-0" />
        <div className="min-w-0">
          <span className="text-sm text-ink-800 font-medium">
            {call.call_type === "intro_call" ? "Intro Call" : "Follow-up Call"}
          </span>
          <span className="text-xs text-ink-400 ml-2">{formatDateTime(call.scheduled_at)}</span>
          {call.duration_minutes && (
            <span className="text-xs text-ink-400 ml-1">· {call.duration_minutes} min</span>
          )}
          {call.notes && <p className="text-xs text-ink-500 truncate">{call.notes}</p>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span
          className={cx(
            "badge text-xs",
            call.status === "completed" && "bg-sage-100 text-sage-700",
            call.status === "scheduled" && "bg-clay-100 text-clay-700",
            call.status === "cancelled" && "bg-ink-100 text-ink-400"
          )}
        >
          {call.status}
        </span>
        {isUpcoming && (
          <>
            <button
              onClick={onComplete}
              className="p-1 hover:bg-sage-50 rounded text-ink-300 hover:text-sage-600"
              title="Mark complete"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onCancel}
              className="p-1 hover:bg-red-50 rounded text-ink-300 hover:text-red-500"
              title="Cancel"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <button
          onClick={onDelete}
          className="p-1 hover:bg-red-50 rounded text-ink-300 hover:text-red-500"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Additional call transcripts — beyond the original intro-call transcript
// above. Covers the "we had a second call before converting" workflow: add
// as many as needed, each with its own save + optional AI summary.
// ---------------------------------------------------------------------------
function AdditionalTranscripts({
  prospectId,
  initialTranscripts,
  primaryActions,
}: {
  prospectId: string;
  initialTranscripts: ProspectTranscript[];
  primaryActions: React.ReactNode;
}) {
  const [transcripts, setTranscripts] = useState(initialTranscripts);
  const [adding, setAdding] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftText, setDraftText] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  useAutoResizeTextarea(draftRef, draftText, 96);

  function defaultLabel() {
    return `Call ${transcripts.length + 2}`; // +2: the original transcript above counts as "Call 1"
  }

  async function addTranscript() {
    if (!draftText.trim()) return;
    setAddSaving(true);
    const t = await addProspectTranscriptAction(prospectId, draftLabel.trim() || defaultLabel(), draftText);
    setTranscripts((prev) => [...prev, t]);
    setDraftLabel("");
    setDraftText("");
    setAdding(false);
    setAddSaving(false);
  }

  function updateLocal(id: string, patch: Partial<ProspectTranscript>) {
    setTranscripts((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  async function removeTranscript(id: string) {
    if (!confirm("Delete this transcript?")) return;
    await deleteProspectTranscriptAction(id, prospectId);
    setTranscripts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="prospect-additional-transcripts">
      <div className="prospect-transcript-actions prospect-transcript-main-actions">
        {!adding && (
          <button
            type="button"
            onClick={() => {
              setDraftLabel(defaultLabel());
              setAdding(true);
            }}
            className="prospect-add-transcript"
          >
            <Plus /> Add another transcript
          </button>
        )}
        {primaryActions}
      </div>

      {transcripts.length > 0 && <div className="prospect-transcript-list">
        {transcripts.map((t) => (
          <TranscriptEntry
            key={t.id}
            prospectId={prospectId}
            transcript={t}
            onChange={(patch) => updateLocal(t.id, patch)}
            onDelete={() => removeTranscript(t.id)}
          />
        ))}
      </div>}

      {adding && (
        <div className="prospect-transcript-draft">
          <div>
            <label>Label</label>
            <input
              placeholder={defaultLabel()}
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
            />
          </div>
          <div>
            <label>Transcript</label>
            <textarea
              ref={draftRef}
              rows={4}
              placeholder="Paste the transcript for this call…"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
            />
          </div>
          <div className="prospect-transcript-actions">
            <button onClick={() => setAdding(false)} className="btn-secondary">Cancel</button>
            <button
              disabled={addSaving || !draftText.trim()}
              onClick={addTranscript}
              className="btn-secondary"
            >
              {addSaving ? <Loader2 className="animate-spin" /> : <Save />} Save transcript
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TranscriptEntry({
  prospectId,
  transcript,
  onChange,
  onDelete,
}: {
  prospectId: string;
  transcript: ProspectTranscript;
  onChange: (patch: Partial<ProspectTranscript>) => void;
  onDelete: () => void;
}) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [label, setLabel] = useState(transcript.label);
  const [text, setText] = useState(transcript.raw_text);
  const [saving, setSaving] = useState(false);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dirty = text !== transcript.raw_text;
  useAutoResizeTextarea(textareaRef, text, 96);

  async function save() {
    setSaving(true);
    await updateProspectTranscriptAction(transcript.id, prospectId, { raw_text: text });
    onChange({ raw_text: text });
    setSaving(false);
  }

  async function saveLabel() {
    const trimmed = label.trim() || transcript.label;
    setLabel(trimmed);
    setEditingLabel(false);
    if (trimmed !== transcript.label) {
      await updateProspectTranscriptAction(transcript.id, prospectId, { label: trimmed });
      onChange({ label: trimmed });
    }
  }

  async function generateSummary() {
    if (!text.trim()) return;
    setSummaryBusy(true);
    try {
      const updated = await generateProspectTranscriptSummaryAction(transcript.id, prospectId, text);
      if (updated) {
        onChange({
          ai_summary_content: updated.ai_summary_content,
          ai_summary_model: updated.ai_summary_model,
          ai_summary_generated_at: updated.ai_summary_generated_at,
        });
      }
    } finally {
      setSummaryBusy(false);
    }
  }

  async function deleteSummary() {
    if (!confirm("Delete this call's AI summary?")) return;
    await updateProspectTranscriptAction(transcript.id, prospectId, {
      ai_summary_content: null,
      ai_summary_model: null,
      ai_summary_generated_at: null,
    });
    onChange({ ai_summary_content: null, ai_summary_model: null, ai_summary_generated_at: null });
  }

  return (
    <div className="prospect-transcript-entry">
      <div className="flex items-center justify-between gap-2">
        {editingLabel ? (
          <input
            autoFocus
            className="text-sm font-medium border border-ink-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-clay-300"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={saveLabel}
            onKeyDown={(e) => e.key === "Enter" && saveLabel()}
          />
        ) : (
          <button
            onClick={() => setEditingLabel(true)}
            className="text-sm font-medium text-ink-800 flex items-center gap-1.5 hover:text-clay-600"
          >
            {transcript.label}
            <Pencil className="h-3 w-3 text-ink-300" />
          </button>
        )}
        <div className="flex items-center gap-1">
          <span className="text-xs text-ink-400">{formatDateTime(transcript.created_at)}</span>
          <button
            onClick={onDelete}
            className="p-1 hover:bg-red-50 rounded text-ink-300 hover:text-red-500"
            title="Delete transcript"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <button
          disabled={saving || !dirty}
          onClick={save}
          className="btn-secondary"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </button>
        <button
          disabled={summaryBusy || !text.trim() || dirty}
          onClick={generateSummary}
          className="btn-primary"
        >
          {summaryBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generate AI Summary
        </button>
      </div>

      {transcript.ai_summary_content && (
        <div className="pt-1">
          <SummaryCard
            title={`${transcript.label} — Summary`}
            content={transcript.ai_summary_content}
            model={transcript.ai_summary_model ?? undefined}
            onDelete={deleteSummary}
          />
          {transcript.ai_summary_generated_at && (
            <p className="text-xs text-ink-400 mt-1">
              Generated {formatDateTime(transcript.ai_summary_generated_at)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
