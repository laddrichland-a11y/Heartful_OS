import {
  AiSummary,
  CheckIn,
  Client,
  ClientDocument,
  ClientMemoryItem,
  DOCUMENT_LABELS,
  EmailLog,
  JourneyMilestone,
  Message,
  PortalAssignment,
  PostIntegrationForm,
  Session,
  Task,
  FormSubmission,
} from "@/lib/types";

// Builds a single chronological activity feed for a client out of records
// that already live in separate tabs (sessions, documents, messages, etc).
// There's no dedicated audit-log table — this is assembled on the fly from
// the timestamps each record already carries. A couple of record types
// (Session, Task) only track a current status with no "when it changed"
// timestamp, so e.g. a completed session shows under its scheduled date
// rather than the moment it was marked complete — noted in the UI.
export type ActivityKind =
  | "client_created"
  | "session_scheduled"
  | "session_completed"
  | "session_cancelled"
  | "document_uploaded"
  | "form_submitted"
  | "form_signed"
  | "message_out"
  | "message_in"
  | "task_completed"
  | "assignment_completed"
  | "check_in"
  | "integration_form"
  | "milestone"
  | "ai_summary"
  | "memory_item"
  | "intro_email_sent"
  | "journey_prep_email_sent"
  | "journey_started"
  | "journey_ended"
  | "booster_dose_given";

export interface ActivityEvent {
  id: string;
  at: string;
  kind: ActivityKind;
  title: string;
  detail?: string;
  /** Full-page navigation (opens in new tab). */
  href?: string;
  /** In-page tab switch — call setTab() with this value instead of navigating. */
  tab?: string;
}

// ---------------------------------------------------------------------------
// Helper: resolve the destination for an AI summary based on its type.
// Returns { href } for a new-tab page navigation, or { tab } for an
// in-page tab switch.
// ---------------------------------------------------------------------------
function aiSummaryDestination(
  s: AiSummary,
  clientId: string
): { href: string; tab?: never } | { tab: string; href?: never } {
  switch (s.summary_type) {
    case "client_assessment_summary":
      return { href: `/clients/${clientId}/intake` };
    case "journey_brief":
      return { href: `/clients/${clientId}/preparation` };
    case "journey_summary":
      return { href: `/clients/${clientId}/journey-day` };
    case "check_in_12hr_summary":
      return { href: `/clients/${clientId}?tab=Journey%20%26%20AI&stage=post_journey_check_in#check-in` };
    case "integration_1_brief":
      return { href: `/clients/${clientId}/integration-1` };
    case "integration_summary":
      return {
        href: s.title.includes("2")
          ? `/clients/${clientId}/integration-2`
          : `/clients/${clientId}/integration-1`,
      };
    case "growth_action_plan":
      return { href: `/clients/${clientId}/integration-2` };
    case "prepare_me_briefing":
      // Link directly to the session detail page when session_id is available
      return s.session_id
        ? { href: `/clients/${clientId}/sessions/${s.session_id}` }
        : { tab: "AI Copilot" };
    case "living_journey_summary":
    default:
      return { tab: "AI Copilot" };
  }
}

