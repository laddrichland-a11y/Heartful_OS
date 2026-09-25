import { Client, ClientStatus, DocumentType, JourneyMilestone, JourneyPhase, Session } from "@/lib/types";
import { AGREEMENT_DOCUMENT_TYPES, isAgreementDocumentType } from "@/lib/agreementStatus";
import { selectCurrentOrNextSession } from "@/lib/sessionSelectors";

export function cx(...args: (string | false | null | undefined)[]) {
  return args.filter(Boolean).join(" ");
}

/** @deprecated Import selectCurrentOrNextSession from sessionSelectors instead. */
export function getNextScheduledSession<
  T extends Pick<Session, "id" | "status" | "scheduled_at" | "duration_minutes" | "session_type" | "journey_started_at" | "journey_ended_at">,
>(sessions: T[], now = new Date().toISOString()): T | undefined {
  return selectCurrentOrNextSession(sessions, now);
}

// Client record tab definitions — kept here (not in ClientRecordTabs.tsx)
// so server components can import them without pulling in a "use client" module.
export const TABS = ["Documents", "Sessions", "Journey & AI", "AI Copilot", "Messages", "History"] as const;
export type Tab = (typeof TABS)[number];

// Shared display labels for session_type, used anywhere a Session needs a
// human-readable stage name (AI Copilot panel, per-client Copilot tab, etc.)
export const SESSION_TYPE_LABELS: Record<string, string> = {
  intake_assessment: "Intake & Assessment",
  preparation: "Preparation",
  harm_reduction_support: "Harm Reduction Support Session",
  check_in_12hr: "12-Hour Check-In",
  integration_1: "Integration Session One",
  integration_2: "Integration Session Two",
  other: "Other",
};

// Manual Notes auto-timestamping (Journey Day). Typing this marker alone on
// its own line and pressing Enter signals "I'm done with this note" — the
// next line automatically gets a fresh [h:mm AM/PM] timestamp so the next
// note is timestamped without any button or menu.
export const MANUAL_NOTE_MARKER = "///";

function formatNoteTimestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// Trimmed content of a single line (whitespace-tolerant, e.g. a stray
// trailing space before Enter).
function cleanLine(line: string): string {
  return line.trim();
}

// Called from the textarea's onChange with (previous value, new value, and
// the cursor position after the edit). Returns the possibly-stamped value
// plus where the cursor should end up.
//
// Only acts in two cases so it never surprises the user by rewriting text
// they're editing elsewhere in the note:
//  1. The box was empty and they just typed/pasted the first character(s) —
//     stamp the very start.
//  2. They just pressed Enter (or the browser otherwise inserted a newline
//     right at the cursor) and the line that newline just closed off ENDS
//     WITH the marker — stamp a fresh line right after it. The marker can
//     be alone on its own line ("///") or tacked onto the end of the note
//     itself ("wrapping up for now ///") — either way, typing the marker
//     and hitting Enter once is enough; no need to press Enter first to
//     start a blank line before typing it.
//
// Case 2 checks the line immediately before the CURSOR, not the last line
// of the whole textarea. That distinction matters once a note has enough
// content to scroll: clicking back into a long, scrolled textarea to keep
// writing does not reliably place the cursor at the true end of the whole
// string, so anchoring the check to "the end of the document" silently
// missed the marker whenever that happened — anchoring to "wherever the
// user is actually typing" fixes it regardless of where in the note that is.
export function withManualNoteAutoTimestamp(
  oldValue: string,
  newValue: string,
  cursorPos: number
): { value: string; cursorPos: number } {
  if (oldValue === "" && newValue.length > 0) {
    const stamp = `[${formatNoteTimestamp()}] `;
    return { value: `${stamp}${newValue}`, cursorPos: cursorPos + stamp.length };
  }
  if (newValue.length > oldValue.length && cursorPos > 0 && newValue[cursorPos - 1] === "\n") {
    const beforeNewline = newValue.slice(0, cursorPos - 1);
    const lineStart = beforeNewline.lastIndexOf("\n") + 1;
    const closedLine = beforeNewline.slice(lineStart);
    if (cleanLine(closedLine).endsWith(MANUAL_NOTE_MARKER)) {
      const stamp = `[${formatNoteTimestamp()}] `;
      const value = newValue.slice(0, cursorPos) + stamp + newValue.slice(cursorPos);
      return { value, cursorPos: cursorPos + stamp.length };
    }
  }
  return { value: newValue, cursorPos };
}

