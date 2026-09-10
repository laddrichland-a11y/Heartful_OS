import Link from "next/link";
import { cx, phaseForStatus } from "@/lib/utils";
import { getClient, getMilestones, getSessions } from "@/lib/data";
import { JourneyMilestone, Session } from "@/lib/types";
import { LayoutGrid } from "lucide-react";

// ---------------------------------------------------------------------------
// The client's journey timeline, rendered as a row of pills.
//
// This used to live inline in ClientHeader, which meant it only appeared on
// the client's main page — click into Intake and the row vanished, leaving a
// single "Back to client record" link and no way to hop straight to another
// stage. It's now shared so every stage page can render the same row.
//
// The leftmost "Overview" pill is the way back up to the top-level client
// record (Documents / Sessions / Journey & AI / Messages / History tabs).
// ---------------------------------------------------------------------------

export type PhaseNavKey =
  | "overview"
  | "intake"
  | "preparation"
  | "harm_reduction_session"
  | "post_journey_check_in"
  | "integration_1"
  | "integration_2"
  | "growth_action_plan";

export const PHASE_LINKS: {
  phase: PhaseNavKey;
  label: string;
  href: string;
  sessionType: string;
}[] = [
  { phase: "intake", label: "Intake", href: "intake", sessionType: "intake_assessment" },
  { phase: "preparation", label: "Preparation", href: "preparation", sessionType: "preparation" },
  { phase: "harm_reduction_session", label: "Journey Day", href: "journey-day", sessionType: "harm_reduction_support" },
  { phase: "post_journey_check_in", label: "12hr Check-In", href: "check-in", sessionType: "check_in_12hr" },
  { phase: "integration_1", label: "Integration 1", href: "integration-1", sessionType: "integration_1" },
  { phase: "integration_2", label: "Integration 2", href: "integration-2", sessionType: "integration_2" },
];

const PILL_BASE = "text-xs px-3 py-1.5 rounded-full border transition-colors";
const PILL_ON = "bg-clay-500 text-white border-clay-500";
const PILL_OFF = "border-ink-200 text-ink-600 hover:bg-ink-50";

/**
 * Presentational row. Use this where sessions/milestones are already loaded
 * (i.e. ClientHeader) so the data isn't fetched twice on the same page.
 *
 * `current` — the stage page being viewed. When set it wins the highlight,
 * because "where am I" is more useful than "how far along is this client"
 * once you've navigated into a stage. On the client's main page it's left
 * undefined and the highlight falls back to journey progress.
 */
export function PhaseNavPills({
  clientId,
  sessions,
  activePhase,
  growthPlanDone,
  current,
}: {
  clientId: string;
  sessions: Session[];
  activePhase: string;
  growthPlanDone: boolean;
  current?: PhaseNavKey;
}) {
  function isOn(phase: PhaseNavKey) {
    if (current) return current === phase;
    if (phase === "overview") return false;
    // Session records stop at Integration 2 — there's no session type for the
    // Growth Plan step, so activePhase would otherwise stay pinned on
    // "integration_2" forever, even after the growth plan (a later step) is
    // done. Once that's done, defer the highlight to the Growth Plan pill.
    if (phase === "growth_action_plan") return growthPlanDone;
    return activePhase === phase && !growthPlanDone;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Always present, on the client's main page too — there it's the lit
          pill, so the row reads the same everywhere: exactly one pill on,
          and it's the page you're looking at. */}
      <Link
        href={`/clients/${clientId}`}
        className={cx(
          PILL_BASE,
          "flex items-center gap-1.5 font-medium",
          isOn("overview") ? PILL_ON : "border-ink-300 bg-white text-ink-700 hover:bg-ink-50"
        )}
      >
        <LayoutGrid className="h-3 w-3" />
        Overview
      </Link>
      <span aria-hidden className="h-4 w-px bg-ink-200" />

      {PHASE_LINKS.map((p) => {
        // Prefer linking to the actual session — scheduled first, then
        // most-recently-completed — so the pill lands on the session
        // workspace with Prepare Me rather than the generic phase page.
        const match =
          sessions.find((s) => s.session_type === p.sessionType && s.status === "scheduled") ??
          sessions
            .filter((s) => s.session_type === p.sessionType && s.status === "completed")
            .sort((a, b) => ((b.scheduled_at ?? "") > (a.scheduled_at ?? "") ? 1 : -1))[0];
        const href = match ? `/clients/${clientId}/sessions/${match.id}` : `/clients/${clientId}/${p.href}`;
        return (
          <Link key={p.href} href={href} className={cx(PILL_BASE, isOn(p.phase) ? PILL_ON : PILL_OFF)}>
            {p.label}
          </Link>
        );
      })}

      {/* Always a stable link — unlike the phase pills above, this never
          redirects to a session record, since Growth Action Plan has no
          session type of its own. */}
      <Link
        href={`/clients/${clientId}/growth-plan`}
        className={cx(PILL_BASE, isOn("growth_action_plan") ? PILL_ON : PILL_OFF)}
      >
        Growth Plan
      </Link>
    </div>
  );
}

/**
 * Self-loading version for stage pages, which don't all fetch sessions and
 * milestones for their own sake. Renders the same row with a divider under
 * it, standing in for the old "Back to client record" link.
 */
export default async function ClientPhaseNav({
  clientId,
  current,
}: {
  clientId: string;
  current?: PhaseNavKey;
}) {
  const [client, sessions, milestones] = await Promise.all([
    getClient(clientId),
    getSessions(clientId),
    getMilestones(clientId),
  ]);
  if (!client) return null;

  return (
    <div className="mb-5 pb-4 border-b border-ink-100">
      <PhaseNavPills
        clientId={clientId}
        sessions={sessions}
        activePhase={phaseForStatus(client.status, client.current_phase)}
        growthPlanDone={growthDone(milestones)}
        current={current}
      />
    </div>
  );
}

function growthDone(milestones: JourneyMilestone[]) {
  return milestones.some((m) => m.milestone_key === "growth_action_plan_complete" && m.completed);
}
