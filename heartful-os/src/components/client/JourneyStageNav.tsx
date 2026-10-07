"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Client, JourneyMilestone, Session, SessionType } from "@/lib/types";
import { getClientJourneyProgress, journeyStageStatusLabel } from "@/lib/utils";
import { Check } from "@/components/ui/HeartfulIcon";
import { selectStageWorkspaceSession } from "@/lib/sessionSelectors";

export type PhaseNavKey = "overview" | "intake" | "preparation" | "harm_reduction_session" | "post_journey_check_in" | "integration_1" | "integration_2" | "growth_action_plan";

export const PHASE_LINKS: { phase: PhaseNavKey; label: string; href: string; sessionType?: SessionType; milestoneKey: string }[] = [
  { phase: "intake", label: "Intake", href: "intake", sessionType: "intake_assessment", milestoneKey: "intake_complete" },
  { phase: "preparation", label: "Preparation", href: "preparation", sessionType: "preparation", milestoneKey: "preparation_complete" },
  { phase: "harm_reduction_session", label: "Journey Day", href: "journey-day", sessionType: "harm_reduction_support", milestoneKey: "journey_complete" },
  { phase: "post_journey_check_in", label: "12-Hour Check-In", href: "check-in", sessionType: "check_in_12hr", milestoneKey: "check_in_12hr_complete" },
  { phase: "integration_1", label: "Integration 1", href: "integration-1", sessionType: "integration_1", milestoneKey: "integration_1_complete" },
  { phase: "integration_2", label: "Integration 2", href: "integration-2", sessionType: "integration_2", milestoneKey: "integration_2_complete" },
  { phase: "growth_action_plan", label: "Growth Plan", href: "growth-plan", milestoneKey: "growth_action_plan_complete" },
];

function headerIsExpanded(clientId: string) {
  return window.sessionStorage.getItem(`heartful:client-header:${clientId}:expanded`) !== "false";
}

function stageScrollKey(clientId: string) {
  return `heartful:stage-scroll:${clientId}`;
}

export function getJourneyStageProgress(milestones: JourneyMilestone[]) {
  const closed = milestones.some((milestone) => milestone.milestone_key === "journey_closed" && milestone.completed);
  const completed = PHASE_LINKS.filter(
    (stage) =>
      (stage.phase === "growth_action_plan" && closed) ||
      milestones.some((milestone) => milestone.milestone_key === stage.milestoneKey && milestone.completed),
  ).length;

  return { completed, total: PHASE_LINKS.length };
}

function phaseSession(sessions: Session[], sessionType?: SessionType) {
  if (!sessionType) return undefined;
  return selectStageWorkspaceSession(sessions, sessionType);
}

export function JourneyStageNav({ clientId, client, sessions, milestones, current }: { clientId: string; client: Pick<Client, "status" | "current_phase">; sessions: Session[]; milestones: JourneyMilestone[]; current?: PhaseNavKey }) {
  const journeyProgress = getClientJourneyProgress(client, milestones);

  useEffect(() => {
    const savedPosition = window.sessionStorage.getItem(stageScrollKey(clientId));
    if (!savedPosition) return;
    window.sessionStorage.removeItem(stageScrollKey(clientId));
    const scrollTop = savedPosition === "top" ? 0 : Number(savedPosition);
    if (Number.isFinite(scrollTop)) window.setTimeout(() => window.scrollTo({ top: scrollTop, behavior: "auto" }), 80);
  }, [clientId, current]);

  function saveStageNavigationPosition() {
    window.sessionStorage.setItem(
      stageScrollKey(clientId),
      headerIsExpanded(clientId) ? String(window.scrollY) : "top",
    );
  }

  return (
    <div className="journey-stage-nav" aria-label="Journey stages">
      <ol>
        {PHASE_LINKS.map((stage, index) => {
          const session = phaseSession(sessions, stage.sessionType);
          const stageStatus = journeyProgress.stages.find((candidate) => candidate.phase === stage.phase)?.status ?? "future";
          const completed = stageStatus === "completed";
          const viewing = current === stage.phase;
          const href = session
            ? `/clients/${clientId}/sessions/${session.id}`
            : `/clients/${clientId}/${stage.href}`;
          const statusText = journeyStageStatusLabel(stageStatus);
          return (
            <li
              key={stage.phase}
              data-state={stageStatus}
              data-viewing={viewing ? "true" : undefined}
              data-completed={completed ? "true" : undefined}
            >
              <Link
                href={href}
                aria-current={viewing ? "step" : undefined}
                aria-label={`${stage.label}: ${statusText?.toLowerCase() ?? "future stage"}${viewing ? ", viewing" : ""}`}
                className="journey-stage-link"
                scroll={false}
                onClick={saveStageNavigationPosition}
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