// Explicit, guaranteed-reliable alternative to the /// auto-detect above —
// wired to an "Insert Timestamp" button so a note can always be stamped
// with a single click, even if some OS/browser-level text-replacement or
// autocorrect setting is intercepting the marker keystrokes before this
// code ever sees them.
export function insertManualNoteTimestamp(value: string): string {
  if (value === "") return `[${formatNoteTimestamp()}] `;
  const withTrailingNewline = value.endsWith("\n") ? value : `${value}\n`;
  return `${withTrailingNewline}[${formatNoteTimestamp()}] `;
}

// Converts between an ISO timestamp and the local "YYYY-MM-DDTHH:mm" string
// an <input type="datetime-local"> expects/returns — used to let a
// practitioner correct a Journey Begin/End/Booster Dose time after the fact.
export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}

export function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatCurrency(n?: number) {
  if (n === undefined || n === null) return "$0";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function clientAvatarSrc(
  client: string | Pick<Client, "full_name" | "avatar_url">,
): string | undefined {
  const avatarByName: Record<string, string> = {
    "Maya Chen": "/images/clients/maya-chen.webp",
    "Daniel Ortiz": "/images/clients/daniel-ortiz.webp",
    "Priya Patel": "/images/clients/priya-patel.webp",
    "Marcus Webb": "/images/clients/marcus-webb.webp",
    "Sarah Klein": "/images/clients/sarah-klein.webp",
  };

  if (typeof client !== "string" && client.avatar_url) return client.avatar_url;
  return avatarByName[typeof client === "string" ? client : client.full_name];
}

export function statusBadgeClasses(status: ClientStatus): string {
  if (status === "journey_closed") return "bg-sage-100 text-sage-800";
  if (status === "inactive") return "bg-ink-100 text-ink-600";
  if (status.startsWith("integration")) return "bg-plum-100 text-plum-700";
  if (status === "journey_complete" || status === "check_in_complete") return "bg-sage-100 text-sage-700";
  if (status === "preparation" || status === "preparation_complete") return "client-status--preparation";
  return "bg-ink-100 text-ink-600";
}

/** Shared client-status palette for list rows and the editable client header. */
export function clientStatusBadgeClasses(status: ClientStatus): string {
  if (
    status === "intake_complete" ||
    status === "preparation_complete" ||
    status === "journey_complete" ||
    status === "check_in_complete" ||
    status === "integration_1_complete" ||
    status === "integration_2_complete" ||
    status === "journey_closed"
  ) {
    return "bg-sage-100 text-sage-700";
  }

  const activeStatusClasses: Partial<Record<ClientStatus, string>> = {
    inquiry: "client-status--inquiry",
    intake_scheduled: "client-status--intake-scheduled",
    preparation: "client-status--preparation",
    journey_scheduled: "client-status--journey-scheduled",
    integration_1: "client-status--integration-one",
    integration_2: "client-status--integration-two",
    inactive: "client-status--inactive",
  };

  return activeStatusClasses[status] ?? statusBadgeClasses(status);
}

export function phaseLabel(phase: JourneyPhase): string {
  const map: Record<JourneyPhase, string> = {
    intake: "Intake",
    preparation: "Preparation",
    harm_reduction_session: "Journey Day",
    post_journey_check_in: "Post-Journey Check-In",
    integration_1: "Integration 1",
    integration_2: "Integration 2",
    closed: "Closed",
  };
  return map[phase];
}

// Which journey phase a given status implies — used when a practitioner
// manually sets a client's status, so the phase chips/links stay in sync
// without having to be set separately. "inactive" has no phase of its own
// (a client can go inactive from anywhere), so it keeps whatever phase the
// client was already on.
export const STATUS_PHASE_MAP: Partial<Record<ClientStatus, JourneyPhase>> = {
  inquiry: "intake",
  intake_scheduled: "intake",
  intake_complete: "preparation",
  preparation: "preparation",
  preparation_complete: "harm_reduction_session",
  journey_scheduled: "harm_reduction_session",
  journey_complete: "post_journey_check_in",
  check_in_complete: "integration_1",
  integration_1: "integration_1",
  integration_1_complete: "integration_2",
  integration_2: "integration_2",
  integration_2_complete: "closed",
  journey_closed: "closed",
};

export function phaseForStatus(status: ClientStatus, fallback: JourneyPhase): JourneyPhase {
  return STATUS_PHASE_MAP[status] ?? fallback;
}

export type JourneyWorkspaceStage = Exclude<JourneyPhase, "closed"> | "growth_action_plan";
export type JourneyStageStatus = "completed" | "current" | "upcoming" | "future";

export const JOURNEY_COMPLETION_MILESTONE_KEYS = [
  "intake_complete",
  "preparation_complete",
  "journey_complete",
  "check_in_12hr_complete",
  "integration_1_complete",
  "integration_2_complete",
  "growth_action_plan_complete",
  "journey_closed",
] as const;

export type JourneyCompletionMilestoneKey = (typeof JOURNEY_COMPLETION_MILESTONE_KEYS)[number];

export const JOURNEY_STAGE_DEFINITIONS: ReadonlyArray<{
  phase: JourneyWorkspaceStage;
  milestoneKey: JourneyCompletionMilestoneKey;
  label: string;
}> = [
  { phase: "intake", milestoneKey: "intake_complete", label: "Intake" },
  { phase: "preparation", milestoneKey: "preparation_complete", label: "Preparation" },
  { phase: "harm_reduction_session", milestoneKey: "journey_complete", label: "Journey Day" },
  { phase: "post_journey_check_in", milestoneKey: "check_in_12hr_complete", label: "12-Hour Check-In" },
  { phase: "integration_1", milestoneKey: "integration_1_complete", label: "Integration 1" },
  { phase: "integration_2", milestoneKey: "integration_2_complete", label: "Integration 2" },
  { phase: "growth_action_plan", milestoneKey: "growth_action_plan_complete", label: "Growth Plan" },
];

export function journeyStageLabelForMilestone(milestoneKey: string, fallback = "Journey"): string {
  if (milestoneKey === "journey_closed") return "Journey";
  return JOURNEY_STAGE_DEFINITIONS.find((stage) => stage.milestoneKey === milestoneKey)?.label ?? fallback;
}

export function journeyStageStatusLabel(status: JourneyStageStatus): string | undefined {
  if (status === "completed") return "Completed";
  if (status === "current") return "Current";
  if (status === "upcoming") return "Upcoming";
  return undefined;
}

export function isJourneyCompletionMilestoneKey(key: string): key is JourneyCompletionMilestoneKey {
  return JOURNEY_COMPLETION_MILESTONE_KEYS.includes(key as JourneyCompletionMilestoneKey);
}

/**
 * A stage may only complete when every preceding journey milestone is done.
 * This pure rule is shared by the UI and the server data layer so a future
 * stage cannot be advanced by bypassing a disabled control.
 */
export function canCompleteJourneyMilestone(
  milestones: Pick<JourneyMilestone, "milestone_key" | "completed">[],
  milestoneKey: string,
): boolean {
  if (!isJourneyCompletionMilestoneKey(milestoneKey)) return false;
  const targetIndex = JOURNEY_COMPLETION_MILESTONE_KEYS.indexOf(milestoneKey);
  const completedKeys = new Set(
    milestones.filter((milestone) => milestone.completed).map((milestone) => milestone.milestone_key),
  );
  return JOURNEY_COMPLETION_MILESTONE_KEYS
    .slice(0, targetIndex)
    .every((requiredKey) => completedKeys.has(requiredKey));
}

export type JourneyCompletionIssue = "missing_content" | "previous_stages_incomplete";

/** Shared prerequisite check for every AI action that completes a journey stage. */
export function journeyCompletionIssue(
  milestones: Pick<JourneyMilestone, "milestone_key" | "completed">[],
  milestoneKey: JourneyCompletionMilestoneKey,
  hasContent: boolean,
): JourneyCompletionIssue | undefined {
  if (!hasContent) return "missing_content";
  if (!canCompleteJourneyMilestone(milestones, milestoneKey)) return "previous_stages_incomplete";
  return undefined;
}

export const SESSION_COMPLETION_MILESTONE_KEYS: Partial<
  Record<Session["session_type"], JourneyCompletionMilestoneKey>
> = {
  intake_assessment: "intake_complete",
  preparation: "preparation_complete",
  harm_reduction_support: "journey_complete",
  check_in_12hr: "check_in_12hr_complete",
  integration_1: "integration_1_complete",
  integration_2: "integration_2_complete",
};

export function canCompleteJourneySession(
  milestones: Pick<JourneyMilestone, "milestone_key" | "completed">[],
  sessionType: Session["session_type"],
): boolean {
  const milestoneKey = SESSION_COMPLETION_MILESTONE_KEYS[sessionType];
  return !milestoneKey || canCompleteJourneyMilestone(milestones, milestoneKey);
}

/**
 * Computes the displayed stage state from the client's real journey position,
 * never from the stage the practitioner happens to be viewing.
 */
export function getJourneyStageWorkspaceState(
  client: Pick<Client, "status" | "current_phase">,
  milestones: JourneyMilestone[],
  stage: JourneyWorkspaceStage,
  milestoneKey: string,
) {
  const milestoneCompleted = milestones.some(
    (milestone) => milestone.milestone_key === milestoneKey && milestone.completed,
  );
  const status = getClientJourneyProgress(client, milestones).stages.find(
    (candidate) => candidate.phase === stage,
  )?.status ?? "future";
  const canCompleteStage = milestoneCompleted || canCompleteJourneyMilestone(milestones, milestoneKey);

  return {
    status,
    // A prior stage inferred as complete from the client position should not
    // expose an "undo" control unless its milestone was explicitly recorded.
    canMarkComplete: canCompleteStage,
    canCompleteStage,
    // Every uncompleted practitioner-facing stage, from Intake through Growth
    // Plan, can be prepared in advance. The briefing itself only receives
    // context from earlier stages, so opening a later workspace does not leak
    // future-session information into its preparation.
    canPrepare: status !== "completed",
  };
}

/** The full client workspace route whose content matches the displayed phase. */
export function clientJourneyWorkspaceHref(
  client: Pick<Client, "id" | "status" | "current_phase">,
  sessions: Session[] = [],
): string {
  const base = `/clients/${client.id}`;
  const phase = phaseForStatus(client.status, client.current_phase);
  const selectedSession = selectCurrentOrNextSession(sessions);

  if (selectedSession) return `${base}/sessions/${selectedSession.id}`;

  switch (phase) {
    case "intake":
      return `${base}/intake`;
    case "preparation":
      return `${base}/preparation`;
    case "harm_reduction_session":
      return `${base}/journey-day`;
    case "post_journey_check_in":
      return `${base}?tab=${encodeURIComponent("Journey & AI")}&stage=post_journey_check_in`;
    case "integration_1":
      return `${base}/integration-1`;
    case "integration_2":
      return `${base}/integration-2`;
    case "closed":
      return `${base}/growth-plan`;
  }
}

/** Journey Day complete is not the same as a closed client journey. */
export function isCompletedClient(status: ClientStatus): boolean {
  return status === "journey_closed";
}

export function isActiveClient(status: ClientStatus): boolean {
  return status !== "journey_closed" && status !== "inactive";
}

export function isAwaitingIntegrationClient(status: ClientStatus): boolean {
  return status === "journey_complete" || status === "check_in_complete" || status === "integration_1_complete";
}

export const CLIENT_JOURNEY_STAGE_OPTIONS = [
  { value: "intake", label: "Intake" },
  { value: "preparation", label: "Preparation" },
  { value: "journey", label: "Journey Day" },
  { value: "check_in", label: "12-Hour Check-In" },
  { value: "integration", label: "Integration" },
  { value: "growth_plan", label: "Growth Plan" },
  { value: "completed", label: "Growth Plan · Completed" },
] as const;

export type ClientJourneyStageFilter = (typeof CLIENT_JOURNEY_STAGE_OPTIONS)[number]["value"];

export function clientJourneyStageForStatus(status: ClientStatus, phase: JourneyPhase): ClientJourneyStageFilter {
  if (status === "journey_closed") return "completed";
  if (status === "integration_2_complete") return "growth_plan";
  const current = phaseForStatus(status, phase);
  if (current === "post_journey_check_in") return "check_in";
  if (current === "harm_reduction_session") return "journey";
  if (current === "integration_1" || current === "integration_2") return "integration";
  if (current === "closed") return "growth_plan";
  return current;
}

/**
 * Client status is the persisted source of truth for a client's displayed
 * journey position. Completed milestones also act as a safe forward-only
 * fallback while older client records are being synchronized.
 */
export const JOURNEY_PROGRESS_COMPLETED_MILESTONES: Partial<Record<ClientStatus, number>> = {
  inquiry: 0,
  intake_scheduled: 0,
  intake_complete: 1,
  preparation: 1,
  preparation_complete: 2,
  journey_scheduled: 2,
  journey_complete: 3,
  check_in_complete: 4,
  integration_1: 4,
  integration_1_complete: 5,
  integration_2: 5,
  integration_2_complete: 6,
  journey_closed: 8,
};

export const JOURNEY_PROGRESS_STAGE_COUNT = 7;

export function completedJourneyMilestonePrefix(
  milestones: Pick<JourneyMilestone, "milestone_key" | "completed">[],
): number {
  const completedKeys = new Set(
    milestones.filter((milestone) => milestone.completed).map((milestone) => milestone.milestone_key),
  );
  const firstIncomplete = JOURNEY_COMPLETION_MILESTONE_KEYS.findIndex((key) => !completedKeys.has(key));
  return firstIncomplete === -1 ? JOURNEY_COMPLETION_MILESTONE_KEYS.length : firstIncomplete;
}

/** A manual status correction may roll back freely, but can only advance one stage at a time. */
export function canSetJourneyStatus(
  milestones: Pick<JourneyMilestone, "milestone_key" | "completed">[],
  status: ClientStatus,
): boolean {
  const targetCompleted = JOURNEY_PROGRESS_COMPLETED_MILESTONES[status];
  if (targetCompleted === undefined) return true;
  return targetCompleted <= completedJourneyMilestonePrefix(milestones) + 1;
}

/**
 * The shared journey-progress model for every practitioner surface. A
 * completed milestone can only move the display forward, never backward;
 * "inactive" deliberately preserves its retained stage and completed work.
 */
export function getClientJourneyProgress(
  client: Pick<Client, "status" | "current_phase">,
  milestones: JourneyMilestone[],
) {
  const closed = client.status === "journey_closed" || milestones.some(
    (milestone) => milestone.milestone_key === "journey_closed" && milestone.completed,
  );
  const milestoneCompleted = milestones.filter(
    (milestone) => milestone.sort_order <= JOURNEY_PROGRESS_STAGE_COUNT && milestone.completed,
  ).length;
  const statusCompleted = JOURNEY_PROGRESS_COMPLETED_MILESTONES[client.status];
  const retainedStageIndex = Math.max(
    0,
    JOURNEY_STAGE_DEFINITIONS.findIndex((stage) => stage.phase === client.current_phase),
  );
  const completed = Math.min(
    client.status === "inactive" || statusCompleted === undefined
      ? Math.max(milestoneCompleted, retainedStageIndex)
      : Math.max(statusCompleted, milestoneCompleted),
    JOURNEY_PROGRESS_STAGE_COUNT,
  );
  const phase = phaseForStatus(client.status, client.current_phase);
  const stages = JOURNEY_STAGE_DEFINITIONS.map((stage, index) => ({
    ...stage,
    status: (
      closed || index < completed
        ? "completed"
        : index === completed
          ? "current"
          : index === completed + 1
            ? "upcoming"
            : "future"
    ) as JourneyStageStatus,
  }));
  const currentStage = stages.find((stage) => stage.status === "current");
  const lastStage = stages.at(-1)!;

  return {
    completed: closed ? JOURNEY_PROGRESS_STAGE_COUNT : completed,
    total: JOURNEY_PROGRESS_STAGE_COUNT,
    phase,
    /** Inactive is a relationship status, never a journey-stage label. */
    currentStageLabel: closed ? lastStage.label : currentStage?.label ?? lastStage.label,
    currentStageStatus: (closed ? "completed" : "current") as JourneyStageStatus,
    stages,
  };
}

export function relativeDueLabel(iso?: string) {
  if (!iso) return "";
  const diffMs = new Date(iso).getTime() - Date.now();
  const hourMs = 1000 * 60 * 60;
  const dayMs = hourMs * 24;
  const overdue = diffMs < 0;
  const absoluteMs = Math.abs(diffMs);
  const hours = Math.max(1, Math.ceil(absoluteMs / hourMs));

  if (hours < 24) return overdue ? `${hours}h overdue` : `Due in ${hours}h`;

  const days = Math.max(1, Math.round(absoluteMs / dayMs));
  if (days < 60) {
    return overdue
      ? `${days} day${days === 1 ? "" : "s"} overdue`
      : `Due in ${days} day${days === 1 ? "" : "s"}`;
  }

  const months = Math.max(2, Math.floor(days / 30));
  return overdue
    ? `${months} month${months === 1 ? "" : "s"} overdue`
    : `Due in ${months} month${months === 1 ? "" : "s"}`;
}

export interface ActionableOutstandingItem {
  id: string;
  client_id: string;
  title: string;
  status: string;
  due_at?: string;
  kind?: "form";
  task_type?: "form" | "reminder" | "reflection" | "session_prep" | "follow_up";
  assigned_to?: string;
  href?: string;
}

export function isPastDue(item: Pick<ActionableOutstandingItem, "due_at">) {
  return Boolean(item.due_at && new Date(item.due_at).getTime() < Date.now());
}

export function outstandingItemHref(item: ActionableOutstandingItem) {
  if (item.href) return item.href;
  return item.kind === "form"
    ? `/clients/${item.client_id}/forms/${item.id}`
    : `/clients/${item.client_id}/tasks/${item.id}`;
}

export function outstandingActionLabel(item: ActionableOutstandingItem) {
  if (item.kind === "form") {
    if (item.status === "missing_template") return "Fix template";
    return item.status === "in_progress" ? "Review" : "Request";
  }

  const title = item.title.toLocaleLowerCase();
  if (item.task_type === "session_prep" || title.includes("schedule") || title.includes(" call")) {
    return "Schedule";
  }

  const clientOwned = item.assigned_to === "client";
  const reminderRelevant =
    item.task_type === "form" ||
    item.task_type === "reminder" ||
    item.task_type === "reflection" ||
    title.includes("check-in") ||
    title.includes("document") ||
    title.includes("collect");
  if (clientOwned && reminderRelevant && (item.status === "overdue" || isPastDue(item))) {
    return "Send reminder";
  }
  if (title.includes("document") || title.includes("collect")) return "Request";
  if (clientOwned && reminderRelevant) return "Send reminder";
  return "Open";
}

// ---------------------------------------------------------------------------
// Practice-wide paperwork — the agreements a client signs once, on joining,
// rather than work belonging to any single session. They're tagged
// session_types: ["intake_assessment"] so the client portal surfaces them at
// the right moment, but that also made the practitioner's Intake view show
// the entire paperwork stack instead of the intake's own form. Phase views
// filter these out; the "All Paperwork" pill on the client timeline is where
// the practitioner sees them all together.
// ---------------------------------------------------------------------------
export const GENERAL_PAPERWORK_DOCUMENT_TYPES: DocumentType[] = [...AGREEMENT_DOCUMENT_TYPES];

export function isGeneralPaperwork(documentType: DocumentType): boolean {
  return isAgreementDocumentType(documentType);
}

// ---------------------------------------------------------------------------
// Does this record still occupy a slot on a calendar?
//
// A cancelled session or call is a *history* record, not a booking: it must
// never render as a block on the month grid and must never exist as an event
// on Google Calendar. It stays visible in per-client history lists (Sessions
// tab, activity timeline) where the cancellation itself is the information.
//
// This is the single source of truth for that rule so every scheduling
// surface agrees — the app calendar grid, the upcoming lists, and the Google
// Calendar push in lib/googleCalendarSync.ts. Sessions, ProspectCalls and
// mirrored external events all share the "cancelled" status value, so one
// predicate covers all three.
//
// A session with no scheduled_at has nowhere to render either, hence the
// second overload used by the Google push.
// ---------------------------------------------------------------------------
export function occupiesCalendarSlot<
  T extends { status: "scheduled" | "completed" | "cancelled" | "no_show"; scheduled_at?: string },
>(record: T): record is T & { scheduled_at: string } {
  if (record.status === "cancelled") return false;
  return Boolean(record.scheduled_at);
}
