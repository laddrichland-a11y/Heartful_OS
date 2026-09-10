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

export const dynamic = "force-dynamic";

export default async function Integration2Page({ params }: { params: Promise<{ id: string }> }) {
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

  const milestone = milestones.find((m) => m.milestone_key === "integration_2_complete");

  return (
    <AppShell title={`Integration Session Two — ${client.full_name}`}>
      <ClientPhaseNav clientId={id} current="integration_2" />
      <p className="text-xs uppercase tracking-wide text-ink-400 mb-4">Integration · Session Two · within 10 days</p>
      <MilestoneToggleBanner
        clientId={id}
        milestoneKey="integration_2_complete"
        label="Integration Session Two"
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
    </AppShell>
  );
}
