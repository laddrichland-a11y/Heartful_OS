import Link from "next/link";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  FileText,
  ListTodo,
  MessageSquare,
  Sparkles,
  Upload,
} from "@/components/ui/HeartfulIcon";
import {
  AiSummary,
  CheckIn,
  Client,
  ClientDocument,
  DOCUMENT_LABELS,
  FormSubmission,
  JourneyMilestone,
  Message,
  PortalAssignment,
  PostIntegrationForm,
  Session,
  Task,
  Transcript,
} from "@/lib/types";
import { formatDate, formatDateTime, getClientJourneyProgress, relativeDueLabel, SESSION_TYPE_LABELS } from "@/lib/utils";

interface Props {
  client: Client;
  sessions: Session[];
  milestones: JourneyMilestone[];
  documents: ClientDocument[];
  formSubmissions: FormSubmission[];
  tasks: Task[];
  portalAssignments: PortalAssignment[];
  checkIns: CheckIn[];
  postIntegrationForms: PostIntegrationForm[];
  transcripts: Transcript[];
  aiSummaries: AiSummary[];
  messages: Message[];
}

type RailActivity = {
  id: string;
  at: string;
  category: "submission" | "transcript" | "summary" | "message";
  title: string;
  detail: string;
  href: string;
  icon: typeof FileText;
};

