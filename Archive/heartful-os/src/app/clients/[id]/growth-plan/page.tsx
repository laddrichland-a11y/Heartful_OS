import AppShell from "@/components/layout/AppShell";
import { getClient, getGrowthActionPlan, getMilestones } from "@/lib/data";
import { notFound } from "next/navigation";
import GrowthActionPlanWorkspace from "@/components/client/GrowthActionPlanWorkspace";
import MilestoneToggleBanner from "@/components/client/MilestoneToggleBanner";
import ClientPhaseNav from "@/components/client/ClientPhaseNav";
import PhasePrepareMe from "@/components/client/PhasePrepareMe";

export const dynamic = "force-dynamic";

export default async function GrowthPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const [growthPlan, milestones] = await Promise.all([getGrowthActionPlan(id), getMilestones(id)]);

  const milestone = milestones.find((m) => m.milestone_key === "growth_action_plan_complete");

  return (
    <AppShell title={`Growth Action Plan — ${client.full_name}`}>
      <ClientPhaseNav clientId={id} current="growth_action_plan" />
      <p className="text-xs uppercase tracking-wide text-ink-400 mb-4">Growth Action Plan · final step</p>
      <MilestoneToggleBanner
        clientId={id}
        milestoneKey="growth_action_plan_complete"
        label="Growth Action Plan"
        initialCompleted={milestone?.completed ?? false}
      />
      <PhasePrepareMe clientId={id} sessionTypeLabel="Growth Action Plan" />
      <GrowthActionPlanWorkspace
        clientId={id}
        clientName={client.full_name}
        existingGrowthPlan={growthPlan ?? undefined}
      />
    </AppShell>
  );
}
