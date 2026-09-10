"use client";

import { useMemo, useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addSessionAction,
  cancelSessionAction,
  completeSessionAction,
  updateSessionAction,
  checkScheduleConflictsAction,
  ScheduleConflict,
} from "@/lib/actions";
import { Session, SessionType, ProspectCall, ExternalCalendarEvent } from "@/lib/types";
import { cx, formatDateTime, occupiesCalendarSlot } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  CalendarDays,
  User,
  Clock,
  MapPin,
  ExternalLink,
  Pencil,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  AlertTriangle,
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
  const [prefillDate, setPrefillDate] = useState<string | undefined>(undefined);

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
    .filter((s) => s.status === "scheduled" && s.scheduled_at && new Date(s.scheduled_at) >= today)
    .sort((a, b) => (a.scheduled_at! < b.scheduled_at! ? -1 : 1));
  const past = localSessions
    .filter((s) => !(s.status === "scheduled" && s.scheduled_at && new Date(s.scheduled_at) >= today))
    .sort((a, b) => ((a.scheduled_at ?? "") > (b.scheduled_at ?? "") ? -1 : 1));

  function openDetail(s: SessionWithClient) {
    setSelected(s);
    setFormOpen(false);
  }

  function openCreate(dateForDay?: string) {
    setSelected(null);
    setEditing(null);
    setPrefillDate(dateForDay);
    setFormOpen(true);
  }

  function openEdit(s: SessionWithClient) {
    setSelected(null);
    setEditing(s);
    setPrefillDate(undefined);
    setFormOpen(true);
  }

  function closeAll() {
    setSelected(null);
    setFormOpen(false);
    setEditing(null);
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
                        "w-full text-left text-[10px] leading-tight px-1.5 py-0.5 rounded truncate",
                        statusBadgeClass(s.status),
                        selected?.id === s.id && "ring-1 ring-offset-0 ring-clay-400"
                      )}
                      title={`${s.client_name} — ${typeLabel(s.session_type)}`}
                    >
                      {s.client_name}
                    </button>
                  ))}
                  {dayProspectCalls.slice(0, 1).map((c) => (
                    <a
                      key={c.id}
                      href={prospectCallHref(c)}
                      onClick={(e) => e.stopPropagation()}
                      className={cx(
                        "w-full block text-left text-[10px] leading-tight px-1.5 py-0.5 rounded truncate",
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
                        className="w-full block text-left text-[10px] leading-tight px-1.5 py-0.5 rounded truncate bg-ink-100 text-ink-500"
                        title={`${e.title} (Google Calendar) — ${formatDateTime(e.start_at)}`}
                      >
                        ● {e.title}
                      </div>
                    ))}
                  {totalItems > 3 && (
                    <div className="text-[10px] text-ink-400 px-1">+{totalItems - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Session detail modal */}
      {selected && (
        <Modal onClose={closeAll}>
          <SessionDetailPanel
            session={selected}
            onClose={closeAll}
            onEdit={() => openEdit(selected)}
            onGoToClient={() => router.push(`/clients/${selected.client_id}?tab=Sessions`)}
            onCancel={() =>
              startTransition(async () => {
                await cancelSessionAction(selected.id, selected.client_id);
                applyStatusChange(selected.id, "cancelled");
              })
            }
            onComplete={() =>
              startTransition(async () => {
                await completeSessionAction(selected.id, selected.client_id);
                applyStatusChange(selected.id, "completed");
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
            prefillDate={prefillDate}
            onClose={closeAll}
          />
        </Modal>
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
          <h3 className="font-semibold text-ink-900 mb-3">Past Sessions</h3>
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
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
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
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
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
  onGoToClient,
  onCancel,
  onComplete,
}: {
  session: SessionWithClient;
  onClose: () => void;
  onEdit: () => void;
  onGoToClient: () => void;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const [busy, setBusy] = useState<"cancel" | "complete" | null>(null);
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

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-ink-700">Session Details</span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-ink-50 text-ink-400"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {/* Session info */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cx("badge", statusBadgeClass(session.status))}>{session.status}</span>
            <span className="text-sm font-semibold text-ink-900">{typeLabel(session.session_type)}</span>
          </div>

          <div className="space-y-1 text-sm text-ink-600">
            {/* Client name — clickable link to their chart */}
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-ink-400 shrink-0" />
              <Link
                href={`/clients/${session.client_id}?tab=Sessions`}
                className="font-medium text-clay-600 hover:text-clay-700 hover:underline"
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
        <div className="flex flex-col gap-2">
          <button
            onClick={onGoToClient}
            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Client Record
          </button>

          {isScheduled && (
            <Link
              href={`/clients/${session.client_id}/sessions/${session.id}`}
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-plum-500" />
              Prepare Me
            </Link>
          )}

          {isScheduled && (
            <>
              <button
                onClick={onEdit}
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Session
              </button>

              <button
                disabled={busy === "complete"}
                onClick={handleComplete}
                className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 text-sage-700 hover:bg-sage-50"
              >
                {busy === "complete" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Mark Complete
              </button>

              <button
                disabled={busy === "cancel"}
                onClick={handleCancel}
                className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 text-red-600 hover:bg-red-50"
              >
                {busy === "cancel" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                Cancel Session
              </button>
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

// ---------------------------------------------------------------------------
// Create / edit form
// ---------------------------------------------------------------------------
function SessionForm({
  clients,
  editing,
  prefillDate,
  onClose,
}: {
  clients: ClientOption[];
  editing: SessionWithClient | null;
  prefillDate?: string;
  onClose: () => void;
}) {
  const existingDate = editing?.scheduled_at ? new Date(editing.scheduled_at) : undefined;
  const [clientId, setClientId] = useState(editing?.client_id ?? clients[0]?.id ?? "");
  const [sessionType, setSessionType] = useState<SessionType>(editing?.session_type ?? "preparation");
  const [date, setDate] = useState(
    existingDate
      ? existingDate.toISOString().slice(0, 10)
      : prefillDate ?? new Date().toISOString().slice(0, 10)
  );
  const [time, setTime] = useState(existingDate ? existingDate.toTimeString().slice(0, 5) : "10:00");
  const [duration, setDuration] = useState(editing?.duration_minutes ?? 60);
  const [location, setLocation] = useState(editing?.location ?? "");
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
        <h3 className="font-semibold text-ink-900">{editing ? "Edit Session" : "Schedule Session"}</h3>
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
            await addSessionAction({
              clientId,
              sessionType,
              scheduledAt,
              durationMinutes: duration,
              location: location || undefined,
            });
          }
          setBusy(false);
          onClose();
        }}
      >
        {!editing && (
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
            {checkingConflicts ? "Checking…" : busy ? "Saving..." : editing ? "Save Changes" : "Schedule"}
          </button>
        </div>
      </form>
    </div>
  );
}
