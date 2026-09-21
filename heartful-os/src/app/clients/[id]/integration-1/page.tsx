import AppShell from "@/components/layout/AppShell";
import {
  getClient,
  getAiSummaries,
  getDocuments,
  getFormTemplates,
  getFormSubmissionsForClient,
  getMilestones,
} from "@/lib/data";
import { notFound } from "next/navigation";
import IntegrationWorkspace from "@/components/client/IntegrationWorkspace";
import MilestoneToggleBanner from "@/components/client/MilestoneToggleBanner";
import ClientPhaseNav from "@/components/client/ClientPhaseNav";
import PhasePrepareMe from "@/components/client/PhasePrepareMe";
import ClientPhaseWorkspace from "@/components/client/ClientPhaseWorkspace";

export const dynamic = "force-dynamic";

export default async function Integration1Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const [documents, formTemplates, formSubmissions, summaries, milestones] = await Promise.all([
    getDocuments(id),
    getFormTemplates(),
    getFormSubmissionsForClient(id),
    getAiSummaries(id, "integration_summary"),
    getMilestones(id),
  ]);

  const milestone = milestones.find((m) => m.milestone_key === "integration_1_complete");

  return (
    <AppShell title={client.full_name} variant="wellnest-client">
      <ClientPhaseWorkspace clientId={id} showClientHeader>
      <ClientPhaseNav clientId={id} current="integration_1" />
      <MilestoneToggleBanner
        clientId={id}
        milestoneKey="integration_1_complete"
        label="Integration Session One"
        meta="Phase 5 · Within 72 hours"
        initialCompleted={milestone?.completed ?? false}
      />
      <PhasePrepareMe clientId={id} sessionTypeLabel="Integration Session 1" sessionType="integration_1" />
      <IntegrationWorkspace
        clientId={id}
        clientName={client.full_name}
        sessionNumber={1}
        documents={documents}
        formTemplates={formTemplates}
        formSubmissions={formSubmissions}
        existingSummary={summaries.find((s) => s.title === "Integration Summary 1")}
      />
      </ClientPhaseWorkspace>
    </AppShell>
  );
}
