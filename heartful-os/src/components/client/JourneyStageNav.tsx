import Link from "next/link";
import { JourneyMilestone, Session } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Check } from "@/components/ui/HeartfulIcon";

export type PhaseNavKey = "overview" | "intake" | "preparation" | "harm_reduction_session" | "post_journey_check_in" | "integration_1" | "integration_2" | "growth_action_plan";

export const PHASE_LINKS: { phase: PhaseNavKey; label: string; href: string; sessionType?: string; milestoneKey: string }[] = [
  { phase: "intake", label: "Intake", href: "intake", sessionType: "intake_assessment", milestoneKey: "intake_complete" },
  { phase: "preparation", label: "Preparation", href: "preparation", sessionType: "preparation", milestoneKey: "preparation_complete" },
  { phase: "harm_reduction_session", label: "Journey Day", href: "journey-day", sessionType: "harm_reduction_support", milestoneKey: "journey_complete" },
  { phase: "post_journey_check_in", label: "12h Check-In", href: "check-in", sessionType: "check_in_12hr", milestoneKey: "check_in_12hr_complete" },
  { phase: "integration_1", label: "Integration 1", href: "integration-1", sessionType: "integration_1", milestoneKey: "integration_1_complete" },
  { phase: "integration_2", label: "Integration 2", href: "integration-2", sessionType: "integration_2", milestoneKey: "integration_2_complete" },
  { phase: "growth_action_plan", label: "Growth Plan", href: "growth-plan", milestoneKey: "growth_action_plan_complete" },
];

export function getJourneyStageProgress(milestones: JourneyMilestone[]) {
  const closed = milestones.some((milestone) => milestone.milestone_key === "journey_closed" && milestone.completed);
  const completed = PHASE_LINKS.filter(
    (stage) =>
      (stage.phase === "growth_action_plan" && closed) ||
      milestones.some((milestone) => milestone.milestone_key === stage.milestoneKey && milestone.completed),
  ).length;

  return { completed, total: PHASE_LINKS.length };
}

function phaseSession(sessions: Session[], sessionType?: string) {
  if (!sessionType) return undefined;
  return sessions.find((session) => session.session_type === sessionType && session.status === "scheduled") ?? sessions.filter((session) => session.session_type === sessionType && session.status === "completed").sort((a, b) => ((b.scheduled_at ?? "") > (a.scheduled_at ?? "") ? 1 : -1))[0];
}

export function JourneyStageNav({ clientId, sessions, milestones, activePhase, current }: { clientId: string; sessions: Session[]; milestones: JourneyMilestone[]; activePhase: string; current?: PhaseNavKey }) {
  const closed = milestones.some((milestone) => milestone.milestone_key === "journey_closed" && milestone.completed);
  const firstIncomplete = PHASE_LINKS.find((stage) => !(stage.phase === "growth_action_plan" && closed) && !milestones.some((milestone) => milestone.milestone_key === stage.milestoneKey && milestone.completed))?.phase;

  return (
    <div className="journey-stage-nav" aria-label="Journey stages">
      <ol>
        {PHASE_LINKS.map((stage, index) => {
          const session = phaseSession(sessions, stage.sessionType);
          const completed = (stage.phase === "growth_action_plan" && closed) || milestones.some((milestone) => milestone.milestone_key === stage.milestoneKey && milestone.completed);
          const viewing = current === stage.phase;
          const isCurrent = activePhase === stage.phase || (!PHASE_LINKS.some((item) => item.phase === activePhase) && firstIncomplete === stage.phase);
          const href = stage.phase === "post_journey_check_in"
            ? `/clients/${clientId}?tab=${encodeURIComponent("Journey & AI")}#check-in`
            : session
              ? `/clients/${clientId}/sessions/${session.id}`
              : `/clients/${clientId}/${stage.href}`;
          const statusText = viewing ? "Viewing stage" : isCurrent ? "Current stage" : session?.scheduled_at ? formatDate(session.scheduled_at) : "";
          return (
            <li
              key={stage.phase}
              data-state={viewing ? "viewing" : completed ? "complete" : isCurrent ? "current" : "upcoming"}
              data-completed={completed ? "true" : undefined}
            >
              <Link
                href={href}
                aria-current={viewing ? "step" : undefined}
                aria-label={`${stage.label}: ${viewing ? "viewing stage" : completed ? "completed" : isCurrent ? "current stage" : "upcoming"}`}
                className="journey-stage-link"
              >
                <span className="journey-stage-marker" aria-hidden="true">
                  {completed ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : index + 1}
                </span>
                <span className="journey-stage-copy">
                  <span className="journey-stage-label">{stage.label}</span>
                  {statusText && <span className="journey-stage-status">{statusText}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
