"use client";

import { useMemo, useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addSessionAction,
  cancelSessionAction,
  completeSessionAction,
  reopenCompletedSessionAction,
  updateSessionAction,
  checkScheduleConflictsAction,
  ScheduleConflict,
} from "@/lib/actions";
import { Session, SessionType, ProspectCall, ExternalCalendarEvent } from "@/lib/types";
import { clientAvatarSrc, cx, formatDateTime, initials, occupiesCalendarSlot } from "@/lib/utils";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  CalendarDays,
  Clock,
  MapPin,
  ExternalLink,
  Pencil,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  AlertTriangle,
  History,
  RotateCcw,
  Copy,
  MoreHorizontal,
} from "lucide-react";
type SessionWithClient = Session & { client_name: string };
type ClientOption = { id: string; full_name: string };

const SESSION_TYPE_OPTIONS: { value: SessionType; label: string }[] = [
  { value: "intake_assessment", label: "Intake Assessment" },
  { value: "preparation", label: "Preparation" },
  { value: "harm_reduction_support", label: "Journey Day (Harm Reduction Support)" },
  { value: "check_in_12hr", label: "12-Hour Check-In" },
  { value: "integration_1", label: "Integration Session 1" },
  { value: "integration_2", label: "Integration Session 2" },
  { value: "other", label: "Other" },
];

function typeLabel(t: SessionType) {
  return SESSION_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;
}

const CALL_TYPE_LABELS: Record<ProspectCall["call_type"], string> = {
  intro_call: "Intro Call",
  follow_up: "Follow-up",
  hold_follow_up: "On-hold follow-up",
};

/**
 * Hold reminders can hang off either a client or a prospect (see ProspectCall
 * in types.ts), so route to whichever record actually owns this call.
 */
function prospectCallHref(c: ProspectCall): string {
  return c.client_id ? `/clients/${c.client_id}` : `/prospects/${c.prospect_id}`;
}

function statusBadgeClass(status: Session["status"]) {
  if (status === "completed") return "bg-sage-100 text-sage-700";
  if (status === "scheduled") return "bg-clay-100 text-clay-700";
  return "bg-ink-100 text-ink-500";
}

// Always use local calendar date, not UTC — a session at 11pm MST is still
// that same local day, and "today" should highlight the local date not UTC.
function dateKey(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function localDateKey(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfMonthGrid(monthDate: Date) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startWeekday = first.getDay();
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startWeekday);
  return gridStart;
}

