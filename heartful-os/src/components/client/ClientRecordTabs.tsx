"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AiSummary,
  CheckIn,
  Client,
  ClientDocument,
  ClientMemoryItem,
  DocumentType,
  DOCUMENT_LABELS,
  EmailLog,
  FormSubmission,
  FormTemplate,
  JourneyMilestone,
  Message,
  PortalAssignment,
  PostIntegrationForm,
  PreparationPlan,
  Session,
  Task,
} from "@/lib/types";
import { cx, formatDate, formatDateTime, isGeneralPaperwork, relativeDueLabel, SESSION_TYPE_LABELS, TABS, Tab } from "@/lib/utils";
import {
  FileText,
  Upload,
  History,
  Download,
  MessageSquare,
  Send,
  Brain,
  Calendar,
  Plus,
  CheckCircle2,
  XCircle,
  FileSignature,
  ClipboardCheck,
  Award,
  StickyNote,
  UserPlus,
  Activity,
  Mail,
  Sparkles,
  Loader2,
  EyeOff,
  Eye,
  Trash2,
  PlayCircle,
  StopCircle,
  Pill,
} from "lucide-react";
import {
  uploadDocumentAction,
  sendMessageAction,
  addClientDocumentAction,
  addSessionAction,
  cancelSessionAction,
  completeSessionAction,
  setSessionCopilotStateAction,
  markMessagesReadAction,
  deleteAiSummaryAction,
} from "@/lib/actions";
import { SessionType } from "@/lib/types";
import SummaryCard from "@/components/ai/SummaryCard";
import { buildClientActivity, ActivityKind } from "@/lib/activity";

const SESSION_TYPE_OPTIONS: { value: SessionType; label: string }[] = [
  { value: "intake_assessment", label: "Intake Assessment" },
  { value: "preparation", label: "Preparation" },
  { value: "harm_reduction_support", label: "Journey Day (Harm Reduction Support)" },
  { value: "check_in_12hr", label: "12-Hour Check-In" },
  { value: "integration_1", label: "Integration Session 1" },
  { value: "integration_2", label: "Integration Session 2" },
  { value: "other", label: "Other" },
];


export default function ClientRecordTabs({
  client,
  documents,
  sessions,
  aiSummaries,
  memory,
  messages,
  postIntegrationForms,
  preparationPlan,
  checkIns,
  tasks,
  portalAssignments,
  formTemplates,
  formSubmissions,
  milestones,
  emailLogs,
  defaultTab,
}: {
  client: Client;
  documents: ClientDocument[];
  sessions: Session[];
  aiSummaries: AiSummary[];
  memory: ClientMemoryItem[];
  messages: Message[];
  postIntegrationForms: PostIntegrationForm[];
  preparationPlan?: PreparationPlan;
  checkIns: CheckIn[];
  tasks: Task[];
  portalAssignments: PortalAssignment[];
  formTemplates: FormTemplate[];
  formSubmissions: FormSubmission[];
  milestones: JourneyMilestone[];
  emailLogs: EmailLog[];
  defaultTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(defaultTab ?? "Documents");

  // Sync tab state when the URL ?tab= param changes (e.g. from ClientActionCard
  // links or any other Link that navigates to this page with a tab param).
  useEffect(() => {
    if (defaultTab && defaultTab !== tab) setTab(defaultTab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultTab]);

  // Whenever the practitioner is looking at (or lands directly on, via the
  // dashboard's unread-messages link) this client's Messages tab, clear the
  // unread state so the sidebar/dashboard badges drop back down.
  useEffect(() => {
    if (tab === "Messages") markMessagesReadAction(client.id);
  }, [tab, client.id]);

  return (
    <div>
      <div className="flex gap-1 border-b border-ink-100 mb-5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cx(
              "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
              tab === t ? "border-clay-500 text-clay-700" : "border-transparent text-ink-500 hover:text-ink-700"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Documents" && (
        <DocumentsTab
          clientId={client.id}
          clientName={client.full_name}
          documents={documents}
          formTemplates={formTemplates}
          formSubmissions={formSubmissions}
        />
      )}
      {tab === "Sessions" && <SessionsTab clientId={client.id} sessions={sessions} tasks={tasks} />}
      {tab === "Journey & AI" && <JourneyTab clientId={client.id} aiSummaries={aiSummaries} memory={memory} preparationPlan={preparationPlan} />}
      {tab === "AI Copilot" && (
        <ClientCopilotTab
          clientId={client.id}
          clientName={client.full_name}
          sessions={sessions}
          aiSummaries={aiSummaries}
          documents={documents}
          formTemplates={formTemplates}
          formSubmissions={formSubmissions}
          onOpenDocuments={() => setTab("Documents")}
        />
      )}
      {tab === "Messages" && <MessagesTab clientId={client.id} messages={messages} portalAssignments={portalAssignments} />}
      {tab === "History" && (
        <HistoryTab
          client={client}
          sessions={sessions}
          documents={documents}
          formSubmissions={formSubmissions}
          messages={messages}
          tasks={tasks}
          portalAssignments={portalAssignments}
          checkIns={checkIns}
          postIntegrationForms={postIntegrationForms}
          milestones={milestones}
          aiSummaries={aiSummaries}
          memory={memory}
          emailLogs={emailLogs}
          onNavigateTab={setTab}
        />
      )}
    </div>
  );
}

