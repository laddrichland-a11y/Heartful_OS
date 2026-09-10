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
import PreparationWorkspace from "@/components/client/PreparationWorkspace";
import MilestoneToggleBanner from "@/components/client/MilestoneToggleBanner";
import ClientPhaseNav from "@/components/client/ClientPhaseNav";
import PhasePrepareMe from "@/components/client/PhasePrepareMe";

export const dynamic = "force-dynamic";

export default async function PreparationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const [summaries, documents, formTemplates, formSubmissions, milestones] = await Promise.all([
    getAiSummaries(id, "journey_brief"),
    getDocuments(id),
    getFormTemplates(),
    getFormSubmissionsForClient(id),
    getMilestones(id),
  ]);

  const milestone = milestones.find((m) => m.milestone_key === "preparation_complete");

  return (
    <AppShell title={`Preparation Session — ${client.full_name}`}>
      <ClientPhaseNav clientId={id} current="preparation" />
      <p className="text-xs uppercase tracking-wide text-ink-400 mb-4">Phase 2 · 90 minutes</p>
      <MilestoneToggleBanner
        clientId={id}
        milestoneKey="preparation_complete"
        label="Preparation Session"
        initialCompleted={milestone?.completed ?? false}
      />
      <PhasePrepareMe clientId={id} sessionTypeLabel="Preparation" sessionType="preparation" />
      <PreparationWorkspace
        clientId={id}
        clientName={client.full_name}
        documents={documents}
        formTemplates={formTemplates}
        formSubmissions={formSubmissions}
        existingBrief={summaries[0]}
      />
    </AppShell>
  );
}