export default function ClientContextRail({
  client,
  sessions,
  milestones,
  documents,
  formSubmissions,
  tasks,
  portalAssignments,
  checkIns,
  postIntegrationForms,
  transcripts,
  aiSummaries,
  messages,
}: Props) {
  const now = new Date().toISOString();
  const nextSession = sessions
    .filter((session) => session.status === "scheduled" && session.scheduled_at && session.scheduled_at > now)
    .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))[0];

  const followUpTask = tasks.find(
    (task) => task.status !== "completed" && task.status !== "skipped" && task.task_type === "follow_up"
  );
  const nextSessionLabel = nextSession
    ? nextSession.session_type === "other" && followUpTask
      ? followUpTask.title
      : SESSION_TYPE_LABELS[nextSession.session_type] ?? nextSession.session_type.replace(/_/g, " ")
    : "No session scheduled";

  const journeyProgress = getClientJourneyProgress(client, milestones);
  const progress = Math.round((journeyProgress.completed / journeyProgress.total) * 100);

  const submissionDocumentIds = new Set(formSubmissions.map((submission) => submission.document_id));
  const inProgressDocumentIds = new Set(
    formSubmissions
      .filter((submission) => submission.status === "draft" || submission.status === "in_progress")
      .map((submission) => submission.document_id)
  );
  const outstandingForms = documents.filter(
    (document) =>
      document.required &&
      (document.status === "missing" || inProgressDocumentIds.has(document.id)) &&
      (submissionDocumentIds.has(document.id) || document.versions.length > 0)
  );
  const overdueTasks = tasks.filter(
    (task) =>
      task.status !== "completed" &&
      task.status !== "skipped" &&
      (task.status === "overdue" || Boolean(task.due_at && task.due_at < now))
  );
  const pendingCheckIns = checkIns.filter((checkIn) => !checkIn.submitted_at).length +
    portalAssignments.filter(
      (assignment) =>
        assignment.status !== "completed" &&
        assignment.status !== "skipped" &&
        assignment.title.toLowerCase().includes("check-in")
    ).length;
  const unreadMessages = messages.filter(
    (message) => message.sender === "client" && !message.read_at
  );
  const hasAttentionItems =
    outstandingForms.length > 0 ||
    overdueTasks.length > 0 ||
    pendingCheckIns > 0 ||
    unreadMessages.length > 0;

  const allActivities = buildRecentActivity({
    client,
    documents,
    formSubmissions,
    checkIns,
    postIntegrationForms,
    transcripts,
    aiSummaries,
    messages,
  });
  const activities = (["submission", "transcript", "summary", "message"] as const)
    .map((category) => allActivities.find((activity) => activity.category === category))
    .filter((activity): activity is RailActivity => Boolean(activity))
    .sort((a, b) => b.at.localeCompare(a.at));

  return (
    <aside className="wn-context-rail" aria-label={`Context for ${client.full_name}`}>
      <section className="wn-rail-card wn-next-session-card">
        <RailHeading icon={CalendarDays} title="Next Session" />
        <p className="wn-rail-session-type">{nextSessionLabel}</p>
        {nextSession?.scheduled_at ? (
          <>
            <time dateTime={nextSession.scheduled_at} className="wn-rail-session-time">
              {formatDateTime(nextSession.scheduled_at)}
            </time>
            <span className="wn-status-pill"><span /> Scheduled</span>
            <Link className="wn-rail-primary-action" href={`/clients/${client.id}/sessions/${nextSession.id}`}>
              <Sparkles aria-hidden="true" />
              Prepare Me
              <ChevronRight aria-hidden="true" />
            </Link>
          </>
        ) : (
          <p className="wn-rail-empty">Add a session to unlock a client briefing.</p>
        )}
      </section>

      <section className="wn-rail-card">
        <RailHeading icon={ClipboardCheck} title="Journey Progress" />
        <p className="wn-rail-kicker">Current stage</p>
        <div className="wn-journey-summary">
          <strong>{journeyProgress.currentStageLabel}</strong>
          <span>{journeyProgress.completed} of {journeyProgress.total} stages</span>
        </div>
        <div
          className="wn-rail-progress"
          role="progressbar"
          aria-label="Journey stages completed"
          aria-valuemin={0}
          aria-valuemax={journeyProgress.total}
          aria-valuenow={journeyProgress.completed}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <a
          className="wn-rail-text-link"
          href={`/clients/${client.id}?tab=${encodeURIComponent("Journey & AI")}`}
        >
          View journey <ChevronRight aria-hidden="true" />
        </a>
      </section>

      <section className="wn-rail-card">
        <RailHeading icon={ListTodo} title="Tasks & Reminders" />
        {tasks.length > 0 ? (
          <div className="wn-task-list">
            {tasks.map((task) => (
              <div key={task.id} className="wn-task-item">
                <Link className="wn-task-copy" href={`/clients/${client.id}/tasks/${task.id}`}>
                  <strong>{task.title}</strong>
                  {task.due_at && <small>{task.status === "completed" ? "Completed" : relativeDueLabel(task.due_at)}</small>}
                </Link>
                {task.status === "completed" ? (
                  <span className="wn-task-status is-complete">Done</span>
                ) : (
                  <Link className="wn-task-open-button" href={`/clients/${client.id}/tasks/${task.id}`} aria-label={`Open task: ${task.title}`}>
                    Open task <ChevronRight aria-hidden="true" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="wn-rail-empty">No tasks yet.</p>
        )}
      </section>

      {hasAttentionItems && (
        <section className="wn-rail-card">
          <RailHeading icon={AlertCircle} title="Needs Attention" />
          <div className="wn-attention-list">
            <AttentionRow label="Outstanding forms" count={outstandingForms.length} href={`/clients/${client.id}?tab=Documents`} />
            <AttentionRow label="Overdue tasks" count={overdueTasks.length} href={overdueTasks[0] ? `/clients/${client.id}/tasks/${overdueTasks[0].id}` : `/clients/${client.id}?tab=Sessions`} />
            <AttentionRow label="Pending check-ins" count={pendingCheckIns} href={`/clients/${client.id}?tab=${encodeURIComponent("Journey & AI")}#check-in`} />
            <AttentionRow label="Unread messages" count={unreadMessages.length} href={`/clients/${client.id}?tab=Messages`} />
          </div>
        </section>
      )}

      <section className="wn-rail-card">
        <RailHeading icon={Check} title="Recent Activity" />
        {activities.length > 0 ? (
          <div className="wn-recent-list">
            {activities.map((activity) => {
              const Icon = activity.icon;
              return (
                <Link key={activity.id} className="wn-recent-item" href={activity.href}>
                  <span className="wn-recent-icon"><Icon aria-hidden="true" /></span>
                  <span className="wn-recent-copy">
                    <strong>{activity.title}</strong>
                    <small>{activity.detail} · {formatDate(activity.at)}</small>
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="wn-rail-empty">No recent activity yet.</p>
        )}
      </section>
    </aside>
  );
}

function RailHeading({ icon: Icon, title }: { icon: typeof CalendarDays; title: string }) {
  return (
    <header className="wn-rail-heading">
      <span className="wn-rail-heading-icon"><Icon aria-hidden="true" width={18} height={18} strokeWidth={1.75} /></span>
      <h2>{title}</h2>
    </header>
  );
}

function AttentionRow({ label, count, href }: { label: string; count: number; href: string }) {
  return (
    <Link className="wn-attention-row" href={href} data-active={count > 0 ? "true" : "false"}>
      <span>{label}</span>
      <strong>{count}</strong>
    </Link>
  );
}

function buildRecentActivity({
  client,
  documents,
  formSubmissions,
  checkIns,
  postIntegrationForms,
  transcripts,
  aiSummaries,
  messages,
}: Pick<Props, "client" | "documents" | "formSubmissions" | "checkIns" | "postIntegrationForms" | "transcripts" | "aiSummaries" | "messages">): RailActivity[] {
  const activities: RailActivity[] = [];

  for (const submission of formSubmissions) {
    const at = submission.signed_at ?? submission.submitted_at;
    if (!at) continue;
    const document = documents.find((item) => item.id === submission.document_id);
    activities.push({
      id: `submission-${submission.id}`,
      at,
      category: "submission",
      title: "Client submission",
      detail: document ? DOCUMENT_LABELS[document.document_type] ?? document.title : "Form received",
      href: document ? `/clients/${client.id}/forms/${document.id}` : `/clients/${client.id}?tab=Documents`,
      icon: FileText,
    });
  }

  for (const checkIn of checkIns) {
    if (!checkIn.submitted_at) continue;
    activities.push({
      id: `check-in-${checkIn.id}`,
      at: checkIn.submitted_at,
      category: "submission",
      title: "Client submission",
      detail: checkIn.check_in_type === "12_hour" ? "12-hour check-in" : "48-hour reflection",
      href: `/clients/${client.id}?tab=${encodeURIComponent("Journey & AI")}#check-in`,
      icon: ClipboardCheck,
    });
  }

  for (const form of postIntegrationForms) {
    if (!form.submitted_at) continue;
    activities.push({
      id: `integration-form-${form.id}`,
      at: form.submitted_at,
      category: "submission",
      title: "Client submission",
      detail: `Integration ${form.integration_session} reflection`,
      href: `/clients/${client.id}/integration-${form.integration_session}`,
      icon: FileText,
    });
  }

  for (const transcript of transcripts) {
    activities.push({
      id: `transcript-${transcript.id}`,
      at: transcript.created_at,
      category: "transcript",
      title: "Transcript uploaded",
      detail: transcript.source === "upload" ? "Session recording transcript" : "Pasted transcript",
      href: transcript.session_id
        ? `/clients/${client.id}/sessions/${transcript.session_id}`
        : `/clients/${client.id}?tab=${encodeURIComponent("AI Copilot")}`,
      icon: Upload,
    });
  }

  for (const summary of aiSummaries) {
    activities.push({
      id: `summary-${summary.id}`,
      at: summary.created_at,
      category: "summary",
      title: "Summary generated",
      detail: summary.title,
      href: summary.session_id
        ? `/clients/${client.id}/sessions/${summary.session_id}`
        : `/clients/${client.id}?tab=${encodeURIComponent("AI Copilot")}`,
      icon: Sparkles,
    });
  }

  for (const message of messages) {
    activities.push({
      id: `message-${message.id}`,
      at: message.created_at,
      category: "message",
      title: message.sender === "client" ? "Message from client" : "Message sent",
      detail: message.body.length > 38 ? `${message.body.slice(0, 38)}…` : message.body,
      href: `/clients/${client.id}?tab=Messages`,
      icon: MessageSquare,
    });
  }

  return activities.sort((a, b) => b.at.localeCompare(a.at));
}
