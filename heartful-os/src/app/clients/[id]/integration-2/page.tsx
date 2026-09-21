import AppShell from "@/components/layout/AppShell";
import {
  getClient,
  getDocuments,
  getFormTemplates,
  getFormSubmissionsForClient,
  getAiSummaries,
  getMilestones,
} from "@/lib/data";
import { notFound } from "next/navigation";
import IntegrationWorkspace from "@/components/client/IntegrationWorkspace";
import MilestoneToggleBanner from "@/components/client/MilestoneToggleBanner";
import ClientPhaseNav from "@/components/client/ClientPhaseNav";
import PhasePrepareMe from "@/components/client/PhasePrepareMe";
import ClientPhaseWorkspace from "@/components/client/ClientPhaseWorkspace";

export const dynamic = "force-dynamic";

export default async function Integration2Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [client, documents, formTemplates, formSubmissions, summaries, milestones] = await Promise.all([
    getClient(id),
    getDocuments(id),
    getFormTemplates(),
    getFormSubmissionsForClient(id),
    getAiSummaries(id, "integration_summary"),
    getMilestones(id),
  ]);
  if (!client) notFound();

  const milestone = milestones.find((m) => m.milestone_key === "integration_2_complete");

  return (
    <AppShell title={client.full_name} variant="wellnest-client">
      <ClientPhaseWorkspace clientId={id} showClientHeader>
      <ClientPhaseNav clientId={id} current="integration_2" />
      <MilestoneToggleBanner
        clientId={id}
        milestoneKey="integration_2_complete"
        label="Integration Session Two"
        meta="Phase 6 · Within 10 days"
        initialCompleted={milestone?.completed ?? false}
      />
      <PhasePrepareMe clientId={id} sessionTypeLabel="Integration Session 2" sessionType="integration_2" />
      <IntegrationWorkspace
        clientId={id}
        clientName={client.full_name}
        sessionNumber={2}
        documents={documents}
        formTemplates={formTemplates}
        formSubmissions={formSubmissions}
        existingSummary={summaries.find((s) => s.title === "Integration Summary 2")}
      />
      </ClientPhaseWorkspace>
    </AppShell>
  );
}
