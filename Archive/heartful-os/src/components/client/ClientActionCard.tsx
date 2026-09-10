"use client";

import Link from "next/link";
import { CalendarClock, FileWarning, ClipboardList, BookOpen } from "lucide-react";
import { Session, ClientDocument, Task, PortalAssignment, FormSubmission } from "@/lib/types";
import { SESSION_TYPE_LABELS, formatDateTime, formatDate } from "@/lib/utils";

interface Props {
  clientId: string;
  sessions: Session[];
  documents: ClientDocument[];
  tasks: Task[];
  portalAssignments: PortalAssignment[];
  formSubmissions: FormSubmission[];
}

export default function ClientActionCard({
  clientId,
  sessions,
  documents,
  tasks,
  portalAssignments,
  formSubmissions,
}: Props) {
  // Upcoming scheduled sessions, soonest first — only future sessions
  const now = new Date().toISOString();
  const upcomingSessions = sessions
    .filter((s) => s.status === "scheduled" && s.scheduled_at && s.scheduled_at > now)
    .sort((a, b) => (a.scheduled_at! < b.scheduled_at! ? -1 : 1))
    .slice(0, 5);

  // Open tasks (not completed or skipped, and not past due)
  const openTasks = tasks.filter(
    (t) => t.status !== "completed" && t.status !== "skipped" && (!t.due_at || t.due_at > now)
  );

  // Incomplete portal assignments
  const incompleteAssignments = portalAssignments.filter(
    (a) => a.status !== "completed" && a.status !== "skipped"
  );

  // Outstanding forms: required docs that are missing or in-progress.
  // Exclude empty upload-only placeholder slots (no submission, no uploaded
  // versions) — those are legacy artifacts from early development and don't
  // represent real work the client needs to do.
  const submissionDocIds = new Set(formSubmissions.map((s) => s.document_id));
  const inProgressIds = new Set(
    formSubmissions
      .filter((s) => s.status === "in_progress" || s.status === "draft")
      .map((s) => s.document_id)
  );
  const outstandingForms = documents.filter(
    (d) =>
      d.required &&
      (d.status === "missing" || inProgressIds.has(d.id)) &&
      // Only count if it's a digital form (has a submission record) or has been uploaded
      (submissionDocIds.has(d.id) || d.versions.length > 0)
  );

  const hasAnything =
    upcomingSessions.length > 0 ||
    openTasks.length > 0 ||
    incompleteAssignments.length > 0 ||
    outstandingForms.length > 0;

  if (!hasAnything) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Upcoming Sessions */}
      {upcomingSessions.length > 0 && (
        <Section
          icon={<CalendarClock className="h-4 w-4 text-clay-500" />}
          title="Upcoming Sessions"
          tab="AI Copilot"
          clientId={clientId}
        >
          {upcomingSessions.map((s) => (
            <Item key={s.id} href={`/clients/${clientId}/sessions/${s.id}`}>
              <span className="font-medium">
                {SESSION_TYPE_LABELS[s.session_type] ?? s.session_type}
              </span>
              <span className="text-ink-400">{formatDateTime(s.scheduled_at)}</span>
            </Item>
          ))}
        </Section>
      )}

      {/* Outstanding Forms */}
      {outstandingForms.length > 0 && (
        <Section
          icon={<FileWarning className="h-4 w-4 text-amber-500" />}
          title={`Outstanding Forms (${outstandingForms.length})`}
          tab="Documents"
          clientId={clientId}
        >
          {outstandingForms.map((d) => (
            <Item key={d.id}>
              <span className="font-medium">{d.title}</span>
              <span className={`capitalize ${d.status === "missing" ? "text-amber-600" : "text-ink-400"}`}>
                {d.status === "missing" ? "Not started" : "In progress"}
              </span>
            </Item>
          ))}
        </Section>
      )}

      {/* Open Tasks */}
      {openTasks.length > 0 && (
        <Section
          icon={<ClipboardList className="h-4 w-4 text-plum-500" />}
          title={`Open Tasks (${openTasks.length})`}
          tab="Sessions"
          clientId={clientId}
        >
          {openTasks.slice(0, 5).map((t) => (
            <Item key={t.id} href={`/clients/${clientId}/tasks/${t.id}`}>
              <span className="font-medium">{t.title}</span>
              {t.due_at && (
                <span className="text-ink-400">Due {formatDate(t.due_at)}</span>
              )}
            </Item>
          ))}
        </Section>
      )}

      {/* Incomplete Portal Assignments */}
      {incompleteAssignments.length > 0 && (
        <Section
          icon={<BookOpen className="h-4 w-4 text-sage-600" />}
          title={`Portal Assignments (${incompleteAssignments.length})`}
          tab="Sessions"
          clientId={clientId}
        >
          {incompleteAssignments.slice(0, 5).map((a) => (
            <Item key={a.id} href={`/clients/${clientId}?tab=${encodeURIComponent("Sessions")}`}>
              <span className="font-medium">{a.title}</span>
              {a.due_at && (
                <span className="text-ink-400">Due {formatDate(a.due_at)}</span>
              )}
            </Item>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  tab,
  clientId,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tab: string;
  clientId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-4 flex flex-col gap-2">
      <Link
        href={`/clients/${clientId}?tab=${encodeURIComponent(tab)}`}
        className="flex items-center gap-1.5 font-semibold text-sm text-ink-800 hover:text-clay-600 transition-colors"
      >
        {icon}
        {title}
      </Link>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Item({ children, href }: { children: React.ReactNode; href?: string }) {
  const cls = "flex flex-col gap-0.5 text-xs border-l-2 border-ink-100 pl-2 hover:border-clay-300 transition-colors";
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return <div className={cls}>{children}</div>;
}
