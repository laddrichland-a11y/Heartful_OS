import AppShell from "@/components/layout/AppShell";
import {
  getClient,
  getDocuments,
  getFormTemplates,
  getFormSubmissionsForClient,
  getAiSummaries,
  getMilestones,
  getSessions,
  pickPhaseSession,
  getStageNotes,
  getStageRecordings,
  ensureClientFormDocuments,
} from "@/lib/data";
import { notFound, redirect } from "next/navigation";
import IntegrationWorkspace from "@/components/client/IntegrationWorkspace";
import MilestoneToggleBanner from "@/components/client/MilestoneToggleBanner";
import ClientPhaseNav from "@/components/client/ClientPhaseNav";
import ClientPhaseWorkspace from "@/components/client/ClientPhaseWorkspace";
import PhasePrepareMe from "@/components/client/PhasePrepareMe";
import { getJourneyStageWorkspaceState } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Integration2Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Attach any Form Library form this client doesn't have yet (e.g. one
  // added after they became a client) so it shows under Forms for This Session.
  await ensureClientFormDocuments(id);
  const [client, documents, formTemplates, formSubmissions, summaries, milestones, sessions, stageNotes, stageRecordings] = await Promise.all([
    getClient(id),
    getDocuments(id),
    getFormTemplates(),
    getFormSubmissionsForClient(id),
    getAiSummaries(id, "integration_summary"),
    getMilestones(id),
    getSessions(id),
    getStageNotes(id, "integration_2"),
    getStageRecordings(id, "integration_2"),
  ]);
  if (!client) notFound();

  const session = pickPhaseSession(sessions, "integration_2");
  if (session) redirect(`/clients/${id}/sessions/${session.id}`);

  const milestone = milestones.find((m) => m.milestone_key === "integration_2_complete");
  const stage = getJourneyStageWorkspaceState(client, milestones, "integration_2", "integration_2_complete");

  return (
    <AppShell title={client.full_name} variant="wellnest-client">
      <ClientPhaseWorkspace clientId={id} showClientHeader>
      <ClientPhaseNav clientId={id} current="integration_2" />
      <MilestoneToggleBanner
        clientId={id}
        milestoneKey="integration_2_complete"
        label="Integration Session 2"
        meta="Phase 6 · Within 10 days"
        initialCompleted={milestone?.completed ?? false}
        stageStatus={stage.status}
        canMarkComplete={stage.canMarkComplete}
        canPrepare={stage.canPrepare}
      />
      <PhasePrepareMe readOnly={!stage.canPrepare} clientId={id} sessionTypeLabel="Integration Session 2" sessionType="integration_2" />
      <IntegrationWorkspace
        clientId={id}
        clientName={client.full_name}
        sessionNumber={2}
        documents={documents}
        formTemplates={formTemplates}
        formSubmissions={formSubmissions}
        existingSummaries={summaries.filter((s) => s.title === "Integration Summary 2")}
        initialNotes={stageNotes?.content ?? ""}
        initialRecordings={stageRecordings}
        canCompleteStage={stage.canCompleteStage}
      />
      </ClientPhaseWorkspace>
    </AppShell>
  );
}