export function buildClientActivity(input: {
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
}): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const cid = input.client.id;

  events.push({
    id: `client-created-${cid}`,
    at: input.client.created_at,
    kind: "client_created",
    title: "Client record created",
  });

  for (const s of input.sessions) {
    if (!s.scheduled_at) continue;
    const typeLabel = s.session_type.replace(/_/g, " ");
    const sessionHref = `/clients/${cid}/sessions/${s.id}`;
    if (s.status === "completed") {
      events.push({
        id: `${s.id}-completed`,
        at: s.scheduled_at,
        kind: "session_completed",
        title: `Session completed: ${typeLabel}`,
        detail: s.location,
        href: sessionHref,
      });
    } else if (s.status === "cancelled" || s.status === "no_show") {
      events.push({
        id: `${s.id}-${s.status}`,
        at: s.scheduled_at,
        kind: "session_cancelled",
        title: `Session ${s.status === "no_show" ? "no-show" : "cancelled"}: ${typeLabel}`,
        href: sessionHref,
      });
    } else {
      events.push({
        id: `${s.id}-scheduled`,
        at: s.scheduled_at,
        kind: "session_scheduled",
        title: `Session scheduled: ${typeLabel}`,
        detail: s.location,
        href: sessionHref,
      });
    }
    if (s.journey_started_at) {
      events.push({
        id: `${s.id}-journey-started`,
        at: s.journey_started_at,
        kind: "journey_started",
        title: "Journey Day began",
        href: `/clients/${cid}/sessions/${s.id}`,
      });
    }
    if (s.journey_ended_at) {
      events.push({
        id: `${s.id}-journey-ended`,
        at: s.journey_ended_at,
        kind: "journey_ended",
        title: "Journey Day ended",
        href: `/clients/${cid}/sessions/${s.id}`,
      });
    }
    if (s.booster_dose_at) {
      events.push({
        id: `${s.id}-booster-dose`,
        at: s.booster_dose_at,
        kind: "booster_dose_given",
        title: "Booster dose given",
        detail: s.booster_dose_amount,
        href: `/clients/${cid}/sessions/${s.id}`,
      });
    }
  }

  for (const doc of input.documents) {
    for (const v of doc.versions) {
      events.push({
        id: v.id,
        at: v.created_at,
        kind: "document_uploaded",
        title: `Uploaded ${DOCUMENT_LABELS[doc.document_type] ?? doc.title}`,
        detail: `${v.file_name}${v.uploaded_by_role ? ` · by ${v.uploaded_by_role}` : ""}`,
        tab: "Documents",
      });
    }
  }

  for (const sub of input.formSubmissions) {
    const doc = input.documents.find((d) => d.id === sub.document_id);
    const label = doc ? DOCUMENT_LABELS[doc.document_type] ?? doc.title : "Form";
    const formHref = doc ? `/clients/${cid}/forms/${doc.id}` : undefined;
    if (sub.signed_at) {
      events.push({
        id: `${sub.id}-signed`,
        at: sub.signed_at,
        kind: "form_signed",
        title: `Signed: ${label}`,
        href: formHref,
      });
    } else if (sub.submitted_at) {
      events.push({
        id: `${sub.id}-submitted`,
        at: sub.submitted_at,
        kind: "form_submitted",
        title: `Submitted: ${label}`,
        href: formHref,
      });
    }
  }

  for (const m of input.messages) {
    events.push({
      id: m.id,
      at: m.created_at,
      kind: m.sender === "practitioner" ? "message_out" : "message_in",
      title: m.sender === "practitioner" ? "Message sent to client" : "Message received from client",
      detail: m.body.length > 80 ? `${m.body.slice(0, 80)}…` : m.body,
      tab: "Messages",
    });
  }

  for (const t of input.tasks) {
    if (t.completed_at) {
      events.push({
        id: `${t.id}-done`,
        at: t.completed_at,
        kind: "task_completed",
        title: `Task completed: ${t.title}`,
        tab: "Action Items",
      });
    }
  }

  for (const a of input.portalAssignments) {
    if (a.completed_at) {
      events.push({
        id: `${a.id}-done`,
        at: a.completed_at,
        kind: "assignment_completed",
        title: `Assignment completed: ${a.title}`,
        tab: "Action Items",
      });
    }
  }

  for (const c of input.checkIns) {
    if (c.submitted_at) {
      events.push({
        id: c.id,
        at: c.submitted_at,
        kind: "check_in",
        title: `${c.check_in_type === "12_hour" ? "12-Hour" : "48-Hour"} check-in submitted`,
        href: `/clients/${cid}?tab=Journey%20%26%20AI&stage=post_journey_check_in#check-in`,
      });
    }
  }

  for (const f of input.postIntegrationForms) {
    if (f.submitted_at) {
      events.push({
        id: f.id,
        at: f.submitted_at,
        kind: "integration_form",
        title: `Integration Session ${f.integration_session} form submitted`,
        href: `/clients/${cid}/integration-${f.integration_session}`,
      });
    }
  }

  for (const m of input.milestones) {
    if (m.completed && m.completed_at) {
      events.push({
        id: m.id,
        at: m.completed_at,
        kind: "milestone",
        title: `Milestone reached: ${m.milestone_key === "journey_complete" ? "Journey Day Complete" : m.label}`,
        tab: "Journey & AI",
      });
    }
  }

  for (const s of input.aiSummaries) {
    events.push({
      id: s.id,
      at: s.created_at,
      kind: "ai_summary",
      title: `AI summary generated: ${s.title}`,
      ...aiSummaryDestination(s, cid),
    });
  }

  for (const log of input.emailLogs) {
    events.push({
      id: log.id,
      at: log.created_at,
      kind: log.email_type === "journey_prep" ? "journey_prep_email_sent" : "intro_email_sent",
      title: log.email_type === "journey_prep" ? "Journey prep email prepared" : "Intro email prepared",
      detail: log.channel === "mail_app" ? "Opened in mail app" : "Copied to send manually",
    });
  }

  for (const mem of input.memory) {
    events.push({
      id: mem.id,
      at: mem.created_at,
      kind: "memory_item",
      title: mem.item_type === "note" ? "Quick note added" : `Memory item added (${mem.item_type.replace(/_/g, " ")})`,
      detail: mem.content.length > 100 ? `${mem.content.slice(0, 100)}…` : mem.content,
      ...(mem.item_type === "note" ? {} : { tab: "AI Copilot" }),
    });
  }

  return events.sort((a, b) => (a.at < b.at ? 1 : -1));
}
