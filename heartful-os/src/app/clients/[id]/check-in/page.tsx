import AppShell from "@/components/layout/AppShell";
import {
  getClient,
  getAiSummaries,
  getCheckIns,
  getDocuments,
  getFormTemplates,
  getFormSubmissionsForClient,
  getMilestones,
  getSessions,
  pickPhaseSession,
  getStageNotes,
  getStageRecordings,
  ensureClientFormDocuments,
} from "@/lib/data";
import { notFound, redirect } from "next/navigation";
import CheckInStageWorkspace from "@/components/client/CheckInStageWorkspace";
import MilestoneToggleBanner from "@/components/client/MilestoneToggleBanner";
import ClientPhaseNav from "@/components/client/ClientPhaseNav";
import ClientPhaseWorkspace from "@/components/client/ClientPhaseWorkspace";
import PhasePrepareMe from "@/components/client/PhasePrepareMe";
import { getJourneyStageWorkspaceState } from "@/lib/utils";

export const dynamic = "force-dynamic";

// The 12-Hour Check-In stage page — same layout as every other stage. If a
// check-in call is on the calendar, its session page is used instead.
export default async function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  await ensureClientFormDocuments(id);

  const [documents, formTemplates, formSubmissions, summaries, milestones, sessions, checkIns, stageNotes, stageRecordings] = await Promise.all([
    getDocuments(id),
    getFormTemplates(),
    getFormSubmissionsForClient(id),
    getAiSummaries(id, "check_in_12hr_summary"),
    getMilestones(id),
    getSessions(id),
    getCheckIns(id),
    getStageNotes(id, "check_in_12hr"),
    getStageRecordings(id, "check_in_12hr"),
  ]);

  const session = pickPhaseSession(sessions, "check_in_12hr");
  if (session) redirect(`/clients/${id}/sessions/${session.id}`);

  const milestone = milestones.find((m) => m.milestone_key === "check_in_12hr_complete");
  const stage = getJourneyStageWorkspaceState(client, milestones, "post_journey_check_in", "check_in_12hr_complete");
  const legacyCheckIn = checkIns.find((c) => c.check_in_type === "12_hour");

  return (
    <AppShell title={client.full_name} variant="wellnest-client">
      <ClientPhaseWorkspace clientId={id} showClientHeader>
      <ClientPhaseNav clientId={id} current="post_journey_check_in" />
      <MilestoneToggleBanner
        clientId={id}
        milestoneKey="check_in_12hr_complete"
        label="12-Hour Check-In"
        meta="Phase 4 · About 12 hours after the journey"
        initialCompleted={milestone?.completed ?? false}
        stageStatus={stage.status}
        canMarkComplete={stage.canMarkComplete}
        canPrepare={stage.canPrepare}
      />
      <PhasePrepareMe readOnly={!stage.canPrepare} clientId={id} sessionTypeLabel="12-Hour Check-In" sessionType="check_in_12hr" />
      <CheckInStageWorkspace
        clientId={id}
        clientName={client.full_name}
        documents={documents}
        formTemplates={formTemplates}
        formSubmissions={formSubmissions}
        legacyCheckIn={legacyCheckIn}
        existingSummaries={summaries}
        initialNotes={stageNotes?.content ?? ""}
        initialRecordings={stageRecordings}
        canCompleteStage={stage.canCompleteStage}
      />
      </ClientPhaseWorkspace>
    </AppShell>
  );
}
