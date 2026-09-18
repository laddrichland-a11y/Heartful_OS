import { ClientStatus, DocumentType, JourneyPhase } from "@/lib/types";
import type { StaticImageData } from "next/image";
import mayaChenAvatar from "../../public/images/clients/maya-chen.webp";
import danielOrtizAvatar from "../../public/images/clients/daniel-ortiz.webp";
import priyaPatelAvatar from "../../public/images/clients/priya-patel.webp";
import marcusWebbAvatar from "../../public/images/clients/marcus-webb.webp";
import sarahKleinAvatar from "../../public/images/clients/sarah-klein.webp";

export function cx(...args: (string | false | null | undefined)[]) {
  return args.filter(Boolean).join(" ");
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

export function clientAvatarSrc(clientName: string): StaticImageData | undefined {
  const avatarByName: Record<string, StaticImageData> = {
    "Maya Chen": mayaChenAvatar,
    "Daniel Ortiz": danielOrtizAvatar,
    "Priya Patel": priyaPatelAvatar,
    "Marcus Webb": marcusWebbAvatar,
    "Sarah Klein": sarahKleinAvatar,
  };

  return avatarByName[clientName];
}

export function statusBadgeClasses(status: ClientStatus): string {
  if (status === "journey_closed") return "bg-sage-100 text-sage-800";
  if (status === "inactive") return "bg-ink-100 text-ink-600";
  if (status.startsWith("integration")) return "bg-plum-100 text-plum-700";
  if (status === "journey_complete" || status === "check_in_complete") return "bg-sage-100 text-sage-700";
  if (status === "preparation" || status === "preparation_complete") return "client-status--preparation";
  return "bg-ink-100 text-ink-600";
}

export function phaseLabel(phase: JourneyPhase): string {
  const map: Record<JourneyPhase, string> = {
    intake: "Intake",
    preparation: "Preparation",
    harm_reduction_session: "Journey Day",
    post_journey_check_in: "Post-Journey Check-In",
    integration_1: "Integration Session 1",
    integration_2: "Integration Session 2",
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
  preparation_complete: "preparation",
  journey_scheduled: "preparation",
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
}

export function isPastDue(item: Pick<ActionableOutstandingItem, "due_at">) {
  return Boolean(item.due_at && new Date(item.due_at).getTime() < Date.now());
}

export function outstandingItemHref(item: ActionableOutstandingItem) {
  return item.kind === "form"
    ? `/clients/${item.client_id}/forms/${item.id}`
    : `/clients/${item.client_id}/tasks/${item.id}`;
}

export function outstandingActionLabel(item: ActionableOutstandingItem) {
  if (item.kind === "form") return item.status === "in_progress" ? "Review" : "Request";

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
export const GENERAL_PAPERWORK_DOCUMENT_TYPES: DocumentType[] = [
  "informed_consent",
  "harm_reduction_services_agreement",
  "client_services_agreement",
];

export function isGeneralPaperwork(documentType: DocumentType): boolean {
  return GENERAL_PAPERWORK_DOCUMENT_TYPES.includes(documentType);
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
