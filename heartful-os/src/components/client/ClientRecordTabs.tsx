"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { cx, formatDate, formatDateTime, getClientJourneyProgress, getJourneyStageWorkspaceState, isGeneralPaperwork, phaseForStatus, SESSION_TYPE_LABELS, Tab, type JourneyWorkspaceStage } from "@/lib/utils";
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
  Pencil,
  PlayCircle,
  StopCircle,
  Pill,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  ListChecks,
  BookOpen,
  MoreHorizontal,
} from "@/components/ui/HeartfulIcon";
import {
  uploadDocumentAction,
  sendMessageAction,
  editSentMessageAction,
  deleteSentMessageAction,
  addClientDocumentAction,
  addSessionAction,
  cancelSessionAction,
  completeSessionAction,
  setSessionCopilotStateAction,
  sendAiConversationMessageAction,
  markMessagesReadAction,
  deleteAiSummaryAction,
  deleteClientDocumentAction,
  renameClientDocumentAction,
} from "@/lib/actions";
import { SessionType } from "@/lib/types";
import SummaryCard from "@/components/ai/SummaryCard";
import { buildClientActivity, ActivityKind } from "@/lib/activity";
import { JourneyStageNav, PHASE_LINKS, PhaseNavKey } from "@/components/client/JourneyStageNav";
import CheckInWorkspace from "@/components/client/CheckInWorkspace";
import IntakeWorkspace from "@/components/client/IntakeWorkspace";
import MilestoneToggleBanner from "@/components/client/MilestoneToggleBanner";
import JourneyAiSummaries from "@/components/client/JourneyAiSummaries";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

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
  defaultStage,
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
  defaultStage?: string;
}) {
  const [tabSelection, setTabSelection] = useState<{ tab: Tab; defaultTab?: Tab }>({
    tab: defaultTab ?? "History",
    defaultTab,
  });
  const tab = tabSelection.defaultTab === defaultTab ? tabSelection.tab : defaultTab ?? "History";
  const setTab = (next: Tab) => setTabSelection({ tab: next, defaultTab });
  const [aiChatMessages, setAiChatMessages] = useState(aiConversationMessages);
  const journeyProgress = getClientJourneyProgress(client, milestones);
  const viewingStage = PHASE_LINKS.some((stage) => stage.phase === defaultStage)
    ? defaultStage as PhaseNavKey
    : undefined;
  const currentPhase = phaseForStatus(client.status, client.current_phase);
  const selectedWorkspaceStage = viewingStage && viewingStage !== "overview" ? viewingStage : undefined;
  const workspaceStage: JourneyWorkspaceStage = selectedWorkspaceStage ?? (currentPhase === "closed" ? "growth_action_plan" : currentPhase);

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
          <section id="journey-stages" className="client-surface journey-stages-card mb-5 px-5 py-4">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <h2 className="journey-icon-heading text-base font-semibold text-ink-900"><ListChecks aria-hidden="true" />Journey stages</h2>
              <span className="text-xs text-ink-400">{journeyProgress.completed} of {journeyProgress.total} stages complete</span>
            </div>
            <JourneyStageNav clientId={client.id} sessions={sessions} milestones={milestones} activePhase={phaseForStatus(client.status, client.current_phase)} current={viewingStage} />
          </section>
          <JourneyTab
            client={client}
            clientId={client.id}
            clientName={client.full_name}
            workspaceStage={workspaceStage}
            sessions={sessions}
            milestones={milestones}
            checkIns={checkIns}
            aiSummaries={aiSummaries}
            memory={memory}
            preparationPlan={preparationPlan}
            documents={documents}
            formTemplates={formTemplates}
            formSubmissions={formSubmissions}
          />
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
        <History className="h-5 w-5 text-clay-500" /> Activity History
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
              <div key={e.id} className="relative mb-5 last:mb-0 group">
                <div className="absolute -left-12 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white border-2 border-clay-300 flex items-center justify-center">
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
  const [removedUploadDocumentIds, setRemovedUploadDocumentIds] = useState<Set<string>>(() => new Set());
  const [recentlyAddedDocumentId, setRecentlyAddedDocumentId] = useState<string | null>(null);
  const [documentActionError, setDocumentActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!recentlyAddedDocumentId) return;
    const timeout = window.setTimeout(() => setRecentlyAddedDocumentId(null), 5_000);
    return () => window.clearTimeout(timeout);
  }, [recentlyAddedDocumentId]);
  // Forms that have a matching digital template
  const formBacked = documents.filter((d) => formTemplates.some((t) => t.document_type === d.document_type));
  // Documents that are file-upload only (no matching template) AND have
  // actually been uploaded — empty placeholder slots are hidden to keep the
  // UI clean. They were seeded during early development and aren't needed
  // until a practitioner deliberately uploads something via Add Document.
  const uploadOnly = documents
    .filter(
      (d) =>
        !formTemplates.some((t) => t.document_type === d.document_type) &&
        d.versions.length > 0 &&
        !removedUploadDocumentIds.has(d.id)
    )
    .sort((a, b) => (b.versions[0]?.created_at ?? "").localeCompare(a.versions[0]?.created_at ?? ""));

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
        <section id="agreements-and-consents" className="client-surface overflow-hidden" aria-label="Agreements and consents">
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
        {documentActionError && <p className="mb-3 text-xs font-medium text-[var(--danger-text)]" role="alert">{documentActionError}</p>}
        <div className="grid items-stretch gap-3 md:grid-cols-2 md:gap-4">
          <AddDocumentCard
            clientId={clientId}
            documents={documents.filter((document) => !removedUploadDocumentIds.has(document.id))}
            onUploaded={setRecentlyAddedDocumentId}
          />
          {uploadOnly.map((doc) => (
            <UploadedDocumentCard
              key={doc.id}
              document={doc}
              clientId={clientId}
              isRecentlyAdded={doc.id === recentlyAddedDocumentId}
              onDeleted={(documentId) => {
                setDocumentActionError(null);
                setRemovedUploadDocumentIds((previous) => new Set(previous).add(documentId));
              }}
              onDeleteFailed={(documentId) => {
                setRemovedUploadDocumentIds((previous) => {
                  const next = new Set(previous);
                  next.delete(documentId);
                  return next;
                });
                setDocumentActionError("The document could not be deleted. Please try again.");
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function documentNameFromFileName(fileName?: string) {
  return fileName?.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "").trim() ?? "";
}

function documentDisplayName(document: ClientDocument) {
  const title = document.title?.trim();
  const isGenericCategoryName = !title || title === document.document_type || title === DOCUMENT_LABELS[document.document_type];
  return isGenericCategoryName
    ? documentNameFromFileName(document.versions[0]?.file_name) || DOCUMENT_LABELS[document.document_type] || "Other Document"
    : title;
}

function UploadedDocumentCard({
  document,
  clientId,
  isRecentlyAdded = false,
  onDeleted,
  onDeleteFailed,
}: {
  document: ClientDocument;
  clientId: string;
  isRecentlyAdded?: boolean;
  onDeleted: (documentId: string) => void;
  onDeleteFailed: (documentId: string) => void;
}) {
  const [displayName, setDisplayName] = useState(() => documentDisplayName(document));
  const [renameOpen, setRenameOpen] = useState(false);
  const [nameInput, setNameInput] = useState(() => documentDisplayName(document));
  const [renameError, setRenameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const version = document.versions[0];

  async function saveName() {
    setSavingName(true);
    setRenameError(null);
    try {
      const updated = await renameClientDocumentAction(document.id, clientId, nameInput);
      const nextName = updated?.title || documentNameFromFileName(version?.file_name) || "Other Document";
      setDisplayName(nextName);
      setNameInput(nextName);
      setRenameOpen(false);
    } catch {
      setRenameError("The document name could not be updated. Please try again.");
    } finally {
      setSavingName(false);
    }
  }

  async function deleteDocument() {
    setDeleting(true);
    setConfirmDelete(false);
    onDeleted(document.id);
    try {
      await deleteClientDocumentAction(document.id, clientId);
    } catch {
      onDeleteFailed(document.id);
    }
  }

  return (
    <div className={cx("card uploaded-document-card flex h-full min-h-[156px] flex-col gap-3 p-4", isRecentlyAdded && "uploaded-document-card--new")}>
      <div className="flex min-w-0 items-start gap-3">
        <span className="summary-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-clay-100 text-clay-600" aria-hidden="true">
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h4 className="min-w-0 text-sm font-semibold leading-5 text-ink-900">{displayName}</h4>
            <DocumentStatusChip status={document.status} />
          </div>
          {version && (
            <p className="mt-1 truncate text-xs leading-4 text-ink-400" title={version.file_name}>
              {version.file_name} · v{version.version_number} · {formatDate(version.created_at)}
            </p>
          )}
        </div>
      </div>

      {renameOpen && (
        <form
          className="space-y-1.5"
          onSubmit={async (event) => {
            event.preventDefault();
            await saveName();
          }}
        >
          <label className="block text-xs font-semibold text-ink-700">
            Document name
            <input
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              className="mt-1 w-full rounded-[var(--radius-control)] border border-ink-200 bg-[var(--workspace-background)] px-2.5 py-2 text-sm text-ink-800 focus:outline-none focus:ring-2 focus:ring-clay-200"
              disabled={savingName}
              autoFocus
            />
          </label>
          {renameError && <p className="text-xs font-medium text-[var(--danger-text)]" role="alert">{renameError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={savingName} onClick={() => { setNameInput(displayName); setRenameError(null); setRenameOpen(false); }}>Cancel</button>
            <button type="submit" className="btn-primary px-2 py-1 text-xs" disabled={savingName}>{savingName ? "Saving..." : "Save name"}</button>
          </div>
        </form>
      )}

      <div className="mt-auto flex min-h-8 items-center justify-end gap-1.5 border-t border-ink-100 pt-3 text-xs">
        <UploadButton documentId={document.id} clientId={clientId} />
        {version && (
          <>
            <button className="flex items-center gap-1 rounded-[var(--radius-control)] px-2 py-1.5 font-medium text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-800">
              <Download className="h-3.5 w-3.5" /> Download
            </button>
            {document.versions.length > 1 && (
              <button className="flex items-center gap-1 rounded-[var(--radius-control)] px-2 py-1.5 text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-700">
                <History className="h-3.5 w-3.5" /> {document.versions.length} versions
              </button>
            )}
          </>
        )}
        <details className="relative">
          <summary className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-[var(--radius-control)] text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-700 [&::-webkit-details-marker]:hidden" aria-label={`More actions for ${displayName}`} title="More actions">
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </summary>
          <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-[var(--radius-control)] border border-ink-200 bg-[var(--workspace-background)] p-1 shadow-lg" role="menu" aria-label={`Actions for ${displayName}`}>
            <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-medium text-ink-700 hover:bg-ink-50" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); setNameInput(displayName); setRenameOpen(true); }}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Rename
            </button>
            <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-medium text-[var(--danger-text)] hover:bg-[var(--danger-surface)]" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); setConfirmDelete(true); }}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete document
            </button>
          </div>
        </details>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete document?"
        description={`This will permanently remove “${displayName}” from this client, including all of its versions.`}
        confirmLabel="Delete document"
        busy={deleting}
        onConfirm={deleteDocument}
        onCancel={() => setConfirmDelete(false)}
      />
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

const DOCUMENT_FILE_ACCEPT = ".pdf,.doc,.docx,.png,.jpg";
const DOCUMENT_FILE_FORMATS = "PDF, DOC, DOCX, PNG or JPG";
const MIN_UPLOAD_FEEDBACK_MS = 1_200;

async function keepUploadFeedbackVisible(startedAt: number) {
  const remaining = MIN_UPLOAD_FEEDBACK_MS - (Date.now() - startedAt);
  if (remaining > 0) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, remaining));
  }
}

function formatDocumentFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function documentFileError(file: File) {
  const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  return DOCUMENT_FILE_ACCEPT.split(",").includes(extension)
    ? null
    : `Choose a ${DOCUMENT_FILE_FORMATS} file.`;
}

function DocumentFilePicker({
  file,
  onSelect,
  onClear,
  disabled = false,
}: {
  file: File | null;
  onSelect: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  function selectFile(nextFile?: File) {
    if (nextFile) onSelect(nextFile);
  }

  if (file) {
    return (
      <div className="flex min-w-0 items-center gap-2 rounded-[var(--radius-control)] border border-ink-200 bg-ink-50/60 px-2.5 py-2">
        <FileText className="h-4 w-4 shrink-0 text-ink-500" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-ink-800" title={file.name}>{file.name}</span>
          <span className="block text-xs text-ink-400">{formatDocumentFileSize(file.size)}</span>
        </span>
        <label className="cursor-pointer text-xs font-semibold text-clay-600 hover:text-clay-700 hover:underline">
          Replace
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={DOCUMENT_FILE_ACCEPT}
            className="sr-only"
            disabled={disabled}
            onChange={(event) => {
              selectFile(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <button
          type="button"
          className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-200"
          onClick={() => {
            onClear();
            if (inputRef.current) inputRef.current.value = "";
          }}
          disabled={disabled}
          aria-label="Remove selected file"
          title="Remove selected file"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-control)] border border-dashed border-ink-200 bg-ink-50/45 px-3 py-3">
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-control)] border border-ink-200 bg-[var(--workspace-background)] px-2.5 py-1.5 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50 focus-within:outline-none focus-within:ring-2 focus-within:ring-clay-200">
        <Upload className="h-3.5 w-3.5 text-clay-600" aria-hidden="true" />
        Choose file
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={DOCUMENT_FILE_ACCEPT}
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            selectFile(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
      </label>
      <p className="mt-1.5 text-xs text-ink-400">{DOCUMENT_FILE_FORMATS}</p>
    </div>
  );
}

function AddDocumentCard({
  clientId,
  documents,
  onUploaded,
}: {
  clientId: string;
  documents: ClientDocument[];
  onUploaded: (documentId: string) => void;
}) {
  const router = useRouter();
  const existingTypes = new Set(documents.map((d) => d.document_type));
  // "other" stays available indefinitely so practitioners can always attach
  // an ad-hoc consent/form beyond the 12 standard types.
  const availableTypes = (Object.keys(DOCUMENT_LABELS) as DocumentType[]).filter(
    (t) => t === "other" || !existingTypes.has(t)
  );
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<DocumentType>(availableTypes[0]);
  const [file, setFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [uploadState, setUploadState] = useState<"idle" | "selected" | "uploading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setFile(null);
    setDocumentName("");
    setError(null);
    setUploadState("idle");
    setOpen(false);
  }

  function selectFile(nextFile: File) {
    const validationError = documentFileError(nextFile);
    if (validationError) {
      setFile(null);
      setError(validationError);
      setUploadState("error");
      return;
    }
    setFile(nextFile);
    setDocumentName(documentNameFromFileName(nextFile.name));
    setError(null);
    setUploadState("selected");
  }

  if (availableTypes.length === 0) return null;

  return (
    <div className="card flex h-full min-h-[156px] flex-col justify-center border border-dashed border-ink-200 p-4">
      {!open ? (
        <button className="group flex w-full flex-col items-center justify-center gap-2 py-2 text-center" onClick={() => setOpen(true)}>
          <span className="summary-icon flex h-8 w-8 items-center justify-center rounded-lg bg-ink-100 text-ink-600 transition-colors group-hover:border-clay-200 group-hover:bg-clay-100 group-hover:text-clay-700" aria-hidden="true">
            <Plus className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold text-ink-800 transition-colors group-hover:text-clay-700">Upload document</span>
        </button>
      ) : (
        <form
          className="w-full space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!file) return;
            setUploadState("uploading");
            setError(null);
            const uploadStartedAt = Date.now();
            try {
              const document = await addClientDocumentAction(clientId, type, file.name, documentName);
              await keepUploadFeedbackVisible(uploadStartedAt);
              onUploaded(document.id);
              resetForm();
              router.refresh();
            } catch {
              setError("The document could not be uploaded. Please try again.");
              setUploadState("error");
            }
          }}
        >
          {availableTypes.length > 1 && (
            <label className="block text-xs font-semibold text-ink-700">
              Document type
              <select
                value={type}
                onChange={(e) => setType(e.target.value as DocumentType)}
                disabled={uploadState === "uploading"}
                className="mt-1 w-full rounded-[var(--radius-control)] border border-ink-200 bg-[var(--workspace-background)] px-2.5 py-2 text-sm text-ink-800 focus:outline-none focus:ring-2 focus:ring-clay-200"
              >
                {availableTypes.map((t) => (
                  <option key={t} value={t}>
                    {DOCUMENT_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-xs font-semibold text-ink-700">
            Document name
            <input
              value={documentName}
              onChange={(event) => setDocumentName(event.target.value)}
              placeholder="Select a file first"
              disabled={!file || uploadState === "uploading"}
              className="mt-1 w-full rounded-[var(--radius-control)] border border-ink-200 bg-[var(--workspace-background)] px-2.5 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-clay-200 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400"
            />
          </label>
          <DocumentFilePicker
            file={file}
            onSelect={selectFile}
            onClear={() => {
              setFile(null);
              setDocumentName("");
              setError(null);
              setUploadState("idle");
            }}
            disabled={uploadState === "uploading"}
          />
          {error && <p className="text-xs font-medium text-[var(--danger-text)]" role="alert">{error}</p>}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={resetForm} disabled={uploadState === "uploading"}>Cancel</button>
            <button type="submit" disabled={!file || uploadState === "uploading"} className="btn-primary px-3 py-1.5 text-xs">
              {uploadState === "uploading" ? "Uploading..." : "Upload document"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function UploadButton({ documentId, clientId }: { documentId: string; clientId: string }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "selected" | "uploading" | "complete" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function selectFile(nextFile: File) {
    const validationError = documentFileError(nextFile);
    if (validationError) {
      setFile(null);
      setError(validationError);
      setState("error");
      return;
    }
    setFile(nextFile);
    setError(null);
    setState("selected");
  }

  if (open) {
    return (
      <div className="w-full space-y-2">
        <DocumentFilePicker file={file} onSelect={selectFile} onClear={() => { setFile(null); setError(null); setState("idle"); }} disabled={state === "uploading" || state === "complete"} />
        {error && <p className="text-xs font-medium text-[var(--danger-text)]" role="alert">{error}</p>}
        {state === "complete" && <p className="text-xs font-medium text-[var(--status-success-text)]" role="status">Upload complete</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={state === "uploading"} onClick={() => { setOpen(false); setFile(null); setError(null); setState("idle"); }}>
            {state === "complete" ? "Done" : "Cancel"}
          </button>
          {state !== "complete" && (
            <button
              type="button"
              className="btn-primary px-2 py-1 text-xs"
              disabled={!file || state === "uploading"}
              onClick={async () => {
                if (!file) return;
                setState("uploading");
                setError(null);
                const uploadStartedAt = Date.now();
                try {
                  await uploadDocumentAction(documentId, clientId, file.name);
                  await keepUploadFeedbackVisible(uploadStartedAt);
                  setState("complete");
                } catch {
                  setError("The document could not be uploaded. Please try again.");
                  setState("error");
                }
              }}
            >
              {state === "uploading" ? "Uploading..." : "Upload document"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <button type="button" className="btn-ghost inline-flex items-center gap-1.5 px-2 py-1.5 text-xs" onClick={() => setOpen(true)}>
      <Upload className="h-3.5 w-3.5" /> Upload / Replace
    </button>
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
          <h2 id="sessions-heading">Schedule</h2>
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
              <th scope="col">Date &amp; time</th>
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
                  <td><time dateTime={s.scheduled_at}>{formatDate(s.scheduled_at)} · {formatSessionTime(s.scheduled_at)}</time></td>
                  <td>
                    <span className={cx("badge", sessionStatusClasses(s.status))}>
                      {sessionStatusLabel(s.status)}
                    </span>
                  </td>
                  <td className="wn-session-actions-cell">
                    <div className="wn-session-actions">
                      {s.status === "scheduled" && (
                        <button
                          type="button"
                          className="wn-session-complete-action"
                          disabled={busyId === s.id}
                          onClick={async () => {
                            setBusyId(s.id);
                            await completeSessionAction(s.id, clientId);
                            setBusyId(null);
                          }}
                        aria-label={`Complete ${SESSION_TYPE_LABELS[s.session_type] ?? "session"}`}
                        title="Mark complete"
                        ><Check aria-hidden="true" /></button>
                      )}
                      {s.status === "scheduled" && (
                        <button
                          type="button"
                          className="wn-session-cancel-action"
                          aria-label={`Cancel ${SESSION_TYPE_LABELS[s.session_type] ?? "session"}`}
                          title="Cancel session"
                          disabled={busyId === s.id}
                          onClick={async () => {
                            if (!window.confirm("Cancel this session? This cannot be undone.")) return;
                            setBusyId(s.id);
                            await cancelSessionAction(s.id, clientId);
                            setBusyId(null);
                          }}
                        ><X aria-hidden="true" /></button>
                      )}
                      <Link href={`/clients/${clientId}/sessions/${s.id}`} className="wn-session-view-link">
                        View <ChevronRight aria-hidden="true" />
                      </Link>
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
  client,
  clientId,
  clientName,
  workspaceStage,
  sessions,
  milestones,
  checkIns,
  aiSummaries,
  memory,
  preparationPlan,
  documents,
  formTemplates,
  formSubmissions,
}: {
  client: Client;
  clientId: string;
  clientName: string;
  workspaceStage: JourneyWorkspaceStage;
  sessions: Session[];
  milestones: JourneyMilestone[];
  checkIns: CheckIn[];
  aiSummaries: AiSummary[];
  memory: ClientMemoryItem[];
  preparationPlan?: PreparationPlan;
  documents: ClientDocument[];
  formTemplates: FormTemplate[];
  formSubmissions: FormSubmission[];
}) {
  const [checkInSubmitted, setCheckInSubmitted] = useState(
    checkIns.some((checkIn) => checkIn.check_in_type === "12_hour" && Boolean(checkIn.submitted_at))
  );
  const [showAllMemory, setShowAllMemory] = useState(false);
  const twelveHourCheckIn = checkIns.find((checkIn) => checkIn.check_in_type === "12_hour");
  const planEntries = preparationPlan
    ? Object.entries(preparationPlan).filter(([key]) => !["id", "client_id", "updated_at"].includes(key))
    : [];
  const checkInSession = sessions.find((session) => session.session_type === "check_in_12hr" && session.status === "scheduled") ??
    sessions
      .filter((session) => session.session_type === "check_in_12hr")
      .sort((a, b) => (b.scheduled_at ?? "").localeCompare(a.scheduled_at ?? ""))[0];
  const stageLink = PHASE_LINKS.find((stage) => stage.phase === workspaceStage)!;
  const stageMilestone = milestones.find((milestone) => milestone.milestone_key === stageLink.milestoneKey);
  const stageState = getJourneyStageWorkspaceState(client, milestones, workspaceStage, stageLink.milestoneKey);
  const stageSession = stageLink.sessionType
    ? sessions.find((session) => session.session_type === stageLink.sessionType && session.status === "scheduled") ?? sessions.find((session) => session.session_type === stageLink.sessionType)
    : undefined;
  const stageHref = workspaceStage === "post_journey_check_in"
    ? `/clients/${clientId}?tab=${encodeURIComponent("Journey & AI")}&stage=${workspaceStage}`
    : stageSession
      ? `/clients/${clientId}/sessions/${stageSession.id}`
      : `/clients/${clientId}/${stageLink.href}`;
  const stageTitle = workspaceStage === "intake" ? "Intake & Assessment" : stageLink.label;
  const intakeSummaries = aiSummaries.filter((summary) => summary.summary_type === "client_assessment_summary");

  return (
    <>
      <section id="stage-workspace" className="scroll-mt-5 mb-8">
        <MilestoneToggleBanner
          clientId={clientId}
          milestoneKey={stageLink.milestoneKey}
          label={stageTitle}
          meta={`Phase ${PHASE_LINKS.findIndex((stage) => stage.phase === workspaceStage) + 1} · ${stageLink.label}`}
          initialCompleted={stageMilestone?.completed ?? false}
          prepareMeSessionId={stageSession?.id}
          stageStatus={stageState.status}
          canMarkComplete={stageState.canMarkComplete}
          canPrepare={stageState.canPrepare}
        />
        {workspaceStage === "intake" ? (
          <IntakeWorkspace
            clientId={clientId}
            clientName={clientName}
            documents={documents}
            formTemplates={formTemplates}
            formSubmissions={formSubmissions}
            existingSummaries={intakeSummaries}
          />
        ) : workspaceStage === "post_journey_check_in" ? (
          <CheckInWorkspace
            clientId={clientId}
            clientName={clientName}
            existingCheckIn={twelveHourCheckIn}
            onSubmitted={() => setCheckInSubmitted(true)}
          />
        ) : (
          <div className="card p-5 text-sm text-ink-600">
            <p>Open the {stageTitle} workspace to continue this stage.</p>
            <Link href={stageHref} className="mt-3 inline-flex font-semibold text-clay-600 hover:text-clay-700 hover:underline">
              Open {stageTitle} workspace <span aria-hidden="true" className="ml-1">→</span>
            </Link>
          </div>
        )}
      </section>

      <div className="journey-practitioner-grid">
        <div className="journey-practitioner-main">
          <JourneyAiSummaries clientId={clientId} initialSummaries={aiSummaries} checkInSubmitted={checkInSubmitted} />
          {preparationPlan && (
            <section className="journey-preparation-plan" aria-labelledby="journey-preparation-plan-heading">
              <h3 id="journey-preparation-plan-heading" className="journey-icon-heading"><BookOpen aria-hidden="true" />Preparation &amp; Navigation Plan</h3>
              <div className="journey-preparation-sections">
                {planEntries.map(([key, value]) => {
                  const content = String(value ?? "—");
                  const label = key.replace(/_/g, " ");
                  return content.length > 320 ? (
                    <details key={key} className="journey-preparation-section journey-preparation-section--long">
                      <summary>{label}</summary>
                      <p>{content}</p>
                    </details>
                  ) : (
                    <div key={key} className="journey-preparation-section">
                      <h4>{label}</h4>
                      <p>{content}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
        <aside className="journey-client-memory" aria-labelledby="journey-client-memory-heading">
          <h3 id="journey-client-memory-heading" className="journey-icon-heading"><Brain aria-hidden="true" />Client Memory</h3>
          {memory.length > 0 ? (
            <>
              <ul className="journey-client-memory-list">
                {(showAllMemory ? memory : memory.slice(0, 4)).map((item) => (
                  <li key={item.id}>
                    <span className="journey-client-memory-badge">{item.item_type.replace(/_/g, " ")}</span>
                    <p>{item.content}</p>
                  </li>
                ))}
              </ul>
              {memory.length > 4 && (
                <button type="button" className="journey-client-memory-toggle" onClick={() => setShowAllMemory((visible) => !visible)}>
                  {showAllMemory ? "Show less" : `View all (${memory.length})`}
                </button>
              )}
            </>
          ) : <p className="journey-client-memory-empty">No memory items yet.</p>}
        </aside>
      </div>
    </>
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
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [messageOverrides, setMessageOverrides] = useState<Record<string, Message>>({});
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [messageError, setMessageError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const visibleMessages = messages
    .filter((message) => !deletedIds.includes(message.id))
    .map((message) => messageOverrides[message.id] ?? message);

  async function saveEdit(messageId: string) {
    if (!editDraft.trim()) return;
    setBusyId(messageId);
    setMessageError("");
    try {
      const updated = await editSentMessageAction(clientId, messageId, "practitioner", editDraft);
      setMessageOverrides((current) => ({ ...current, [messageId]: updated }));
      setEditingId(null);
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : "Could not edit the message.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRemoveMessage() {
    if (!pendingDeleteId) return;
    const messageId = pendingDeleteId;
    setBusyId(messageId);
    setMessageError("");
    try {
      await deleteSentMessageAction(clientId, messageId, "practitioner");
      setDeletedIds((current) => [...current, messageId]);
      if (editingId === messageId) setEditingId(null);
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : "Could not delete the message.");
    } finally {
      setBusyId(null);
      setPendingDeleteId(null);
    }
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 card p-4 flex flex-col h-[480px]">
        <h3 className="font-medium text-ink-900 mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-clay-500" /> Secure Messages
        </h3>
        <div className="message-thread-scroll flex-1 overflow-y-auto space-y-2 pr-1">
          {visibleMessages.map((m) => (
            <div
              key={m.id}
              className={cx(
                "max-w-[80%] break-words rounded-2xl px-3 py-2 text-sm",
                m.sender === "practitioner" ? "bg-clay-500 text-white ml-auto" : "bg-ink-100 text-ink-800"
              )}
            >
              {editingId === m.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editDraft}
                    onChange={(event) => setEditDraft(event.target.value)}
                    rows={3}
                    aria-label="Edit message"
                    className="w-full resize-y rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-ink-900 focus:outline-none focus:ring-2 focus:ring-clay-200"
                  />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditingId(null)} disabled={busyId === m.id} className="text-xs text-white/80 hover:text-white">Cancel</button>
                    <button type="button" onClick={() => saveEdit(m.id)} disabled={!editDraft.trim() || busyId === m.id} className="rounded-md bg-white px-2 py-1 text-xs font-medium text-clay-700 disabled:opacity-60">Save</button>
                  </div>
                </div>
              ) : <div className="whitespace-pre-wrap">{m.body}</div>}
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className={cx("text-xs", m.sender === "practitioner" ? "text-white/70" : "text-ink-400")}>
                  {formatDateTime(m.created_at)}{m.edited_at ? " · Edited" : ""}
                </span>
                {m.sender === "practitioner" && editingId !== m.id && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => { setEditingId(m.id); setEditDraft(m.body); setMessageError(""); }} disabled={busyId === m.id} aria-label="Edit message" title="Edit message" className="rounded p-1 text-white/75 hover:bg-white/15 hover:text-white disabled:opacity-50"><Pencil className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => setPendingDeleteId(m.id)} disabled={busyId === m.id} aria-label="Delete message" title="Delete message" className="rounded p-1 text-white/75 hover:bg-white/15 hover:text-white disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {visibleMessages.length === 0 && <p className="text-sm text-ink-400">No messages yet.</p>}
        </div>
        {messageError && <p role="alert" className="mt-2 text-xs text-red-600">{messageError}</p>}
        <form
          className="mt-3 flex items-end gap-2 border-t border-ink-100 pt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            setSending(true);
            await sendMessageAction(clientId, "practitioner", draft.trim());
            setDraft("");
            composerRef.current?.style.removeProperty("height");
            setSending(false);
          }}
        >
          <textarea
            ref={composerRef}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              resizeMessageComposer(event.currentTarget);
            }}
            onKeyDown={submitMessageOnEnter}
            rows={1}
            placeholder="Write a message..."
            aria-label="Write a message"
            className="message-composer min-h-10 max-h-36 flex-1 resize-none overflow-y-auto rounded-xl border border-ink-200 px-3 py-2 text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-clay-200"
          />
          <button type="submit" disabled={sending} className="btn-primary p-2">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete this message?"
        description="This action cannot be undone."
        confirmLabel="Delete message"
        busy={pendingDeleteId !== null && busyId === pendingDeleteId}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => void confirmRemoveMessage()}
      />
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

function resizeMessageComposer(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
}

function submitMessageOnEnter(event: React.KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}
