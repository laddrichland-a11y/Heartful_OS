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
    <section className="client-surface mb-5 overflow-hidden" aria-labelledby="whats-next-heading">
      <div className="flex items-baseline gap-3 border-b border-ink-100 px-4 py-2.5 sm:px-5">
        <p className="client-eyebrow shrink-0">Overview</p>
        <h2 id="whats-next-heading" className="text-sm font-semibold text-ink-900">
          What&apos;s next
        </h2>
      </div>
      <div className="divide-y divide-ink-100">
        {/* Upcoming Sessions */}
        {upcomingSessions.map((s) => (
          <ActionRow
            key={s.id}
            icon={<CalendarClock className="h-4 w-4" />}
            label="Upcoming session"
            labelHref={`/clients/${clientId}?tab=${encodeURIComponent("AI Copilot")}`}
            href={`/clients/${clientId}/sessions/${s.id}`}
            title={SESSION_TYPE_LABELS[s.session_type] ?? s.session_type}
            meta={formatDateTime(s.scheduled_at)}
            tone="clay"
          />
        ))}

        {/* Outstanding Forms */}
        {outstandingForms.map((d) => (
          <ActionRow
            key={d.id}
            icon={<FileWarning className="h-4 w-4" />}
            label="Outstanding form"
            labelHref={`/clients/${clientId}?tab=${encodeURIComponent("Documents")}`}
            title={d.title}
            meta={d.status === "missing" ? "Not started" : "In progress"}
            tone="amber"
          />
        ))}

        {/* Open Tasks */}
        {openTasks.slice(0, 5).map((t) => (
          <ActionRow
            key={t.id}
            icon={<ClipboardList className="h-4 w-4" />}
            label="Open task"
            labelHref={`/clients/${clientId}?tab=${encodeURIComponent("Sessions")}`}
            href={`/clients/${clientId}/tasks/${t.id}`}
            title={t.title}
            meta={t.due_at ? `Due ${formatDate(t.due_at)}` : undefined}
            tone="plum"
          />
        ))}

        {/* Incomplete Portal Assignments */}
        {incompleteAssignments.slice(0, 5).map((a) => (
          <ActionRow
            key={a.id}
            icon={<BookOpen className="h-4 w-4" />}
            label="Portal assignment"
            labelHref={`/clients/${clientId}?tab=${encodeURIComponent("Sessions")}`}
            href={`/clients/${clientId}?tab=${encodeURIComponent("Sessions")}`}
            title={a.title}
            meta={a.due_at ? `Due ${formatDate(a.due_at)}` : undefined}
            tone="sage"
          />
        ))}
      </div>
    </section>
  );
}

function ActionRow({
  icon,
  label,
  labelHref,
  href,
  title,
  meta,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  labelHref: string;
  href?: string;
  title: string;
  meta?: string;
  tone: "clay" | "amber" | "plum" | "sage";
}) {
  const toneClasses = {
    clay: "bg-clay-50 text-clay-600",
    amber: "bg-amber-50 text-amber-600",
    plum: "bg-plum-50 text-plum-600",
    sage: "bg-sage-50 text-sage-600",
  }[tone];

  const titleClasses =
    "min-w-0 font-medium text-ink-800 transition-colors hover:text-clay-600";

  return (
    <div className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-2 sm:grid-cols-[11rem_minmax(0,1fr)_auto] sm:px-5">
      <Link
        href={labelHref}
        className="flex min-w-0 items-center gap-2 text-xs font-semibold text-ink-500 hover:text-ink-800"
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${toneClasses}`}
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="truncate">{label}</span>
        <span className="hidden text-ink-300 sm:inline" aria-hidden="true">
          ·
        </span>
      </Link>
      {href ? (
        <Link
          href={href}
          className={`${titleClasses} col-span-2 pl-8 text-sm sm:col-span-1 sm:pl-0`}
        >
          {title}
        </Link>
      ) : (
        <span className="col-span-2 min-w-0 pl-8 text-sm font-medium text-ink-800 sm:col-span-1 sm:pl-0">
          {title}
        </span>
      )}
      {meta && (
        <span className="col-start-2 row-start-1 whitespace-nowrap text-xs text-ink-400 sm:col-start-3">
          {meta}
        </span>
      )}
    </div>
  );
}
