import AppShell from "@/components/layout/AppShell";
import {
  getClient,
  getAiSummaries,
  getDocuments,
  getFormTemplates,
  getFormSubmissionsForClient,
  getMilestones,
  getSessions,
  pickPhaseSession,
} from "@/lib/data";
import { notFound, redirect } from "next/navigation";
import PreparationWorkspace from "@/components/client/PreparationWorkspace";
import MilestoneToggleBanner from "@/components/client/MilestoneToggleBanner";
import ClientPhaseNav from "@/components/client/ClientPhaseNav";
import ClientPhaseWorkspace from "@/components/client/ClientPhaseWorkspace";
import PhasePrepareMe from "@/components/client/PhasePrepareMe";
import { getJourneyStageWorkspaceState } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PreparationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const [summaries, documents, formTemplates, formSubmissions, milestones, sessions] = await Promise.all([
    getAiSummaries(id, "journey_brief"),
    getDocuments(id),
    getFormTemplates(),
    getFormSubmissionsForClient(id),
    getMilestones(id),
    getSessions(id),
  ]);

  const session = pickPhaseSession(sessions, "preparation");
  if (session) redirect(`/clients/${id}/sessions/${session.id}`);

  const milestone = milestones.find((m) => m.milestone_key === "preparation_complete");
  const stage = getJourneyStageWorkspaceState(client, milestones, "preparation", "preparation_complete");

  return (
    <AppShell title={client.full_name} variant="wellnest-client">
      <ClientPhaseWorkspace clientId={id} showClientHeader>
      <ClientPhaseNav clientId={id} current="preparation" />
      <MilestoneToggleBanner
        clientId={id}
        milestoneKey="preparation_complete"
        label="Preparation Session"
        meta="Phase 2 · 90 minutes"
        initialCompleted={milestone?.completed ?? false}
        stageStatus={stage.status}
        canMarkComplete={stage.canMarkComplete}
        canPrepare={stage.canPrepare}
      />
      {stage.canPrepare && <PhasePrepareMe clientId={id} sessionTypeLabel="Preparation" sessionType="preparation" />}
      <PreparationWorkspace
        clientId={id}
        clientName={client.full_name}
        documents={documents}
        formTemplates={formTemplates}
        formSubmissions={formSubmissions}
        existingBrief={summaries[0]}
      />
      </ClientPhaseWorkspace>
    </AppShell>
  );
}
