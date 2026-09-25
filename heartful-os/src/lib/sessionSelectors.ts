import type { Session, SessionType } from "@/lib/types";

type SessionSelectionInput = Pick<
  Session,
  | "id"
  | "status"
  | "scheduled_at"
  | "duration_minutes"
  | "session_type"
  | "journey_started_at"
  | "journey_ended_at"
>;

type SelectionOptions = {
  sessionType?: SessionType;
};

const DEFAULT_SESSION_DURATION_MINUTES = 60;

function timestamp(value?: string | number | Date): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (!value) return Number.NaN;
  return Date.parse(value);
}

function matchesType(session: SessionSelectionInput, options?: SelectionOptions) {
  return !options?.sessionType || session.session_type === options.sessionType;
}

function scheduledStart(session: SessionSelectionInput) {
  return timestamp(session.scheduled_at);
}

function chronological(a: SessionSelectionInput, b: SessionSelectionInput) {
  return scheduledStart(a) - scheduledStart(b) || a.id.localeCompare(b.id);
}

/** A scheduled session is active while its appointment window is open. */
export function isSessionActive(session: SessionSelectionInput, now: string | number | Date = Date.now()) {
  if (session.status !== "scheduled") return false;

  // Journey Day has an explicit live state that is more reliable than its
  // calendar duration (the session may run longer than originally booked).
  if (session.journey_started_at && !session.journey_ended_at) return true;

  const start = scheduledStart(session);
  const reference = timestamp(now);
  if (!Number.isFinite(start) || !Number.isFinite(reference)) return false;
  const duration = Math.max(1, session.duration_minutes ?? DEFAULT_SESSION_DURATION_MINUTES) * 60_000;
  return start <= reference && reference < start + duration;
}

/** Strictly future, valid scheduled sessions ordered nearest first. */
export function selectUpcomingSessions<T extends SessionSelectionInput>(
  sessions: readonly T[],
  now: string | number | Date = Date.now(),
  options?: SelectionOptions,
): T[] {
  const reference = timestamp(now);
  return sessions
    .filter((session) => {
      const start = scheduledStart(session);
      return session.status === "scheduled" && matchesType(session, options) && Number.isFinite(start) && start > reference;
    })
    .sort(chronological);
}

/** The live session, preferring the most recently started if windows overlap. */
export function selectActiveSession<T extends SessionSelectionInput>(
  sessions: readonly T[],
  now: string | number | Date = Date.now(),
  options?: SelectionOptions,
): T | undefined {
  return sessions
    .filter((session) => matchesType(session, options) && isSessionActive(session, now))
    .sort((a, b) => chronological(b, a))[0];
}

/**
 * Heartful's canonical appointment choice: the current live session when one
 * exists, otherwise the nearest valid future scheduled session.
 */
export function selectCurrentOrNextSession<T extends SessionSelectionInput>(
  sessions: readonly T[],
  now: string | number | Date = Date.now(),
  options?: SelectionOptions,
): T | undefined {
  return selectActiveSession(sessions, now, options) ?? selectUpcomingSessions(sessions, now, options)[0];
}

/** Explicit history fallback for stage workspaces; never used as "Upcoming". */
export function selectLatestCompletedSession<T extends SessionSelectionInput>(
  sessions: readonly T[],
  options?: SelectionOptions,
): T | undefined {
  return sessions
    .filter((session) => session.status === "completed" && matchesType(session, options))
    .sort((a, b) => chronological(b, a))[0];
}

/** Stage pages may reopen their latest completed record when no live/future session exists. */
export function selectStageWorkspaceSession<T extends SessionSelectionInput>(
  sessions: readonly T[],
  sessionType: SessionType,
  now: string | number | Date = Date.now(),
): T | undefined {
  const options = { sessionType };
  return selectCurrentOrNextSession(sessions, now, options) ?? selectLatestCompletedSession(sessions, options);
}

/** Shared timeline split for Calendar and Client Portal Appointments. */
export function selectSessionTimeline<T extends SessionSelectionInput>(
  sessions: readonly T[],
  now: string | number | Date = Date.now(),
) {
  const active = sessions.filter((session) => isSessionActive(session, now)).sort((a, b) => chronological(b, a));
  const activeSet = new Set<SessionSelectionInput>(active);
  const upcoming = selectUpcomingSessions(sessions, now).filter((session) => !activeSet.has(session));
  const visibleIds = new Set<SessionSelectionInput>([...active, ...upcoming]);
  const history = sessions
    .filter((session) => !visibleIds.has(session))
    .sort((a, b) => chronological(b, a));

  return { active, upcoming, activeAndUpcoming: [...active, ...upcoming], history };
}
