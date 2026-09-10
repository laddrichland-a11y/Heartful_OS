import AppShell from "@/components/layout/AppShell";
import { getClient, getCheckIns, getAiSummaries, getMilestones } from "@/lib/data";
import { notFound } from "next/navigation";
import CheckInWorkspace from "@/components/client/CheckInWorkspace";
import MilestoneToggleBanner from "@/components/client/MilestoneToggleBanner";
import ClientPhaseNav from "@/components/client/ClientPhaseNav";
import PhasePrepareMe from "@/components/client/PhasePrepareMe";

export const dynamic = "force-dynamic";

export default async function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  const [checkIns, summaries, milestones] = await Promise.all([
    getCheckIns(id),
    getAiSummaries(id, "check_in_12hr_summary"),
    getMilestones(id),
  ]);

  const milestone = milestones.find((m) => m.milestone_key === "check_in_12hr_complete");

  return (
    <AppShell title={`12-Hour Check-In — ${client.full_name}`}>
      <ClientPhaseNav clientId={id} current="post_journey_check_in" />
      <MilestoneToggleBanner
        clientId={id}
        milestoneKey="check_in_12hr_complete"
        label="12-Hour Check-In"
        initialCompleted={milestone?.completed ?? false}
      />
      <PhasePrepareMe clientId={id} sessionTypeLabel="12-Hour Check-In" sessionType="check_in_12hr" />
      <CheckInWorkspace clientId={id} clientName={client.full_name} existingCheckIn={checkIns[0]} existingSummary={summaries[0]} />
    </AppShell>
  );
}
