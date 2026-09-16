"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AiConversationMessage,
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
import { cx, formatDate, formatDateTime, isGeneralPaperwork, phaseForStatus, SESSION_TYPE_LABELS, Tab } from "@/lib/utils";
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
  ChevronLeft,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  uploadDocumentAction,
  sendMessageAction,
  addClientDocumentAction,
  addSessionAction,
  cancelSessionAction,
  completeSessionAction,
  setSessionCopilotStateAction,
  sendAiConversationMessageAction,
  markMessagesReadAction,
  deleteAiSummaryAction,
} from "@/lib/actions";
import { SessionType } from "@/lib/types";
import SummaryCard from "@/components/ai/SummaryCard";
import { buildClientActivity, ActivityKind } from "@/lib/activity";
import { getJourneyStageProgress, JourneyStageNav } from "@/components/client/JourneyStageNav";

const CLIENT_TABS: { value: Tab; label: string }[] = [
  { value: "History", label: "Overview" },
  { value: "Journey & AI", label: "Journey" },
  { value: "Sessions", label: "Sessions" },
  { value: "Documents", label: "Documents" },
  { value: "Messages", label: "Messages" },
  { value: "AI Copilot", label: "AI" },
];

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
  aiConversationMessages,
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
  aiConversationMessages: AiConversationMessage[];
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
  const [tab, setTab] = useState<Tab>(defaultTab ?? "History");
  const [aiChatMessages, setAiChatMessages] = useState(aiConversationMessages);
  const journeyProgress = getJourneyStageProgress(milestones);

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
    <div className="client-workspace-content">
      <nav aria-label="Client record" className="client-surface mb-5 flex gap-6 overflow-x-auto overflow-y-hidden rounded-b-none border-b border-ink-100 px-5">
        {CLIENT_TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cx(
              "-mb-px whitespace-nowrap border-b-2 py-3.5 text-sm font-medium transition-colors",
              tab === value ? "border-clay-500 text-ink-900" : "border-transparent text-ink-400 hover:text-ink-700"
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "Documents" && (
        <DocumentsTab
          clientId={client.id}
          clientName={client.full_name}
          documents={documents}
          formTemplates={formTemplates}
          formSubmissions={formSubmissions}
        />
      )}
      {tab === "Sessions" && <SessionsTab clientId={client.id} sessions={sessions} />}
      {tab === "Journey & AI" && (
        <>
          <section className="client-surface mb-5 px-5 py-4">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-base font-semibold text-ink-900">Journey stages</h2>
              <span className="text-xs text-ink-400">{journeyProgress.completed} of {journeyProgress.total} stages complete</span>
            </div>
            <JourneyStageNav clientId={client.id} sessions={sessions} milestones={milestones} activePhase={phaseForStatus(client.status, client.current_phase)} />
          </section>
          <JourneyTab clientId={client.id} aiSummaries={aiSummaries} memory={memory} preparationPlan={preparationPlan} />
        </>
      )}
      {tab === "AI Copilot" && (
        <ClientCopilotTab
          clientId={client.id}
          clientName={client.full_name}
          sessions={sessions}
          aiSummaries={aiSummaries}
          conversationMessages={aiChatMessages}
          onConversationMessagesChange={setAiChatMessages}
          documents={documents}
          formTemplates={formTemplates}
          formSubmissions={formSubmissions}
          onOpenDocuments={() => setTab("Documents")}
        />
      )}
      {tab === "Messages" && <MessagesTab clientId={client.id} messages={messages} portalAssignments={portalAssignments} />}
      {tab === "History" && (
        <HistoryTab client={client} sessions={sessions} documents={documents} formSubmissions={formSubmissions} messages={messages} tasks={tasks} portalAssignments={portalAssignments} checkIns={checkIns} postIntegrationForms={postIntegrationForms} milestones={milestones} aiSummaries={aiSummaries} memory={memory} emailLogs={emailLogs} onNavigateTab={setTab} />
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
        <div className="relative pl-12">
          <div className="absolute left-[17px] top-1.5 bottom-1.5 w-px bg-ink-100" />
          {events.map((e) => {
            const Icon = ACTIVITY_ICON[e.kind];
            const isClickable = !!(e.href || e.tab);
            const inner = (
              <>
                <div className="text-xs text-ink-400">{formatDateTime(e.at)}</div>
                <div className={`text-sm font-medium ${isClickable ? "text-clay-700 group-hover:underline" : "text-ink-900"}`}>
                  {e.title}
                </div>
                {e.detail && <div className="text-xs text-ink-500 mt-0.5">{e.detail}</div>}
              </>
            );
            return (
              <div key={e.id} className="relative pb-5 last:pb-0 group">
                <div className="absolute -left-12 top-0 h-9 w-9 rounded-full bg-white border-2 border-clay-300 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-clay-600" />
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

  const formGroups = [
    agreementDocs.length > 0
      ? {
          label: "Agreements & Consents",
          hint: "Signed once when the client joins the practice",
          docs: agreementDocs,
        }
      : null,
    ...grouped.filter((group) => group.docs.length > 0),
    ungrouped.length > 0
      ? {
          label: "Other Forms",
          hint: "Additional forms for this client",
          docs: ungrouped,
        }
      : null,
  ].filter((group): group is { label: string; hint: string; docs: ClientDocument[] } => group !== null);

  return (
    <div className="space-y-4">
      {/* One shared document surface; the dividers belong to the internal groups, not to individual rows. */}
      {formGroups.length > 0 && (
        <section className="client-surface overflow-hidden" aria-label="Agreements and consents">
          <div className="divide-y divide-ink-100">
            {formGroups.map((group, index) => (
              <section key={group.label} className="px-5 py-5">
                <div className="mb-3">
                  {index === 0 ? (
                    <h2 className="text-base font-semibold text-ink-900">{group.label}</h2>
                  ) : (
                    <h3 className="text-sm font-semibold text-ink-900">{group.label}</h3>
                  )}
                  <p className="mt-0.5 text-xs text-ink-400">{group.hint}</p>
                </div>
                <div className="space-y-1">
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
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>
      )}

      {/* File-upload documents */}
      <div>
        {(formBacked.length > 0 || ungrouped.length > 0) && (
          <div className="mb-3">
            <h3 className="font-semibold text-ink-900">Uploaded Documents</h3>
            <p className="text-xs text-ink-400 mt-0.5">PDF or file uploads — session notes, additional consents, etc.</p>
          </div>
        )}
        <div className="grid items-stretch gap-3 md:grid-cols-2 md:gap-4">
          <AddDocumentCard clientId={clientId} documents={documents} />
          {uploadOnly.map((doc) => (
            <div key={doc.id} className="card flex h-full min-h-[156px] flex-col gap-3 p-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="summary-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-clay-100 text-clay-600" aria-hidden="true">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="min-w-0 text-sm font-semibold leading-5 text-ink-900">
                      {DOCUMENT_LABELS[doc.document_type]}
                    </h4>
                    <DocumentStatusChip status={doc.status} />
                  </div>
                  {doc.versions.length > 0 ? (
                    <p className="mt-1 truncate text-xs leading-4 text-ink-400" title={doc.versions[0].file_name}>
                      {doc.versions[0].file_name} · v{doc.versions[0].version_number} · {formatDate(doc.versions[0].created_at)}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs leading-4 text-ink-400">
                      {doc.required ? "Required — not yet uploaded" : "Optional — not yet uploaded"}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-auto flex min-h-8 items-center justify-end gap-1.5 border-t border-ink-100 pt-3 text-xs">
                <UploadButton documentId={doc.id} clientId={clientId} />
                {doc.versions.length > 0 && (
                  <>
                    <button className="flex items-center gap-1 rounded-[var(--radius-control)] px-2 py-1.5 font-medium text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-800">
                      <Download className="h-3.5 w-3.5" /> Download
                    </button>
                    {doc.versions.length > 1 && (
                      <button className="flex items-center gap-1 rounded-[var(--radius-control)] px-2 py-1.5 text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-700">
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

function DocumentStatusChip({ status }: { status: ClientDocument["status"] }) {
  const statusChip =
    status === "reviewed"
      ? { label: "Reviewed", className: "status-pill--success" }
      : status === "uploaded"
        ? { label: "Uploaded", className: "status-pill--info" }
        : status === "signed"
          ? { label: "Signed", className: "status-pill--success" }
          : { label: "Missing", className: "status-pill--neutral" };

  return <span className={cx("badge shrink-0", statusChip.className)}>{statusChip.label}</span>;
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
}) {
  const statusBadge = getFormStatusBadge(doc, submission);

  return (
    <Link
      href={`/clients/${doc.client_id}/forms/${doc.id}`}
      target="_blank"
      className="group -mx-2 flex items-center gap-2.5 rounded-[var(--radius-control)] px-2 py-2.5 transition-colors hover:bg-ink-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-200"
    >
      <FileText className="h-4 w-4 text-ink-400 shrink-0 group-hover:text-clay-500" />
      <span className="text-sm font-medium text-ink-800 group-hover:text-clay-700">
        {DOCUMENT_LABELS[doc.document_type] ?? template.title}
      </span>
      <FormStatusChip statusBadge={statusBadge} />
    </Link>
  );
}

type FormStatusBadge = { label: string; cls: string };

function getFormStatusBadge(doc?: ClientDocument, submission?: FormSubmission): FormStatusBadge {
  const submissionStatus = submission?.status ?? "missing";
  return doc?.status === "reviewed"
    ? { label: "Reviewed", cls: "status-pill--info" }
    : submissionStatus === "signed"
      ? { label: "Signed", cls: "status-pill--success" }
      : submissionStatus === "submitted"
        ? { label: "Submitted", cls: "status-pill--success" }
        : submissionStatus === "in_progress"
          ? { label: "In Progress", cls: "status-pill--warning" }
          : { label: "Not Started", cls: "status-pill--neutral" };
}

function FormStatusChip({ statusBadge }: { statusBadge: FormStatusBadge }) {
  return <span className={cx("badge ml-auto shrink-0", statusBadge.cls)}>{statusBadge.label}</span>;
}

function SessionFormPlaceholderRow({ template }: { template: FormTemplate }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[var(--radius-control)] px-2 py-2.5">
      <FileText className="h-4 w-4 shrink-0 text-ink-400" />
      <span className="text-sm font-medium text-ink-800">{template.title}</span>
      <FormStatusChip statusBadge={getFormStatusBadge()} />
    </div>
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
    <div className="card flex h-full min-h-[156px] flex-col justify-center border border-dashed border-ink-200 p-4">
      {!open ? (
        <button className="group flex w-full flex-col items-center justify-center gap-2 py-2 text-center" onClick={() => setOpen(true)}>
          <span className="summary-icon flex h-8 w-8 items-center justify-center rounded-lg bg-ink-100 text-ink-600 transition-colors group-hover:border-clay-200 group-hover:bg-clay-100 group-hover:text-clay-700" aria-hidden="true">
            <Plus className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold text-ink-800 transition-colors group-hover:text-clay-700">Add document / consent</span>
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
    <label className="btn-ghost inline-flex items-center gap-1.5 px-2 py-1.5 text-xs cursor-pointer">
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

function SessionsTab({ clientId, sessions }: { clientId: string; sessions: Session[] }) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState(() => getPrimaryScheduleDate(sessions));
  const scheduleDays = buildScheduleDays(scheduleDate, sessions);
  const selectedDateKey = toDateKey(scheduleDate);
  const orderedSessions = [...sessions].sort((a, b) => {
    const aTime = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });

  return (
    <section className="client-surface wn-sessions-panel" aria-labelledby="sessions-heading">
      <header className="wn-sessions-header">
        <div>
          <p className="client-eyebrow">Schedule</p>
          <h2 id="sessions-heading">Sessions</h2>
        </div>
        <button className="btn-primary wn-schedule-action" onClick={() => setOpen((o) => !o)}>
          <Plus className="h-3.5 w-3.5" /> Schedule session
        </button>
      </header>

      {open && <ScheduleSessionForm clientId={clientId} onClose={() => setOpen(false)} />}

      <div className="wn-schedule-strip" aria-label="Session schedule navigation">
        <button
          type="button"
          className="wn-schedule-nav"
          aria-label="Show previous dates"
          onClick={() => setScheduleDate((current) => addDays(current, -7))}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <div className="wn-schedule-days" role="list">
          {scheduleDays.map((day) => (
            <div key={day.key} role="listitem">
              <button
                type="button"
                className="wn-schedule-day"
                data-selected={day.key === selectedDateKey ? "true" : "false"}
                data-today={day.isToday ? "true" : "false"}
                data-has-session={day.hasSession ? "true" : "false"}
                aria-label={`${day.weekday} ${day.month} ${day.day}`}
                aria-pressed={day.key === selectedDateKey}
                onClick={() => setScheduleDate(day.date)}
              >
                <span>{day.weekday}</span>
                <strong>{day.day}</strong>
                <small>{day.month}</small>
                {day.hasSession && <i aria-hidden="true" />}
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="wn-schedule-nav"
          aria-label="Show later dates"
          onClick={() => setScheduleDate((current) => addDays(current, 7))}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>

      <div className="wn-sessions-table-wrap">
        <table className="wn-sessions-table">
          <caption className="sr-only">Scheduled and completed sessions</caption>
          <thead>
            <tr>
              <th scope="col">Session</th>
              <th scope="col">Date</th>
              <th scope="col">Time</th>
              <th scope="col">Status</th>
              <th scope="col" className="wn-session-actions-heading">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orderedSessions.map((s) => {
              const sessionDateKey = toDateKey(s.scheduled_at);
              return (
                <tr key={s.id} data-selected={sessionDateKey === selectedDateKey ? "true" : "false"}>
                  <td className="wn-session-primary-cell">
                    <Link href={`/clients/${clientId}/sessions/${s.id}`} className="wn-session-link">
                      <strong>{SESSION_TYPE_LABELS[s.session_type] ?? s.session_type.replace(/_/g, " ")}</strong>
                      {s.location && <span>{s.location}</span>}
                    </Link>
                  </td>
                  <td><time dateTime={s.scheduled_at}>{formatDate(s.scheduled_at)}</time></td>
                  <td><time dateTime={s.scheduled_at}>{formatSessionTime(s.scheduled_at)}</time></td>
                  <td>
                    <span className={cx("badge", sessionStatusClasses(s.status))}>
                      {sessionStatusLabel(s.status)}
                    </span>
                  </td>
                  <td className="wn-session-actions-cell">
                    <div className="wn-session-actions">
                      <Link href={`/clients/${clientId}/sessions/${s.id}`} className="wn-session-view-link">
                        View <ChevronRight aria-hidden="true" />
                      </Link>
                      {s.status === "scheduled" && (
                        <>
                          <button
                            type="button"
                            disabled={busyId === s.id}
                            className="wn-session-action-button"
                            onClick={async () => {
                              setBusyId(s.id);
                              await completeSessionAction(s.id, clientId);
                              setBusyId(null);
                            }}
                          >
                            <CheckCircle2 aria-hidden="true" /> Complete
                          </button>
                          <button
                            type="button"
                            disabled={busyId === s.id}
                            className="wn-session-action-button is-danger"
                            onClick={async () => {
                              setBusyId(s.id);
                              await cancelSessionAction(s.id, clientId);
                              setBusyId(null);
                            }}
                          >
                            <XCircle aria-hidden="true" /> Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sessions.length === 0 && <p className="wn-sessions-empty">No sessions yet.</p>}
      </div>
    </section>
  );
}

type ScheduleDay = {
  date: Date;
  key: string;
  weekday: string;
  month: string;
  day: string;
  isToday: boolean;
  hasSession: boolean;
};

function getPrimaryScheduleDate(sessions: Session[]) {
  const nextScheduledSession = sessions
    .filter((session) => session.status === "scheduled" && session.scheduled_at)
    .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))[0];
  return nextScheduledSession?.scheduled_at ? new Date(nextScheduledSession.scheduled_at) : new Date();
}

function buildScheduleDays(center: Date, sessions: Session[]): ScheduleDay[] {
  const start = new Date(center);
  start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() - 4);
  const sessionDates = new Set(sessions.map((session) => toDateKey(session.scheduled_at)));
  const todayKey = toDateKey(new Date());

  return Array.from({ length: 9 }, (_, index) => {
    const date = addDays(start, index);
    return {
      date,
      key: toDateKey(date),
      weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
      month: date.toLocaleDateString("en-US", { month: "short" }),
      day: date.toLocaleDateString("en-US", { day: "numeric" }),
      isToday: toDateKey(date) === todayKey,
      hasSession: sessionDates.has(toDateKey(date)),
    };
  });
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function toDateKey(isoOrDate?: string | Date) {
  if (!isoOrDate) return "";
  const date = isoOrDate instanceof Date ? new Date(isoOrDate) : new Date(isoOrDate);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatSessionTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function sessionStatusLabel(status: Session["status"]) {
  return status === "no_show" ? "No show" : status.charAt(0).toUpperCase() + status.slice(1);
}

function sessionStatusClasses(status: Session["status"]) {
  return cx(
    status === "completed" && "bg-sage-100 text-sage-700",
    status === "scheduled" && "bg-clay-100 text-clay-700",
    (status === "cancelled" || status === "no_show") && "bg-ink-100 text-ink-500"
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
                  <dt className="text-xs uppercase tracking-wide text-ink-400">{k.replace(/_/g, " ")}</dt>
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
                    <dt className="text-xs uppercase tracking-wide text-ink-400">{k.replace(/_/g, " ")}</dt>
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
  conversationMessages,
  onConversationMessagesChange,
  documents,
  formTemplates,
  formSubmissions,
  onOpenDocuments,
}: {
  clientId: string;
  clientName: string;
  sessions: Session[];
  aiSummaries: AiSummary[];
  conversationMessages: AiConversationMessage[];
  onConversationMessagesChange: (messages: AiConversationMessage[]) => void;
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
  const [expandedSessionIds, setExpandedSessionIds] = useState<Set<string>>(new Set());
  const [deletingBriefingId, setDeletingBriefingId] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
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
    setExpandedSessionIds((previous) => new Set(previous).add(session.id));
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

  async function sendChatMessage(value = chatDraft) {
    const message = value.trim();
    if (!message || chatBusy) return;
    setChatBusy(true);
    setChatError(null);
    try {
      const updatedMessages = await sendAiConversationMessageAction(clientId, message);
      onConversationMessagesChange(updatedMessages);
      setChatDraft("");
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "The AI could not respond. Try again.");
    } finally {
      setChatBusy(false);
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
  const timelineSessions = nextUp ? [nextUp, ...rest] : rest;
  const briefTarget = nextUp ?? chronological[chronological.length - 1];

  function toggleSessionExpanded(sessionId: string) {
    setExpandedSessionIds((previous) => {
      const next = new Set(previous);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }

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
                className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-600 py-1"
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
                <SummaryCard title="AI Session Brief" content={pb.content} model={pb.model} />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Renders stage-relevant forms inside the expanded session content.
  // The rows share the same document treatment as the Documents tab.
  function SessionForms({ s }: { s: Session }) {
    const sessionForms = formTemplates.filter((t) => t.session_types?.includes(s.session_type));
    if (sessionForms.length === 0) return null;
    return (
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
          Forms for this session
        </div>
        <div className="space-y-1">
          {sessionForms.map((tmpl) => {
            const doc = documents.find((d) => d.document_type === tmpl.document_type);
            const sub = doc ? formSubmissions.find((fs) => fs.document_id === doc.id) : undefined;
            return doc ? (
              <FormSubmissionCard
                key={tmpl.id}
                document={doc}
                template={tmpl}
                submission={sub}
              />
            ) : (
              <SessionFormPlaceholderRow key={tmpl.id} template={tmpl} />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-medium text-ink-900">
            <Sparkles className="h-4 w-4 text-plum-500" /> AI Copilot for {clientName}
          </h3>
        </div>
        {briefTarget && (
          <button
            type="button"
            disabled={busyId === briefTarget.id}
            onClick={() => prepareMe(briefTarget)}
            className="btn-secondary flex shrink-0 items-center gap-2 text-sm"
          >
            {busyId === briefTarget.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Generate Brief
          </button>
        )}
      </div>

      <section className="overflow-hidden" aria-label={`AI conversation with ${clientName}`}>
        <div className="max-h-[22rem] space-y-3 overflow-y-auto py-2">
          {conversationMessages.length === 0 ? (
            <div className="flex flex-wrap gap-2">
              {[
                "Help me prepare for the next session",
                "What open threads should I carry forward?",
                "Summarize this client's progress so far",
              ].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="rounded-full border border-clay-100 bg-clay-50/75 px-3 py-1 text-left text-xs font-medium leading-5 text-clay-700 transition-colors hover:border-clay-200 hover:bg-clay-100/80 hover:text-clay-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-200"
                  onClick={() => setChatDraft(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : (
            conversationMessages.map((message) => (
              <div key={message.id} className={cx("flex", message.role === "practitioner" ? "justify-end" : "justify-start")}>
                <div
                  className={cx(
                    "max-w-[88%] rounded-[var(--radius-card)] border px-4 py-3",
                    message.role === "practitioner"
                      ? "border-clay-200 bg-clay-100 text-ink-800"
                      : "border-ink-100 bg-ink-50/55 text-ink-800"
                  )}
                >
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">
                    {message.role === "practitioner" ? "You" : "Heartful AI"}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p>
                  <div className="mt-2 text-xs text-ink-400">{formatDateTime(message.created_at)}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <form
          className="py-2"
          onSubmit={(event) => {
            event.preventDefault();
            void sendChatMessage();
          }}
        >
          <div className="relative">
            <textarea
              value={chatDraft}
              onChange={(event) => setChatDraft(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  void sendChatMessage();
                }
              }}
              rows={2}
              disabled={chatBusy}
              placeholder="Ask the AI about this client..."
              aria-label="Ask the Heartful AI"
              className="min-h-[4.5rem] w-full resize-none rounded-[var(--radius-control)] border border-ink-200 bg-white px-3 pt-3 pr-28 pb-12 text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-clay-200 disabled:opacity-60"
            />
            <button type="submit" disabled={chatBusy || !chatDraft.trim()} className="btn-primary absolute bottom-3 right-2 flex min-h-10 items-center gap-2 px-3 py-2.5 disabled:opacity-60">
              {chatBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {chatBusy ? "Thinking..." : "Send"}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-400">
            <span>Context: {clientName}&apos;s journey record · Ctrl/⌘ + Enter to send</span>
            {chatError && <span className="text-red-600">{chatError}</span>}
          </div>
        </form>
      </section>

      <section className="client-surface overflow-hidden" aria-labelledby="client-timeline-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
          <div>
            <h3 id="client-timeline-heading" className="text-base font-semibold text-ink-900">Timeline</h3>
            <p className="mt-0.5 text-xs text-ink-400">Sessions in chronological order</p>
          </div>
          {hiddenCount > 0 && (
            <button
              className="btn-ghost flex items-center gap-1 px-2 py-1 text-xs text-ink-400"
              onClick={() => setShowHidden((s) => !s)}
            >
              {showHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showHidden ? "Hide hidden" : `Show ${hiddenCount} hidden`}
            </button>
          )}
        </div>

        {timelineSessions.length === 0 ? (
          <p className="px-5 py-5 text-sm text-ink-400">No sessions on the calendar yet.</p>
        ) : (
          <div className="divide-y divide-ink-100">
            {timelineSessions.map((s) => {
              const label = SESSION_TYPE_LABELS[s.session_type] ?? s.session_type;
              const finished = Boolean(s.copilot_finished);
              const hidden = Boolean(s.copilot_hidden);
              const isNextUp = s.id === nextUp?.id;
              const past = pastBriefingsBySession[s.id];
              const sessionForms = formTemplates.filter((t) => t.session_types?.includes(s.session_type));
              const hasExpandableContent = sessionForms.length > 0 || Boolean(past?.length) || briefingFor === s.id;
              const expanded = expandedSessionIds.has(s.id);

              return (
                <div key={s.id} className={cx(isNextUp && "bg-clay-50/35", hidden && "opacity-60")}>
                  <div className="flex items-start gap-3 px-5 py-3.5">
                    {hasExpandableContent ? (
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={`session-details-${s.id}`}
                        aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
                        onClick={() => toggleSessionExpanded(s.id)}
                        className="btn-ghost mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center p-0 text-ink-400"
                      >
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    ) : (
                      <span className="mt-0.5 h-7 w-7 shrink-0" aria-hidden="true" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h4 className="text-sm font-semibold text-ink-900">{label}</h4>
                        {isNextUp && <span className="text-xs font-medium text-clay-700">Next relevant session</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-400">
                        <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{formatDateTime(s.scheduled_at)}</span>
                        {s.duration_minutes && <><span>·</span><span>{s.duration_minutes} min</span></>}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                      <SessionStatusChip status={s.status} finished={finished} nextUp={isNextUp} />
                      {hidden && <span className="badge status-pill--neutral">Hidden</span>}
                      {s.status === "scheduled" && (
                        <button
                          type="button"
                          disabled={busyId === s.id}
                          onClick={() => prepareMe(s)}
                          className="btn-ghost flex items-center gap-1 px-2 py-1 text-xs text-plum-600"
                        >
                          {busyId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                          Generate brief
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === `finished:${s.id}`}
                        onClick={() => toggle(s, "finished")}
                        className={cx("btn-ghost p-1.5", finished ? "text-sage-700" : "text-ink-400")}
                        title={finished ? "Mark session active" : "Mark session complete"}
                        aria-label={finished ? `Mark ${label} active` : `Mark ${label} complete`}
                      >
                        {busyId === `finished:${s.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === `hidden:${s.id}`}
                        onClick={() => toggle(s, "hidden")}
                        className="btn-ghost p-1.5 text-ink-400"
                        title={hidden ? "Show in timeline" : "Hide from timeline"}
                        aria-label={hidden ? `Show ${label} in timeline` : `Hide ${label} from timeline`}
                      >
                        {busyId === `hidden:${s.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {expanded && hasExpandableContent && (
                    <div id={`session-details-${s.id}`} className="border-t border-ink-100 bg-ink-50/35 px-5 py-3.5 pl-[4.5rem]">
                      <div className="space-y-3">
                        {briefingFor === s.id && briefing && (
                          <SummaryCard title="AI Session Brief" content={briefing.content} model={briefing.model} />
                        )}
                        {briefingFor === s.id && !briefing && busyId === s.id && (
                          <div className="flex items-center gap-2 text-xs text-ink-400">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating brief…
                          </div>
                        )}
                        <PastBriefings s={s} />
                        <SessionForms s={s} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function SessionStatusChip({
  status,
  finished,
  nextUp,
}: {
  status: Session["status"];
  finished: boolean;
  nextUp: boolean;
}) {
  const statusChip =
    finished || status === "completed"
      ? { label: "Completed", className: "status-pill--success" }
      : nextUp
        ? { label: "Next up", className: "status-pill--warning" }
        : status === "scheduled"
          ? { label: "Scheduled", className: "status-pill--info" }
          : status === "no_show"
            ? { label: "No show", className: "status-pill--warning" }
            : { label: "Cancelled", className: "status-pill--neutral" };

  return <span className={cx("badge shrink-0", statusChip.className)}>{statusChip.label}</span>;
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
              <div className={cx("text-xs mt-0.5", m.sender === "practitioner" ? "text-white/70" : "text-ink-400")}>
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
              <div className="portal-assignment-row flex items-start justify-between gap-3">
                <span className="min-w-0 text-sm leading-snug text-ink-900">{a.title}</span>
                <span className={cx("portal-assignment-status badge shrink-0", a.status === "completed" ? "bg-sage-100 text-sage-700" : "bg-ink-100 text-ink-600")}>
                  {a.status.replace(/_/g, " ")}
                </span>
              </div>
              <div className="text-xs text-ink-400 capitalize mt-0.5">{a.assignment_type.replace(/_/g, " ")}</div>
            </div>
          ))}
          {portalAssignments.length === 0 && <p className="text-sm text-ink-400">No assignments yet.</p>}
        </div>
      </div>
    </div>
  );
}