export default function CalendarView({
  sessions,
  clients,
  prospectCalls = [],
  externalEvents = [],
}: {
  sessions: SessionWithClient[];
  clients: ClientOption[];
  prospectCalls?: ProspectCall[];
  externalEvents?: ExternalCalendarEvent[];
}) {
  const router = useRouter();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Detail panel — shown when clicking a session chip or row
  const [selected, setSelected] = useState<SessionWithClient | null>(null);

  // Create/edit form
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SessionWithClient | null>(null);
  const [duplicateOf, setDuplicateOf] = useState<SessionWithClient | null>(null);
  const [prefillDate, setPrefillDate] = useState<string | undefined>(undefined);
  const [completionUndo, setCompletionUndo] = useState<{ id: string; clientId: string } | null>(null);

  const [, startTransition] = useTransition();

  // Local copy so Cancel/Complete updates reflect without full reload
  const [localSessions, setLocalSessions] = useState<SessionWithClient[]>(sessions);

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, SessionWithClient[]>();
    for (const s of localSessions) {
      // A cancelled session no longer holds this slot — it must not render
      // as a block on the grid, exactly like a cancelled prospect call
      // below. It stays in the Past list and the client's Sessions tab,
      // where the cancellation is the point.
      if (!occupiesCalendarSlot(s)) continue;
      const key = dateKey(s.scheduled_at);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [localSessions]);

  const prospectCallsByDay = useMemo(() => {
    const map = new Map<string, ProspectCall[]>();
    for (const c of prospectCalls) {
      if (!occupiesCalendarSlot(c)) continue;
      const key = dateKey(c.scheduled_at);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [prospectCalls]);

  const externalEventsByDay = useMemo(() => {
    const map = new Map<string, ExternalCalendarEvent[]>();
    for (const e of externalEvents) {
      const key = dateKey(e.start_at);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [externalEvents]);

  const gridDays = useMemo(() => {
    const start = startOfMonthGrid(month);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [month]);

  const today = new Date();
  const todayKey = localDateKey(today);

  const upcoming = localSessions
    // A scheduled appointment stays actionable until it is explicitly
    // completed or cancelled. Using only the clock here incorrectly buried
    // still-scheduled sessions in Past Sessions after their date passed.
    .filter((s) => s.status === "scheduled" && s.scheduled_at)
    .sort((a, b) => (a.scheduled_at! < b.scheduled_at! ? -1 : 1));
  const past = localSessions
    .filter((s) => s.status !== "scheduled" || !s.scheduled_at)
    .sort((a, b) => ((a.scheduled_at ?? "") > (b.scheduled_at ?? "") ? -1 : 1));

  function openDetail(s: SessionWithClient) {
    setSelected(s);
    setFormOpen(false);
  }

  function openCreate(dateForDay?: string) {
    setSelected(null);
    setEditing(null);
    setDuplicateOf(null);
    setPrefillDate(dateForDay);
    setFormOpen(true);
  }

  function openEdit(s: SessionWithClient) {
    setSelected(null);
    setEditing(s);
    setDuplicateOf(null);
    setPrefillDate(undefined);
    setFormOpen(true);
  }

  function openDuplicate(s: SessionWithClient) {
    setSelected(null);
    setEditing(null);
    setDuplicateOf(s);
    setPrefillDate(undefined);
    setFormOpen(true);
  }

  function closeAll() {
    setSelected(null);
    setFormOpen(false);
    setEditing(null);
    setDuplicateOf(null);
  }

  function applyStatusChange(id: string, status: Session["status"]) {
    setLocalSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s))
    );
    if (selected?.id === id) setSelected((s) => s ? { ...s, status } : s);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            className="p-1.5 rounded-lg hover:bg-ink-50 text-ink-500"
            onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-lg font-semibold text-ink-900 min-w-[160px] text-center">
            {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h2>
          <button
            className="p-1.5 rounded-lg hover:bg-ink-50 text-ink-500"
            onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            className="btn-ghost text-xs px-2.5 py-1.5 ml-1"
            onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
          >
            Today
          </button>
        </div>
        <button className="btn-primary text-sm flex items-center gap-1.5" onClick={() => openCreate()}>
          <Plus className="h-4 w-4" /> Schedule Session
        </button>
      </div>

      {/* Calendar grid */}
      <div className="card p-4">
        <div className="grid grid-cols-7 text-center text-xs font-medium text-ink-400 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {gridDays.map((d, i) => {
            const key = localDateKey(d);
            const inMonth = d.getMonth() === month.getMonth();
            const daySessions = sessionsByDay.get(key) ?? [];
            const dayProspectCalls = prospectCallsByDay.get(key) ?? [];
            const dayExternalEvents = externalEventsByDay.get(key) ?? [];
            const totalItems = daySessions.length + dayProspectCalls.length + dayExternalEvents.length;
            return (
              <div
                key={i}
                onClick={() => openCreate(key)}
                className={cx(
                  "min-h-[92px] rounded-lg border p-1.5 group relative cursor-pointer",
                  inMonth ? "border-ink-100 bg-white hover:bg-ink-50/50" : "border-ink-50 bg-ink-50/40",
                  key === todayKey && "ring-2 ring-clay-400"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cx("text-xs", inMonth ? "text-ink-700" : "text-ink-300")}>
                    {d.getDate()}
                  </span>
                  <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-clay-400" />
                </div>
                <div className="space-y-0.5 mt-1">
                  {daySessions.slice(0, 2).map((s) => (
                    <button
                      key={s.id}
                      onClick={(e) => { e.stopPropagation(); openDetail(s); }}
                      className={cx(
                        "flex w-full items-center gap-1 text-left text-xs leading-tight px-1.5 py-0.5 rounded",
                        statusBadgeClass(s.status),
                        selected?.id === s.id && "ring-1 ring-offset-0 ring-clay-400"
                      )}
                      title={`${s.client_name} — ${typeLabel(s.session_type)}`}
                    >
                      <ClientAvatar clientName={s.client_name} compact />
                      <span className="truncate">{s.client_name}</span>
                    </button>
                  ))}
                  {dayProspectCalls.slice(0, 1).map((c) => (
                    <a
                      key={c.id}
                      href={prospectCallHref(c)}
                      onClick={(e) => e.stopPropagation()}
                      className={cx(
                        "w-full block text-left text-xs leading-tight px-1.5 py-0.5 rounded truncate",
                        c.call_type === "hold_follow_up"
                          ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                          : "bg-plum-100 text-plum-700 hover:bg-plum-200"
                      )}
                      title={`${c.prospect_name} — ${CALL_TYPE_LABELS[c.call_type]}`}
                    >
                      ◆ {c.prospect_name}
                    </a>
                  ))}
                  {daySessions.length + dayProspectCalls.length < 3 &&
                    dayExternalEvents.slice(0, 3 - daySessions.length - dayProspectCalls.length).map((e) => (
                      <div
                        key={e.id}
                        onClick={(ev) => ev.stopPropagation()}
                        className="w-full block text-left text-xs leading-tight px-1.5 py-0.5 rounded truncate bg-ink-100 text-ink-500"
                        title={`${e.title} (Google Calendar) — ${formatDateTime(e.start_at)}`}
                      >
                        ● {e.title}
                      </div>
                    ))}
                  {totalItems > 3 && (
                    <div className="text-xs text-ink-400 px-1">+{totalItems - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Session detail modal */}
      {selected && (
        <Modal onClose={closeAll} overflowVisible>
          <SessionDetailPanel
            session={selected}
            onClose={closeAll}
            onEdit={() => openEdit(selected)}
            onDuplicate={() => openDuplicate(selected)}
            onGoToClient={() => router.push(`/clients/${selected.client_id}?tab=Sessions`)}
            onCancel={() =>
              startTransition(async () => {
                await cancelSessionAction(selected.id, selected.client_id);
                applyStatusChange(selected.id, "cancelled");
              })
            }
            onComplete={() =>
              completeSessionAction(selected.id, selected.client_id).then(() => {
                applyStatusChange(selected.id, "completed");
                setCompletionUndo({ id: selected.id, clientId: selected.client_id });
              })
            }
            onUndoComplete={() =>
              reopenCompletedSessionAction(selected.id, selected.client_id).then(() => {
                applyStatusChange(selected.id, "scheduled");
              })
            }
          />
        </Modal>
      )}

      {/* Schedule / edit modal */}
      {formOpen && (
        <Modal onClose={closeAll}>
          <SessionForm
            clients={clients}
            editing={editing}
            duplicateOf={duplicateOf}
            prefillDate={prefillDate}
            onSessionCreated={(created) => {
              const client = clients.find((item) => item.id === created.client_id);
              setLocalSessions((current) => [...current, { ...created, client_name: client?.full_name ?? "Client" }]);
            }}
            onClose={closeAll}
          />
        </Modal>
      )}

      {completionUndo && (
        <div className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-700 shadow-lg" role="status">
          <span>Session marked complete</span>
          <button
            className="font-semibold text-clay-600 hover:text-clay-700 hover:underline"
            onClick={() => {
              const undo = completionUndo;
              startTransition(async () => {
                await reopenCompletedSessionAction(undo.id, undo.clientId);
                applyStatusChange(undo.id, "scheduled");
                setCompletionUndo(null);
              });
            }}
          >
            Undo
          </button>
          <button aria-label="Dismiss completion message" className="text-ink-400 hover:text-ink-700" onClick={() => setCompletionUndo(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Upcoming / Past lists */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-semibold text-ink-900 mb-3 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-clay-500" /> Upcoming Sessions
          </h3>
          <div className="space-y-2">
            {upcoming.length === 0 && <p className="text-sm text-ink-400">Nothing scheduled.</p>}
            {upcoming.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                isSelected={selected?.id === s.id}
                onSelect={() => openDetail(s)}
                startTransition={startTransition}
                onStatusChange={applyStatusChange}
              />
            ))}
          </div>
          {/* Prospect calls */}
          {prospectCalls.filter((c) => c.status === "scheduled" && new Date(c.scheduled_at) >= today).length > 0 && (
            <div className="mt-4 pt-4 border-t border-ink-100">
              <p className="text-xs font-medium text-plum-600 mb-2">Prospect Calls</p>
              <div className="space-y-2">
                {prospectCalls
                  .filter((c) => c.status === "scheduled" && new Date(c.scheduled_at) >= today)
                  .sort((a, b) => (a.scheduled_at < b.scheduled_at ? -1 : 1))
                  .map((c) => {
                    const isHold = c.call_type === "hold_follow_up";
                    return (
                      <a
                        key={c.id}
                        href={prospectCallHref(c)}
                        className={cx(
                          "flex items-center justify-between py-2 px-3 rounded-lg transition-colors",
                          isHold ? "bg-amber-50 hover:bg-amber-100" : "bg-plum-50 hover:bg-plum-100"
                        )}
                      >
                        <div>
                          <span className={cx("text-sm font-medium", isHold ? "text-amber-900" : "text-plum-800")}>
                            {c.prospect_name}
                          </span>
                          <span className={cx("text-xs ml-2", isHold ? "text-amber-600" : "text-plum-500")}>
                            {CALL_TYPE_LABELS[c.call_type]}
                          </span>
                        </div>
                        <span className={cx("text-xs", isHold ? "text-amber-600" : "text-plum-500")}>
                          {formatDateTime(c.scheduled_at)}
                        </span>
                      </a>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-ink-900 mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-ink-400" /> Past Sessions
          </h3>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {past.length === 0 && <p className="text-sm text-ink-400">No past sessions yet.</p>}
            {past.slice(0, 30).map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                isSelected={selected?.id === s.id}
                onSelect={() => openDetail(s)}
                startTransition={startTransition}
                onStatusChange={applyStatusChange}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal overlay — dims page, centers content, closes on Cancel/X or Esc.
// Deliberately does NOT close on backdrop click: native <input type="date">
// / <input type="time"> pickers can dispatch a stray click on the page once
// dismissed (e.g. after picking a value from the time dropdown), which used
// to land on this backdrop and close the whole modal before the user could
// submit.
// ---------------------------------------------------------------------------
function Modal({ children, onClose, overflowVisible = false }: { children: React.ReactNode; onClose: () => void; overflowVisible?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
    >
      <div
        ref={ref}
        className={cx("w-full max-w-md bg-white rounded-2xl shadow-2xl", overflowVisible ? "overflow-visible" : "overflow-hidden")}
      >
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session detail panel — shown below calendar when a session is selected
// ---------------------------------------------------------------------------
function SessionDetailPanel({
  session,
  onClose,
  onEdit,
  onDuplicate,
  onGoToClient,
  onCancel,
  onComplete,
  onUndoComplete,
}: {
  session: SessionWithClient;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onGoToClient: () => void;
  onCancel: () => void;
  onComplete: () => void | Promise<void>;
  onUndoComplete: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState<"cancel" | "complete" | "undo" | null>(null);
  const [managementMenuOpen, setManagementMenuOpen] = useState(false);
  const isScheduled = session.status === "scheduled";

  async function handleCancel() {
    setBusy("cancel");
    await onCancel();
    setBusy(null);
  }

  async function handleComplete() {
    setBusy("complete");
    await onComplete();
    setBusy(null);
  }

  async function handleUndoComplete() {
    setBusy("undo");
    await onUndoComplete();
    setBusy(null);
  }

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-ink-700">Session Details</span>
        <div className="flex items-center gap-1">
          {isScheduled && (
            <div className="relative">
              <button
                aria-label="Session management actions"
                title="Session actions"
                onClick={() => setManagementMenuOpen((open) => !open)}
                className="btn-ghost inline-grid min-h-8 min-w-8 place-items-center text-ink-400 hover:bg-ink-50 hover:text-ink-600"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {managementMenuOpen && (
                <div className="absolute right-0 top-full z-10 mt-1 w-52 rounded-lg border border-ink-100 bg-white p-1 shadow-lg">
                  <button onClick={onEdit} className="flex w-full items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-2 text-left text-sm text-ink-700 hover:bg-ink-50">
                    <Pencil className="h-3.5 w-3.5" />
                    Edit Session
                  </button>
                  <button onClick={onDuplicate} className="flex w-full items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-2 text-left text-sm text-ink-700 hover:bg-ink-50">
                    <Copy className="h-3.5 w-3.5" />
                    Duplicate Event
                  </button>
                  <button disabled={busy === "complete"} onClick={handleComplete} className="flex w-full items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-2 text-left text-sm text-ink-700 hover:bg-ink-50">
                    {busy === "complete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Mark Complete
                  </button>
                  <div className="my-1 border-t border-ink-100" />
                  <button disabled={busy === "cancel"} onClick={handleCancel} className="flex w-full items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-2 text-left text-sm text-red-600/80 hover:bg-red-50 hover:text-red-600">
                    {busy === "cancel" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                    Cancel Session
                  </button>
                </div>
              )}
            </div>
          )}
          <button onClick={onClose} className="p-1 rounded hover:bg-ink-50 text-ink-400">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {/* Session info */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-sm font-semibold text-ink-900">{typeLabel(session.session_type)}</span>
            <span className={cx("badge", statusBadgeClass(session.status))}>{session.status.charAt(0).toUpperCase() + session.status.slice(1)}</span>
          </div>

          <div className="space-y-1 text-sm text-ink-600">
            {/* Client name — clickable link to their chart */}
            <div className="flex items-center gap-2">
              <ClientAvatar clientName={session.client_name} compact />
              <Link
                href={`/clients/${session.client_id}?tab=Sessions`}
                className="font-medium text-ink-800 hover:text-clay-600 hover:underline"
              >
                {session.client_name}
              </Link>
            </div>

            {session.scheduled_at && (
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-ink-400 shrink-0" />
                <span>{formatDateTime(session.scheduled_at)}</span>
                {session.duration_minutes && (
                  <span className="text-ink-400">· {session.duration_minutes} min</span>
                )}
              </div>
            )}

            {session.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-ink-400 shrink-0" />
                <span>{session.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className={cx(
          "flex gap-1.5",
          session.status === "completed" ? "flex-row items-center" : "flex-col"
        )}>
          {session.status === "completed" && (
            <button
              disabled={busy === "undo"}
              onClick={handleUndoComplete}
              className="btn-secondary flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 px-3 text-xs"
            >
              {busy === "undo" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              Undo complete
            </button>
          )}

          {session.status !== "scheduled" && (
            <button
              onClick={onGoToClient}
              className={cx(
                "btn-primary flex min-h-11 items-center gap-2 px-3 text-xs",
                session.status === "completed" && "min-w-0 flex-1 justify-center"
              )}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open Client Record
            </button>
          )}

          {isScheduled && (
            <>
              <div className="flex gap-2">
                <button onClick={onGoToClient} className="btn-primary flex min-h-11 flex-1 items-center justify-center gap-2 px-3 text-xs">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Client Record
                </button>
                <Link href={`/clients/${session.client_id}/sessions/${session.id}`} className="btn-secondary flex min-h-11 flex-1 items-center justify-center gap-2 px-3 text-xs">
                  <Sparkles className="h-3.5 w-3.5 text-plum-500" />
                  Prepare Me
                </Link>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session row in Upcoming / Past lists
// ---------------------------------------------------------------------------
function SessionRow({
  session,
  isSelected,
  onSelect,
  startTransition,
  onStatusChange,
}: {
  session: SessionWithClient;
  isSelected: boolean;
  onSelect: () => void;
  startTransition: (fn: () => void | Promise<void>) => void;
  onStatusChange: (id: string, status: Session["status"]) => void;
}) {
  return (
    <div
      className={cx(
        "flex items-center justify-between gap-3 py-2 border-b border-ink-100 last:border-0 text-sm",
        isSelected && "bg-clay-50/60 -mx-2 px-2 rounded-lg"
      )}
    >
      <button onClick={onSelect} className="text-left min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <ClientAvatar clientName={session.client_name} />
          {/* Client name — clicking row opens detail panel; name is also a direct link */}
          <Link
            href={`/clients/${session.client_id}?tab=Sessions`}
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-ink-900 hover:text-clay-600 truncate"
          >
            {session.client_name}
          </Link>
          <span className={cx("badge shrink-0", statusBadgeClass(session.status))}>{session.status}</span>
        </div>
        <div className="text-xs text-ink-500 truncate">
          {typeLabel(session.session_type)} · {formatDateTime(session.scheduled_at)}
          {session.location ? ` · ${session.location}` : ""}
        </div>
      </button>

      {session.status === "scheduled" && (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            className="btn-ghost text-xs px-2 py-1"
            onClick={() =>
              startTransition(async () => {
                await completeSessionAction(session.id, session.client_id);
                onStatusChange(session.id, "completed");
              })
            }
          >
            Complete
          </button>
          <button
            className="btn-ghost text-xs px-2 py-1 text-clay-600"
            onClick={() =>
              startTransition(async () => {
                await cancelSessionAction(session.id, session.client_id);
                onStatusChange(session.id, "cancelled");
              })
            }
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function ClientAvatar({ clientName, compact = false }: { clientName: string; compact?: boolean }) {
  const src = clientAvatarSrc(clientName);
  const size = compact ? 16 : 28;

  return src ? (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className={cx("shrink-0 rounded-full object-cover", compact ? "h-4 w-4" : "h-7 w-7")}
    />
  ) : (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500 font-semibold",
        compact ? "h-4 w-4 text-xs" : "h-7 w-7 text-xs"
      )}
      aria-hidden="true"
    >
      {initials(clientName)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Create / edit form
// ---------------------------------------------------------------------------
function SessionForm({
  clients,
  editing,
  duplicateOf,
  prefillDate,
  onSessionCreated,
  onClose,
}: {
  clients: ClientOption[];
  editing: SessionWithClient | null;
  duplicateOf: SessionWithClient | null;
  prefillDate?: string;
  onSessionCreated?: (session: Session) => void;
  onClose: () => void;
}) {
  const sourceSession = editing ?? duplicateOf;
  const isDuplicate = Boolean(duplicateOf);
  const existingDate = sourceSession?.scheduled_at ? new Date(sourceSession.scheduled_at) : undefined;
  const [clientId, setClientId] = useState(sourceSession?.client_id ?? clients[0]?.id ?? "");
  const [sessionType, setSessionType] = useState<SessionType>(sourceSession?.session_type ?? "preparation");
  const [date, setDate] = useState(
    existingDate
      ? existingDate.toISOString().slice(0, 10)
      : prefillDate ?? new Date().toISOString().slice(0, 10)
  );
  const [time, setTime] = useState(existingDate ? existingDate.toTimeString().slice(0, 5) : "10:00");
  const [duration, setDuration] = useState(sourceSession?.duration_minutes ?? 60);
  const [location, setLocation] = useState(sourceSession?.location ?? "");
  const [busy, setBusy] = useState(false);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [conflicts, setConflicts] = useState<ScheduleConflict[] | null>(null);
  const [conflictsAcknowledged, setConflictsAcknowledged] = useState(false);

  function resetConflictState() {
    setConflictsAcknowledged(false);
    setConflicts(null);
  }

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-ink-900">{editing ? "Edit Session" : isDuplicate ? "Duplicate Event" : "Schedule Session"}</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-ink-50 text-ink-400">
          <X className="h-4 w-4" />
        </button>
      </div>

      {editing && (
        <div className="mb-3 pb-3 border-b border-ink-100 flex items-center justify-between">
          <span className="text-sm text-ink-500">
            Editing session for{" "}
            <Link
              href={`/clients/${editing.client_id}?tab=Sessions`}
              className="font-medium text-clay-600 hover:underline"
            >
              {editing.client_name}
            </Link>
          </span>
        </div>
      )}

      {isDuplicate && duplicateOf && (
        <div className="mb-3 grid grid-cols-2 gap-3 rounded-lg bg-ink-50 p-3 text-sm">
          <div><span className="block text-xs text-ink-500">Client</span><span className="font-medium text-ink-800">{duplicateOf.client_name}</span></div>
          <div><span className="block text-xs text-ink-500">Session type</span><span className="font-medium text-ink-800">{typeLabel(duplicateOf.session_type)}</span></div>
        </div>
      )}

      <form
        className="grid sm:grid-cols-2 gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!clientId) return;
          const scheduledAt = new Date(`${date}T${time}:00`).toISOString();

          if (!conflictsAcknowledged) {
            setCheckingConflicts(true);
            const found = await checkScheduleConflictsAction(scheduledAt, duration, editing?.id);
            setCheckingConflicts(false);
            if (found.length > 0) {
              setConflicts(found);
              return;
            }
          }

          setBusy(true);
          if (editing) {
            await updateSessionAction(editing.id, editing.client_id, {
              sessionType,
              scheduledAt,
              durationMinutes: duration,
              location: location || undefined,
            });
          } else {
            const created = await addSessionAction({
              clientId,
              sessionType,
              scheduledAt,
              durationMinutes: duration,
              location: location || undefined,
            });
            if (created) onSessionCreated?.(created);
          }
          setBusy(false);
          onClose();
        }}
      >
        {!editing && !isDuplicate && (
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-ink-600">Client</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="mt-1 w-full border border-ink-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-ink-600">Session Type</label>
          <select
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value as SessionType)}
            className="mt-1 w-full border border-ink-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
          >
            {SESSION_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-ink-600">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => { setDate(e.target.value); resetConflictState(); }}
            required
            className="mt-1 w-full border border-ink-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-600">Time</label>
          <input
            type="time"
            value={time}
            onChange={(e) => { setTime(e.target.value); resetConflictState(); }}
            required
            className="mt-1 w-full border border-ink-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-600">Duration (minutes)</label>
          <input
            type="number"
            min={15}
            step={15}
            value={duration}
            onChange={(e) => { setDuration(Number(e.target.value)); resetConflictState(); }}
            className="mt-1 w-full border border-ink-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-600">Location (optional)</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Journey Space — Sunroom"
            className="mt-1 w-full border border-ink-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
          />
        </div>
        {conflicts && conflicts.length > 0 && (
          <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <p className="font-medium mb-1">This time overlaps with:</p>
                <ul className="space-y-0.5">
                  {conflicts.map((c, i) => (
                    <li key={i}>{c.title} — {formatDateTime(c.start_at)}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={() => { setConflictsAcknowledged(true); setConflicts(null); }}
                className="text-xs font-medium text-amber-800 hover:text-amber-900 underline"
              >
                Schedule anyway
              </button>
            </div>
          </div>
        )}

        <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost text-sm px-3 py-1.5">
            Cancel
          </button>
          <button type="submit" disabled={busy || checkingConflicts || !clientId} className="btn-primary text-sm px-4 py-1.5">
            {checkingConflicts ? "Checking…" : busy ? "Saving..." : editing ? "Save Changes" : isDuplicate ? "Duplicate Session" : "Schedule"}
          </button>
        </div>
      </form>
    </div>
  );
}