const ACTIVITY_ICON: Record<ActivityKind, typeof Calendar> = {
  client_created: UserPlus,
  session_scheduled: Calendar,
  session_completed: CheckCircle2,
  session_cancelled: XCircle,
  document_uploaded: Upload,
  form_submitted: FileText,
  form_signed: FileSignature,
  message_out: Send,
  message_in: MessageSquare,
  task_completed: ClipboardCheck,
  assignment_completed: ClipboardCheck,
  check_in: Activity,
  integration_form: FileText,
  milestone: Award,
  ai_summary: Brain,
  memory_item: StickyNote,
  intro_email_sent: Mail,
  journey_prep_email_sent: Mail,
  journey_started: PlayCircle,
  journey_ended: StopCircle,
  booster_dose_given: Pill,
};

function HistoryTab({
  client,
  sessions,
  documents,
  formSubmissions,
  messages,
  tasks,
  portalAssignments,
  checkIns,
  postIntegrationForms,
  milestones,
  aiSummaries,
  memory,
  emailLogs,
  onNavigateTab,
}: {
  client: Client;
  sessions: Session[];
  documents: ClientDocument[];
  formSubmissions: FormSubmission[];
  messages: Message[];
  tasks: Task[];
  portalAssignments: PortalAssignment[];
  checkIns: CheckIn[];
  postIntegrationForms: PostIntegrationForm[];
  milestones: JourneyMilestone[];
  aiSummaries: AiSummary[];
  memory: ClientMemoryItem[];
  emailLogs: EmailLog[];
  onNavigateTab: (tab: Tab) => void;
}) {
  const events = buildClientActivity({
    client,
    sessions,
    documents,
    formSubmissions,
    messages,
    tasks,
    portalAssignments,
    checkIns,
    postIntegrationForms,
    milestones,
    aiSummaries,
    memory,
    emailLogs,
  });

  return (
    <div className="card p-5">
      <h3 className="font-medium text-ink-900 mb-1 flex items-center gap-2">
        <History className="h-4 w-4 text-clay-500" /> Activity History
      </h3>
      <p className="text-xs text-ink-400 mb-4">
        Everything recorded for this client, most recent first — sessions, documents, forms, messages, and milestones.
      </p>
      {events.length === 0 ? (
        <p className="text-sm text-ink-400">No activity recorded yet.</p>
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-[9px] top-1.5 bottom-1.5 w-px bg-ink-100" />
          {events.map((e) => {
            const Icon = ACTIVITY_ICON[e.kind];
            const isClickable = !!(e.href || e.tab);
            const inner = (
              <>
                <div className="text-[11px] text-ink-400">{formatDateTime(e.at)}</div>
                <div className={`text-sm font-medium ${isClickable ? "text-clay-700 group-hover:underline" : "text-ink-900"}`}>
                  {e.title}
                </div>
                {e.detail && <div className="text-xs text-ink-500 mt-0.5">{e.detail}</div>}
              </>
            );
            return (
              <div key={e.id} className="relative pb-5 last:pb-0 group">
                <div className="absolute -left-6 top-0.5 h-4.5 w-4.5 rounded-full bg-white border-2 border-clay-300 flex items-center justify-center">
                  <Icon className="h-2.5 w-2.5 text-clay-600" />
                </div>
                {e.href ? (
                  <Link href={e.href} className="block hover:bg-ink-50/60 -mx-2 px-2 py-0.5 rounded-lg transition-colors">
                    {inner}
                  </Link>
                ) : e.tab ? (
                  <button onClick={() => onNavigateTab(e.tab as Tab)} className="block w-full text-left hover:bg-ink-50/60 -mx-2 px-2 py-0.5 rounded-lg transition-colors">
                    {inner}
                  </button>
                ) : (
                  <div>{inner}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Stage groups define how forms are bucketed on the Documents tab.
// Each group shows as its own labeled section with a description of when
// you'd normally fill these out together with the client.
const FORM_STAGE_GROUPS: {
  label: string;
  sessionTypes: SessionType[];
  hint: string;
}[] = [
  {
    label: "Intake Forms",
    sessionTypes: ["intake_assessment"],
    hint: "Complete during or before the first session",
  },
  {
    label: "Preparation Forms",
    sessionTypes: ["preparation"],
    hint: "Complete during preparation sessions",
  },
  {
    label: "Integration Session 1 Forms",
    sessionTypes: ["integration_1"],
    hint: "Complete before or during the first integration session",
  },
  {
    label: "Integration Session 2 Forms",
    sessionTypes: ["integration_2"],
    hint: "Complete before or during the second integration session",
  },
];

function DocumentsTab({
  clientId,
  clientName,
  documents,
  formTemplates,
  formSubmissions,
}: {
  clientId: string;
  clientName: string;
  documents: ClientDocument[];
  formTemplates: FormTemplate[];
  formSubmissions: FormSubmission[];
}) {
  // Forms that have a matching digital template
  const formBacked = documents.filter((d) => formTemplates.some((t) => t.document_type === d.document_type));
  // Documents that are file-upload only (no matching template) AND have
  // actually been uploaded — empty placeholder slots are hidden to keep the
  // UI clean. They were seeded during early development and aren't needed
  // until a practitioner deliberately uploads something via Add Document.
  const uploadOnly = documents.filter(
    (d) =>
      !formTemplates.some((t) => t.document_type === d.document_type) &&
      d.versions.length > 0
  );

  // The signed-once agreements get their own bucket at the top rather than
  // being filed under Intake — they're practice-wide paperwork, not intake
  // work, which is why the phase views no longer show them.
  const agreementDocs = formBacked.filter((d) => isGeneralPaperwork(d.document_type));

  // Build stage-grouped buckets. A form can appear in multiple stages if its
  // template lists multiple session_types (e.g. Participant Screening).
  const grouped = FORM_STAGE_GROUPS.map((group) => ({
    ...group,
    docs: formBacked.filter((doc) => {
      if (isGeneralPaperwork(doc.document_type)) return false;
      const tmpl = formTemplates.find((t) => t.document_type === doc.document_type);
      return tmpl?.session_types?.some((st) => group.sessionTypes.includes(st));
    }),
  }));

  // Any form-backed docs not claimed by any stage group (e.g. ungrouped new templates)
  const allGroupedDocIds = new Set([
    ...grouped.flatMap((g) => g.docs.map((d) => d.id)),
    ...agreementDocs.map((d) => d.id),
  ]);
  const ungrouped = formBacked.filter((d) => !allGroupedDocIds.has(d.id));

  return (
    <div className="space-y-8">
      {/* Agreements — signed once, not tied to a session */}
      {agreementDocs.length > 0 && (
        <div>
          <div className="mb-3">
            <h3 className="font-semibold text-ink-900">Agreements &amp; Consents</h3>
            <p className="text-xs text-ink-400 mt-0.5">Signed once when the client joins the practice</p>
          </div>
          <div className="space-y-2">
            {agreementDocs.map((doc) => {
              const template = formTemplates.find((t) => t.document_type === doc.document_type);
              const submission = formSubmissions.find((s) => s.document_id === doc.id);
              if (!template) return null;
              return (
                <FormSubmissionCard
                  key={doc.id}
                  document={doc}
                  template={template}
                  submission={submission}
                  clientName={clientName}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Staged form groups */}
      {grouped.map((group) =>
        group.docs.length === 0 ? null : (
          <div key={group.label}>
            <div className="mb-3">
              <h3 className="font-semibold text-ink-900">{group.label}</h3>
              <p className="text-xs text-ink-400 mt-0.5">{group.hint}</p>
            </div>
            <div className="space-y-2">
              {group.docs.map((doc) => {
                const template = formTemplates.find((t) => t.document_type === doc.document_type);
                const submission = formSubmissions.find((s) => s.document_id === doc.id);
                if (!template) return null;
                return (
                  <FormSubmissionCard
                    key={doc.id}
                    document={doc}
                    template={template}
                    submission={submission}
                    clientName={clientName}
                  />
                );
              })}
            </div>
          </div>
        )
      )}

      {/* Any form-backed docs not mapped to a stage */}
      {ungrouped.length > 0 && (
        <div>
          <h3 className="font-semibold text-ink-900 mb-3">Other Forms</h3>
          <div className="space-y-2">
            {ungrouped.map((doc) => {
              const template = formTemplates.find((t) => t.document_type === doc.document_type);
              const submission = formSubmissions.find((s) => s.document_id === doc.id);
              if (!template) return null;
              return (
                <FormSubmissionCard
                  key={doc.id}
                  document={doc}
                  template={template}
                  submission={submission}
                  clientName={clientName}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* File-upload documents */}
      <div>
        {(formBacked.length > 0 || ungrouped.length > 0) && (
          <div className="mb-3">
            <h3 className="font-semibold text-ink-900">Uploaded Documents</h3>
            <p className="text-xs text-ink-400 mt-0.5">PDF or file uploads — session notes, additional consents, etc.</p>
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-4">
          <AddDocumentCard clientId={clientId} documents={documents} />
          {uploadOnly.map((doc) => (
            <div key={doc.id} className="card p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-clay-500" />
                  <span className="font-medium text-sm text-ink-900">{DOCUMENT_LABELS[doc.document_type]}</span>
                </div>
                <span
                  className={cx(
                    "badge",
                    doc.status === "missing" && "bg-ink-100 text-ink-500",
                    doc.status === "uploaded" && "bg-clay-100 text-clay-700",
                    doc.status === "signed" && "bg-sage-100 text-sage-700",
                    doc.status === "reviewed" && "bg-plum-100 text-plum-700"
                  )}
                >
                  {doc.status}
                </span>
              </div>
              {doc.versions.length > 0 ? (
                <div className="text-xs text-ink-500 mb-3">
                  {doc.versions[0].file_name} · v{doc.versions[0].version_number} · {formatDate(doc.versions[0].created_at)}
                </div>
              ) : (
                <div className="text-xs text-ink-400 mb-3">{doc.required ? "Required — not yet uploaded" : "Optional — not yet uploaded"}</div>
              )}
              <div className="flex items-center gap-2 text-xs">
                <UploadButton documentId={doc.id} clientId={clientId} />
                {doc.versions.length > 0 && (
                  <>
                    <button className="btn-ghost flex items-center gap-1 px-2 py-1">
                      <Download className="h-3.5 w-3.5" /> Download
                    </button>
                    {doc.versions.length > 1 && (
                      <button className="btn-ghost flex items-center gap-1 px-2 py-1">
                        <History className="h-3.5 w-3.5" /> {doc.versions.length} versions
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Simple clickable row — title + status badge, entire row opens the form full-page.
function FormSubmissionCard({
  document: doc,
  template,
  submission,
}: {
  document: ClientDocument;
  template: FormTemplate;
  submission?: FormSubmission;
  clientName: string;
}) {
  const submissionStatus = submission?.status ?? "missing";
  const statusBadge =
    doc.status === "reviewed"
      ? { label: "Reviewed", cls: "bg-blue-100 text-blue-700" }
      : submissionStatus === "signed"
        ? { label: "Signed", cls: "bg-sage-100 text-sage-700" }
        : submissionStatus === "submitted"
          ? { label: "Submitted", cls: "bg-sage-100 text-sage-700" }
          : submissionStatus === "in_progress"
            ? { label: "In Progress", cls: "bg-amber-100 text-amber-700" }
            : { label: "Not Started", cls: "bg-ink-100 text-ink-500" };

  return (
    <Link
      href={`/clients/${doc.client_id}/forms/${doc.id}`}
      target="_blank"
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-ink-100 hover:bg-ink-50/60 hover:border-clay-200 transition-colors group"
    >
      <FileText className="h-4 w-4 text-ink-400 shrink-0 group-hover:text-clay-500" />
      <span className="text-sm font-medium text-ink-800 group-hover:text-clay-700">
        {DOCUMENT_LABELS[doc.document_type] ?? template.title}
      </span>
      <span className={cx("badge ml-auto", statusBadge.cls)}>{statusBadge.label}</span>
    </Link>
  );
}

function AddDocumentCard({ clientId, documents }: { clientId: string; documents: ClientDocument[] }) {
  const existingTypes = new Set(documents.map((d) => d.document_type));
  // "other" stays available indefinitely so practitioners can always attach
  // an ad-hoc consent/form beyond the 12 standard types.
  const availableTypes = (Object.keys(DOCUMENT_LABELS) as DocumentType[]).filter(
    (t) => t === "other" || !existingTypes.has(t)
  );
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<DocumentType>(availableTypes[0]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  if (availableTypes.length === 0) return null;

  return (
    <div className="card p-4 border-2 border-dashed border-ink-200 flex items-center justify-center min-h-[140px]">
      {!open ? (
        <button className="btn-ghost flex items-center gap-1.5 text-sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add Document / Consent
        </button>
      ) : (
        <form
          className="w-full space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await addClientDocumentAction(clientId, type, file?.name);
            setBusy(false);
            setOpen(false);
            setFile(null);
          }}
        >
          <select
            value={type}
            onChange={(e) => setType(e.target.value as DocumentType)}
            className="w-full border border-ink-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
          >
            {availableTypes.map((t) => (
              <option key={t} value={t}>
                {DOCUMENT_LABELS[t]}
              </option>
            ))}
          </select>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-xs w-full"
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost text-xs px-3 py-1.5" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn-primary text-xs px-3 py-1.5">
              {busy ? "Adding..." : "Add"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function UploadButton({ documentId, clientId }: { documentId: string; clientId: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className="btn-ghost flex items-center gap-1 px-2 py-1 cursor-pointer">
      <Upload className="h-3.5 w-3.5" /> {busy ? "Uploading..." : "Upload / Replace"}
      <input
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.png,.jpg"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          await uploadDocumentAction(documentId, clientId, file.name);
          setBusy(false);
        }}
      />
    </label>
  );
}

function SessionsTab({ clientId, sessions, tasks }: { clientId: string; sessions: Session[]; tasks: Task[] }) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-ink-900 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-clay-500" /> All Sessions
          </h3>
          <button className="btn-ghost text-xs flex items-center gap-1 px-2 py-1" onClick={() => setOpen((o) => !o)}>
            <Plus className="h-3.5 w-3.5" /> Schedule
          </button>
        </div>

        {open && <ScheduleSessionForm clientId={clientId} onClose={() => setOpen(false)} />}

        <div className="space-y-2 mt-1">
          {sessions.map((s) => (
            <div key={s.id} className="py-2 border-b border-ink-100 last:border-0">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/clients/${clientId}/sessions/${s.id}`}
                  className="min-w-0 hover:text-clay-600 transition-colors"
                >
                  <div className="text-sm text-ink-900 capitalize truncate hover:underline">{s.session_type.replace(/_/g, " ")}</div>
                  <div className="text-xs text-ink-400">
                    {formatDateTime(s.scheduled_at)}
                    {s.location ? ` · ${s.location}` : ""}
                  </div>
                </Link>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={cx(
                      "badge",
                      s.status === "completed" && "bg-sage-100 text-sage-700",
                      s.status === "scheduled" && "bg-clay-100 text-clay-700",
                      (s.status === "cancelled" || s.status === "no_show") && "bg-ink-100 text-ink-500"
                    )}
                  >
                    {s.status}
                  </span>
                  {s.status === "scheduled" && (
                    <>
                      <button
                        disabled={busyId === s.id}
                        className="btn-ghost text-[11px] px-1.5 py-0.5"
                        onClick={async () => {
                          setBusyId(s.id);
                          await completeSessionAction(s.id, clientId);
                          setBusyId(null);
                        }}
                      >
                        Complete
                      </button>
                      <button
                        disabled={busyId === s.id}
                        className="btn-ghost text-[11px] px-1.5 py-0.5 text-clay-600"
                        onClick={async () => {
                          setBusyId(s.id);
                          await cancelSessionAction(s.id, clientId);
                          setBusyId(null);
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
          {sessions.length === 0 && <p className="text-sm text-ink-400">No sessions yet.</p>}
        </div>
      </div>
      <div className="card p-4">
        <h3 className="font-medium text-ink-900 mb-3">Tasks &amp; Reminders</h3>
        <div className="space-y-2">
          {tasks.map((t) => (
            <Link
              key={t.id}
              href={`/clients/${clientId}/tasks/${t.id}`}
              className="flex items-center justify-between py-2 border-b border-ink-100 last:border-0 hover:text-clay-600 transition-colors"
            >
              <div className="text-sm text-ink-900 hover:underline">{t.title}</div>
              <span className={cx("badge", t.status === "completed" ? "bg-sage-100 text-sage-700" : "bg-ink-100 text-ink-600")}>
                {t.status === "completed" ? "Done" : relativeDueLabel(t.due_at)}
              </span>
            </Link>
          ))}
          {tasks.length === 0 && <p className="text-sm text-ink-400">No tasks yet.</p>}
        </div>
      </div>
    </div>
  );
}

function ScheduleSessionForm({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const [sessionType, setSessionType] = useState<SessionType>("preparation");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(60);
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="grid sm:grid-cols-2 gap-2 mb-3 p-3 rounded-xl border border-dashed border-ink-200"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await addSessionAction({
          clientId,
          sessionType,
          scheduledAt: new Date(`${date}T${time}:00`).toISOString(),
          durationMinutes: duration,
          location: location || undefined,
        });
        setBusy(false);
        onClose();
      }}
    >
      <select
        value={sessionType}
        onChange={(e) => setSessionType(e.target.value as SessionType)}
        className="sm:col-span-2 border border-ink-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
      >
        {SESSION_TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
        className="border border-ink-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
      />
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        required
        className="border border-ink-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
      />
      <input
        type="number"
        min={15}
        step={15}
        value={duration}
        onChange={(e) => setDuration(Number(e.target.value))}
        placeholder="Duration (min)"
        className="border border-ink-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
      />
      <input
        type="text"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Location (optional)"
        className="border border-ink-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
      />
      <div className="sm:col-span-2 flex justify-end gap-2">
        <button type="button" className="btn-ghost text-xs px-3 py-1.5" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" disabled={busy} className="btn-primary text-xs px-3 py-1.5">
          {busy ? "Saving..." : "Schedule"}
        </button>
      </div>
    </form>
  );
}

function JourneyTab({
  clientId,
  aiSummaries,
  memory,
  preparationPlan,
}: {
  clientId: string;
  aiSummaries: AiSummary[];
  memory: ClientMemoryItem[];
  preparationPlan?: PreparationPlan;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [localSummaries, setLocalSummaries] = useState(aiSummaries);

  async function handleDelete(summaryId: string) {
    if (!confirm("Delete this AI summary? This cannot be undone.")) return;
    setDeletingId(summaryId);
    await deleteAiSummaryAction(summaryId, clientId);
    setLocalSummaries((prev) => prev.filter((s) => s.id !== summaryId));
    setDeletingId(null);
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-4">
        <h3 className="font-medium text-ink-900 flex items-center gap-2">
          <Brain className="h-4 w-4 text-plum-500" /> AI Summaries
        </h3>
        {localSummaries.length === 0 && <p className="text-sm text-ink-400">No AI summaries generated yet.</p>}
        {localSummaries.map((s) => (
          <div key={s.id} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm text-ink-900">{s.title}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-400">{formatDateTime(s.created_at)}</span>
                <button
                  disabled={deletingId === s.id}
                  onClick={() => handleDelete(s.id)}
                  className="p-1 rounded hover:bg-red-50 text-ink-300 hover:text-red-500 transition-colors"
                  title="Delete summary"
                >
                  {deletingId === s.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
            <dl className="space-y-1.5">
              {Object.entries(s.content).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] uppercase tracking-wide text-ink-400">{k.replace(/_/g, " ")}</dt>
                  <dd className="text-sm text-ink-700 whitespace-pre-line">
                    {Array.isArray(v) ? v.join(", ") : String(v)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        {preparationPlan && (
          <div className="card p-4">
            <span className="font-medium text-sm text-ink-900">Preparation &amp; Navigation Plan</span>
            <dl className="space-y-1.5 mt-2">
              {Object.entries(preparationPlan)
                .filter(([k]) => !["id", "client_id", "updated_at"].includes(k))
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] uppercase tracking-wide text-ink-400">{k.replace(/_/g, " ")}</dt>
                    <dd className="text-sm text-ink-700 whitespace-pre-line">{String(v ?? "—")}</dd>
                  </div>
                ))}
            </dl>
          </div>
        )}
      </div>
      <div>
        <h3 className="font-medium text-ink-900 mb-3">Client Memory</h3>
        <div className="space-y-2">
          {memory.map((m) => (
            <div key={m.id} className="card p-3">
              <span className="badge bg-ink-100 text-ink-600 mb-1 capitalize">{m.item_type.replace(/_/g, " ")}</span>
              <p className="text-sm text-ink-700">{m.content}</p>
            </div>
          ))}
          {memory.length === 0 && <p className="text-sm text-ink-400">No memory items yet.</p>}
        </div>
      </div>
    </div>
  );
}

function ClientCopilotTab({
  clientId,
  clientName,
  sessions,
  aiSummaries,
  documents,
  formTemplates,
  formSubmissions,
  onOpenDocuments,
}: {
  clientId: string;
  clientName: string;
  sessions: Session[];
  aiSummaries: AiSummary[];
  documents: ClientDocument[];
  formTemplates: FormTemplate[];
  formSubmissions: FormSubmission[];
  onOpenDocuments: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [briefingFor, setBriefingFor] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<{ content: Record<string, unknown>; model?: string } | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [expandedBriefing, setExpandedBriefing] = useState<string | null>(null);
  const [deletingBriefingId, setDeletingBriefingId] = useState<string | null>(null);
  const [localBriefings, setLocalBriefings] = useState(
    aiSummaries.filter((s) => s.summary_type === "prepare_me_briefing" && s.session_id)
  );

  // Index past prepare_me_briefings by session_id for quick lookup
  const pastBriefingsBySession = localBriefings
    .reduce<Record<string, AiSummary[]>>((acc, s) => {
      const key = s.session_id!;
      acc[key] = [...(acc[key] ?? []), s];
      return acc;
    }, {});

  async function deleteBriefing(summaryId: string) {
    if (!confirm("Delete this briefing? This cannot be undone.")) return;
    setDeletingBriefingId(summaryId);
    await deleteAiSummaryAction(summaryId, clientId);
    setLocalBriefings((prev) => prev.filter((s) => s.id !== summaryId));
    setDeletingBriefingId(null);
  }

  // Chronological, soonest first — this is meant to be checked as events
  // come up, not browsed as a history (that's what the History tab is for).
  const chronological = [...sessions]
    .filter((s) => s.status !== "cancelled")
    .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));

  const visible = chronological.filter((s) => showHidden || !s.copilot_hidden);
  const hiddenCount = chronological.filter((s) => s.copilot_hidden).length;

  async function prepareMe(session: Session) {
    setBusyId(session.id);
    setBriefingFor(session.id);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          summaryType: "prepare_me_briefing",
          sessionId: session.id,
          sessionTypeLabel: SESSION_TYPE_LABELS[session.session_type] ?? session.session_type,
        }),
      });
      const json = await res.json();
      setBriefing(json.summary);
    } finally {
      setBusyId(null);
    }
  }

  async function toggle(session: Session, field: "hidden" | "finished") {
    setBusyId(`${field}:${session.id}`);
    try {
      await setSessionCopilotStateAction(session.id, clientId, {
        [field]: field === "hidden" ? !session.copilot_hidden : !session.copilot_finished,
      });
    } finally {
      setBusyId(null);
    }
  }

  const now = new Date().toISOString();
  // The next upcoming session that hasn't been marked finished — gets the
  // featured "Next Up" card. Everything else falls into the compact timeline.
  // nextUp comes from the full chronological list so a hidden session still
  // surfaces as Next Up — hiding is for the timeline rows, not for awareness
  // of what's coming next.
  const nextUp = chronological.find((s) => (s.scheduled_at ?? "") > now);
  const rest = visible.filter((s) => s.id !== nextUp?.id);

  // Renders past briefings list — shared between the featured card and timeline rows
  function PastBriefings({ s }: { s: Session }) {
    const past = pastBriefingsBySession[s.id];
    if (!past || past.length === 0) return null;
    const toShow = briefingFor === s.id ? past.slice(0, -1) : past;
    if (toShow.length === 0) return null;
    return (
      <div className="mt-2 pt-2 border-t border-ink-100/60">
        {toShow.map((pb) => (
          <div key={pb.id}>
            <div className="flex items-center justify-between">
              <button
                onClick={() => setExpandedBriefing(expandedBriefing === pb.id ? null : pb.id)}
                className="flex items-center gap-1.5 text-[11px] text-ink-400 hover:text-ink-600 py-1"
              >
                <History className="h-3 w-3" />
                Briefing from {formatDateTime(pb.created_at)}
                <span className="ml-1">{expandedBriefing === pb.id ? "▲" : "▼"}</span>
              </button>
              <button
                disabled={deletingBriefingId === pb.id}
                onClick={() => deleteBriefing(pb.id)}
                className="p-1 rounded hover:bg-red-50 text-ink-300 hover:text-red-500 transition-colors"
                title="Delete briefing"
              >
                {deletingBriefingId === pb.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </button>
            </div>
            {expandedBriefing === pb.id && (
              <div className="mt-1">
                <SummaryCard title="Pre-Session Briefing" content={pb.content} model={pb.model} />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Renders stage-relevant forms — shared between featured card and timeline rows.
  // Each form chip links directly to the form page when a document record exists.
  function SessionForms({ s }: { s: Session }) {
    const sessionForms = formTemplates.filter((t) => t.session_types?.includes(s.session_type));
    if (sessionForms.length === 0) return null;
    return (
      <div className="mt-2.5 pt-2.5 border-t border-ink-100/60">
        <span className="text-[11px] font-medium text-ink-500 uppercase tracking-wide">
          Forms for this session
        </span>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {sessionForms.map((tmpl) => {
            const doc = documents.find((d) => d.document_type === tmpl.document_type);
            const sub = doc ? formSubmissions.find((fs) => fs.document_id === doc.id) : undefined;
            const docStatus = sub?.status ?? (doc ? doc.status : "missing");
            const isComplete = docStatus === "signed" || docStatus === "submitted";
            const href = doc ? `/clients/${clientId}/forms/${doc.id}` : null;
            const chip = (
              <div className="flex items-center gap-1.5 bg-white border border-ink-100 rounded-lg px-2.5 py-1 hover:border-clay-300 transition-colors">
                <FileText className={cx("h-3 w-3 shrink-0", isComplete ? "text-sage-500" : "text-amber-500")} />
                <span className="text-xs text-ink-700">{tmpl.title}</span>
                <span className={cx("badge text-[10px] py-0", isComplete ? "bg-sage-100 text-sage-700" : "bg-amber-50 text-amber-700")}>
                  {isComplete ? "Done" : docStatus === "in_progress" ? "In progress" : "Not started"}
                </span>
              </div>
            );
            return href ? (
              <Link key={tmpl.id} href={href}>{chip}</Link>
            ) : (
              <div key={tmpl.id}>{chip}</div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-ink-900 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-plum-500" /> AI Copilot for {clientName}
        </h3>
        {hiddenCount > 0 && (
          <button
            className="text-xs text-ink-400 hover:text-ink-600 flex items-center gap-1"
            onClick={() => setShowHidden((s) => !s)}
          >
            {showHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showHidden ? "Hide hidden stages" : `Show ${hiddenCount} hidden`}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-ink-400">No sessions on the calendar yet.</p>
      ) : (
        <>
          {/* ── NEXT UP — featured card ── */}
          {nextUp && (() => {
            const label = SESSION_TYPE_LABELS[nextUp.session_type] ?? nextUp.session_type;
            const hidden = Boolean(nextUp.copilot_hidden);
            return (
              <div className={cx("card p-5 border border-clay-200", hidden && "opacity-60")}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-clay-600 bg-clay-100 px-2 py-0.5 rounded-full">
                    Next Up
                  </span>
                  {hidden && <span className="text-[11px] text-ink-400">(hidden)</span>}
                </div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="text-base font-semibold text-ink-900">{label}</div>
                    <div className="text-sm text-ink-500 mt-0.5">{formatDateTime(nextUp.scheduled_at)}</div>
                  </div>
                  <button
                    disabled={busyId === nextUp.id}
                    onClick={() => prepareMe(nextUp)}
                    className="btn-primary text-sm px-4 py-2 flex items-center gap-2 shrink-0"
                  >
                    {busyId === nextUp.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Prepare Me
                  </button>
                </div>

                {briefingFor === nextUp.id && briefing && (
                  <div className="mb-3">
                    <SummaryCard title="Pre-Session Briefing" content={briefing.content} model={briefing.model} />
                  </div>
                )}

                <PastBriefings s={nextUp} />
                <SessionForms s={nextUp} />

                <div className="flex items-center gap-3 mt-4 pt-3 border-t border-ink-100">
                  <button
                    disabled={busyId === `finished:${nextUp.id}`}
                    onClick={() => toggle(nextUp, "finished")}
                    className="btn-ghost text-[11px] px-2 py-1 text-ink-500"
                  >
                    Mark finished
                  </button>
                  <button
                    disabled={busyId === `hidden:${nextUp.id}`}
                    onClick={() => toggle(nextUp, "hidden")}
                    className="btn-ghost text-[11px] px-2 py-1 text-ink-500"
                  >
                    {hidden ? "Unhide" : "Hide"}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* ── TIMELINE — remaining sessions ── */}
          {rest.length > 0 && (
            <div>
              {nextUp && (
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 mb-2 px-1">
                  Timeline
                </div>
              )}
              <div className="space-y-1.5">
                {rest.map((s) => {
                  const label = SESSION_TYPE_LABELS[s.session_type] ?? s.session_type;
                  const finished = Boolean(s.copilot_finished);
                  const hidden = Boolean(s.copilot_hidden);
                  return (
                    <div
                      key={s.id}
                      className={cx(
                        "rounded-xl px-3 py-2.5",
                        finished ? "bg-sage-50/70" : "bg-ink-50/40",
                        hidden && "opacity-50"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 text-xs text-ink-600 flex items-center gap-1.5">
                          {finished && <CheckCircle2 className="h-3.5 w-3.5 text-sage-600 shrink-0" />}
                          <span className="font-medium">{label}</span>
                          <span className="text-ink-400">·</span>
                          <span>{formatDateTime(s.scheduled_at)}</span>
                          {hidden && <span className="text-ink-400">(hidden)</span>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {s.status === "scheduled" && (
                            <button
                              disabled={busyId === s.id}
                              onClick={() => prepareMe(s)}
                              className="btn-ghost text-[11px] px-2 py-1 flex items-center gap-1 text-plum-600"
                            >
                              {busyId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                              Prepare
                            </button>
                          )}
                          <button
                            disabled={busyId === `finished:${s.id}`}
                            onClick={() => toggle(s, "finished")}
                            className={cx("btn-ghost text-[11px] px-2 py-1", finished ? "text-sage-700" : "text-ink-400")}
                          >
                            {finished ? "Finished" : "Done"}
                          </button>
                          <button
                            disabled={busyId === `hidden:${s.id}`}
                            onClick={() => toggle(s, "hidden")}
                            className="btn-ghost text-[11px] px-2 py-1 text-ink-400"
                          >
                            {hidden ? "Unhide" : "Hide"}
                          </button>
                        </div>
                      </div>
                      {briefingFor === s.id && briefing && (
                        <div className="pt-2">
                          <SummaryCard title="Pre-Session Briefing" content={briefing.content} model={briefing.model} />
                        </div>
                      )}
                      <PastBriefings s={s} />
                      <SessionForms s={s} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}


function MessagesTab({
  clientId,
  messages,
  portalAssignments,
}: {
  clientId: string;
  messages: Message[];
  portalAssignments: PortalAssignment[];
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 card p-4 flex flex-col h-[480px]">
        <h3 className="font-medium text-ink-900 mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-clay-500" /> Secure Messages
        </h3>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cx(
                "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                m.sender === "practitioner" ? "bg-clay-500 text-white ml-auto" : "bg-ink-100 text-ink-800"
              )}
            >
              {m.body}
              <div className={cx("text-[10px] mt-0.5", m.sender === "practitioner" ? "text-white/70" : "text-ink-400")}>
                {formatDateTime(m.created_at)}
              </div>
            </div>
          ))}
          {messages.length === 0 && <p className="text-sm text-ink-400">No messages yet.</p>}
        </div>
        <form
          className="flex items-center gap-2 mt-3 pt-3 border-t border-ink-100"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            setSending(true);
            await sendMessageAction(clientId, "practitioner", draft.trim());
            setDraft("");
            setSending(false);
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a message..."
            className="flex-1 border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
          />
          <button type="submit" disabled={sending} className="btn-primary p-2">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
      <div>
        <h3 className="font-medium text-ink-900 mb-3">Portal Assignments</h3>
        <div className="space-y-2">
          {portalAssignments.map((a) => (
            <div key={a.id} className="card p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-900">{a.title}</span>
                <span className={cx("badge", a.status === "completed" ? "bg-sage-100 text-sage-700" : "bg-ink-100 text-ink-600")}>
                  {a.status.replace(/_/g, " ")}
                </span>
              </div>
              <div className="text-[11px] text-ink-400 capitalize mt-0.5">{a.assignment_type.replace(/_/g, " ")}</div>
            </div>
          ))}
          {portalAssignments.length === 0 && <p className="text-sm text-ink-400">No assignments yet.</p>}
        </div>
      </div>
    </div>
  );
}
