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
import { cx, formatDateTime } from "@/lib/utils";
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
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // Transcript
  const [transcript, setTranscript] = useState(prospect.fathom_transcript ?? "");
  const [transcriptSaving, setTranscriptSaving] = useState(false);

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

  async function saveNotes() {
    setNotesSaving(true);
    await updateProspectAction(prospect.id, { notes });
    setNotesSaving(false);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }

  async function saveTranscript() {
    setTranscriptSaving(true);
    await updateProspectAction(prospect.id, { fathom_transcript: transcript });
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
  const pastCalls = calls.filter(
    (c) => c.status !== "scheduled" || new Date(c.scheduled_at) < new Date()
  );

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="card p-5">
        {prospect.on_hold_at && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <PauseCircle className="h-4 w-4 shrink-0" />
            <span className="font-medium">On hold</span>
            {prospect.hold_reason && <span>— {prospect.hold_reason}</span>}
            {prospect.hold_follow_up_at && (
              <span className="text-amber-700">
                · follow up {new Date(prospect.hold_follow_up_at).toLocaleDateString()}
              </span>
            )}
            <span className="text-amber-700">· hidden from your prospect list</span>
          </div>
        )}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-semibold text-ink-900">{prospect.full_name}</h2>
              <span className={cx("badge text-xs", STATUS_COLORS[prospect.status])}>
                {PROSPECT_STATUS_LABELS[prospect.status]}
              </span>
            </div>
            <div className="space-y-1 text-sm text-ink-500">
              {prospect.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <a href={`mailto:${prospect.email}`} className="hover:text-clay-600">{prospect.email}</a>
                </div>
              )}
              {prospect.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{prospect.phone}</span>
                </div>
              )}
              {prospect.referral_source && (
                <div className="flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 shrink-0" />
                  <span>{prospect.referral_source}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            {prospect.status !== "converted" && (
              <button
                onClick={() => setShowCallForm(true)}
                className="btn-secondary text-sm px-3 py-1.5 flex items-center gap-1.5"
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                Schedule Call
              </button>
            )}
            <button
              onClick={() => setEditOpen(!editOpen)}
              className="btn-ghost text-sm px-3 py-1.5"
            >
              Edit
            </button>
            {prospect.status !== "converted" && (
              <HoldControl
                kind="prospect"
                recordId={prospect.id}
                name={prospect.full_name}
                onHold={Boolean(prospect.on_hold_at)}
                followUpAt={prospect.hold_follow_up_at}
                reason={prospect.hold_reason}
              />
            )}
            {prospect.status !== "converted" && (
              <button
                disabled={convertBusy}
                onClick={handleConvert}
                className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1.5"
              >
                {convertBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                Convert to Client
              </button>
            )}
            {prospect.converted_client_id && (
              <Link
                href={`/clients/${prospect.converted_client_id}`}
                className="btn-secondary text-sm px-3 py-1.5 flex items-center gap-1.5"
              >
                <User className="h-3.5 w-3.5" /> View Client Record
              </Link>
            )}
          </div>
        </div>

        {/* Edit form */}
        {editOpen && (
          <div className="border-t border-ink-100 pt-4 mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-ink-600 block mb-1">Name</label>
                <input
                  autoComplete="off"
                  className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-300"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-600 block mb-1">Status</label>
                <select
                  className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-300"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as Prospect["status"])}
                >
                  {Object.entries(PROSPECT_STATUS_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-ink-600 block mb-1">Email</label>
                <input
                  type="email"
                  autoComplete="off"
                  className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-300"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-600 block mb-1">Phone</label>
                <input
                  autoComplete="off"
                  className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-300"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-ink-600 block mb-1">Referral Source</label>
                <input
                  autoComplete="off"
                  className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-300"
                  placeholder="e.g. Word of mouth, Psychology Today…"
                  value={editReferral}
                  onChange={(e) => setEditReferral(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                onClick={handleDelete}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete record
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditOpen(false)} className="btn-ghost text-sm px-3 py-1.5">Cancel</button>
                <button
                  disabled={editSaving}
                  onClick={saveEdit}
                  className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1.5"
                >
                  {editSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="card p-4">
        <h3 className="font-medium text-sm text-ink-800 mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-ink-400" />
          Notes
        </h3>
        <textarea
          className="w-full border border-ink-200 rounded-lg px-3 py-2.5 text-sm text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-clay-300 resize-none"
          rows={5}
          placeholder="Free-form notes about this prospect…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="flex items-center justify-end gap-2 mt-2">
          {notesSaved && <span className="text-xs text-sage-600">Saved</span>}
          <button
            disabled={notesSaving}
            onClick={saveNotes}
            className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1.5"
          >
            {notesSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Notes
          </button>
        </div>
      </div>

      {/* Transcript + AI Summary */}
      <div className="card p-4 space-y-4">
        <h3 className="font-medium text-sm text-ink-800 flex items-center gap-2">
          <FileText className="h-4 w-4 text-ink-400" />
          Call Transcript
        </h3>
        <textarea
          className="w-full border border-ink-200 rounded-lg px-3 py-2.5 text-sm text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-clay-300 resize-none font-mono"
          rows={8}
          placeholder="Paste your Fathom transcript here…"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <button
            disabled={transcriptSaving || !transcript.trim()}
            onClick={saveTranscript}
            className="btn-ghost text-sm px-3 py-1.5 flex items-center gap-1.5"
          >
            {transcriptSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Transcript
          </button>
          <button
            disabled={summaryBusy || !transcript.trim()}
            onClick={generateSummary}
            className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1.5"
          >
            {summaryBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate AI Summary
          </button>
        </div>

        {summaryContent && (
          <div className="pt-2">
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
          <div className="pt-2">
            <SummaryCard
              title="Summary for the Client"
              content={clientSummaryContent}
              model={clientSummaryModel}
              onDelete={deleteClientSummary}
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={() => setEmailModalOpen(true)}
                className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1.5"
              >
                <Mail className="h-3.5 w-3.5" /> Email Prospect This Summary
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Additional call transcripts — e.g. a second call before conversion */}
      <AdditionalTranscripts prospectId={prospect.id} initialTranscripts={initialTranscripts} />

      {/* Follow-up Calls */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm text-ink-800 flex items-center gap-2">
            <Clock className="h-4 w-4 text-ink-400" />
            Calls
          </h3>
          {prospect.status !== "converted" && (
            <button
              onClick={() => setShowCallForm(true)}
              className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Schedule
            </button>
          )}
        </div>

        {/* Upcoming */}
        {upcomingCalls.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-2">Upcoming</p>
            <div className="space-y-2">
              {upcomingCalls.map((call) => (
                <CallRow
                  key={call.id}
                  call={call}
                  onComplete={() => markCallComplete(call.id)}
                  onCancel={() => cancelCall(call.id)}
                  onDelete={() => removeCall(call.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Past */}
        {pastCalls.length > 0 && (
          <div>
            <p className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-2">Past</p>
            <div className="space-y-2">
              {pastCalls.map((call) => (
                <CallRow
                  key={call.id}
                  call={call}
                  onComplete={() => markCallComplete(call.id)}
                  onCancel={() => cancelCall(call.id)}
                  onDelete={() => removeCall(call.id)}
                />
              ))}
            </div>
          </div>
        )}

        {calls.length === 0 && (
          <p className="text-sm text-ink-400">No calls scheduled yet.</p>
        )}
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
}: {
  prospectId: string;
  initialTranscripts: ProspectTranscript[];
}) {
  const [transcripts, setTranscripts] = useState(initialTranscripts);
  const [adding, setAdding] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftText, setDraftText] = useState("");
  const [addSaving, setAddSaving] = useState(false);

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
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm text-ink-800 flex items-center gap-2">
          <FileText className="h-4 w-4 text-ink-400" />
          Additional Call Transcripts
        </h3>
        {!adding && (
          <button
            onClick={() => {
              setDraftLabel(defaultLabel());
              setAdding(true);
            }}
            className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Transcript
          </button>
        )}
      </div>

      {transcripts.length === 0 && !adding && (
        <p className="text-sm text-ink-400">
          No additional transcripts yet. Add one if you have a second call with this prospect before converting.
        </p>
      )}

      <div className="space-y-4">
        {transcripts.map((t) => (
          <TranscriptEntry
            key={t.id}
            prospectId={prospectId}
            transcript={t}
            onChange={(patch) => updateLocal(t.id, patch)}
            onDelete={() => removeTranscript(t.id)}
          />
        ))}
      </div>

      {adding && (
        <div className="bg-ink-50 rounded-xl p-3 space-y-3">
          <div>
            <label className="text-xs font-medium text-ink-600 block mb-1">Label</label>
            <input
              className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-300"
              placeholder={defaultLabel()}
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600 block mb-1">Transcript</label>
            <textarea
              className="w-full border border-ink-200 rounded-lg px-3 py-2.5 text-sm text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-clay-300 resize-none font-mono"
              rows={6}
              placeholder="Paste the transcript for this call…"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdding(false)} className="btn-ghost text-sm px-3 py-1.5">Cancel</button>
            <button
              disabled={addSaving || !draftText.trim()}
              onClick={addTranscript}
              className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1.5"
            >
              {addSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Transcript
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
  const dirty = text !== transcript.raw_text;

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
    <div className="border border-ink-100 rounded-xl p-3 space-y-3">
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
        className="w-full border border-ink-200 rounded-lg px-3 py-2.5 text-sm text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-clay-300 resize-none font-mono"
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <button
          disabled={saving || !dirty}
          onClick={save}
          className="btn-ghost text-sm px-3 py-1.5 flex items-center gap-1.5"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </button>
        <button
          disabled={summaryBusy || !text.trim()}
          onClick={generateSummary}
          className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1.5"
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
