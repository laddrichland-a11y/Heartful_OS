import AppShell from "@/components/layout/AppShell";
import { getAiSummaries, getClient, getGrowthActionPlan, getMilestones, getStageNotes, getStageRecordings } from "@/lib/data";
import { notFound } from "next/navigation";
import GrowthActionPlanWorkspace from "@/components/client/GrowthActionPlanWorkspace";
import MilestoneToggleBanner from "@/components/client/MilestoneToggleBanner";
import ClientPhaseNav from "@/components/client/ClientPhaseNav";
import ClientPhaseWorkspace from "@/components/client/ClientPhaseWorkspace";
import PhasePrepareMe from "@/components/client/PhasePrepareMe";
import { getJourneyStageWorkspaceState } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function GrowthPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [client, growthPlan, milestones, planVersions, stageNotes, stageRecordings] = await Promise.all([
    getClient(id),
    getGrowthActionPlan(id),
    getMilestones(id),
    getAiSummaries(id, "growth_action_plan"),
    getStageNotes(id, "growth_plan"),
    getStageRecordings(id, "growth_plan"),
  ]);
  if (!client) notFound();

  const milestone = milestones.find((m) => m.milestone_key === "growth_action_plan_complete");
  const stage = getJourneyStageWorkspaceState(client, milestones, "growth_action_plan", "growth_action_plan_complete");

  return (
    <AppShell title={client.full_name} variant="wellnest-client">
      <ClientPhaseWorkspace clientId={id} showClientHeader>
      <ClientPhaseNav clientId={id} current="growth_action_plan" />
      <MilestoneToggleBanner
        clientId={id}
        milestoneKey="growth_action_plan_complete"
        label="Growth Action Plan"
        meta="Phase 7 · Final step"
        initialCompleted={milestone?.completed ?? false}
        stageStatus={stage.status}
        canMarkComplete={stage.canMarkComplete}
        canPrepare={stage.canPrepare}
      />
      <PhasePrepareMe readOnly={!stage.canPrepare} clientId={id} sessionTypeLabel="Growth Plan" />
      <GrowthActionPlanWorkspace
        clientId={id}
        clientName={client.full_name}
        existingGrowthPlan={growthPlan ?? undefined}
        existingVersions={planVersions}
        initialNotes={stageNotes?.content ?? ""}
        initialRecordings={stageRecordings}
        canCompleteStage={stage.canCompleteStage}
      />
      </ClientPhaseWorkspace>
    </AppShell>
  );
}
