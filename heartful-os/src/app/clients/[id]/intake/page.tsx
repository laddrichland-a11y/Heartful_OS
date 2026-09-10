import AppShell from "@/components/layout/AppShell";
import {
  getClient,
  getDocuments,
  getAiSummaries,
  getFormTemplates,
  getFormSubmissionsForClient,
  getMilestones,
} from "@/lib/data";
import { notFound } from "next/navigation";
import IntakeWorkspace from "@/components/client/IntakeWorkspace";
import MilestoneToggleBanner from "@/components/client/MilestoneToggleBanner";
import ClientPhaseNav from "@/components/client/ClientPhaseNav";
import PhasePrepareMe from "@/components/client/PhasePrepareMe";

export const dynamic = "force-dynamic";

export default async function IntakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const [documents, summaries, formTemplates, formSubmissions, milestones] = await Promise.all([
    getDocuments(id),
    getAiSummaries(id, "client_assessment_summary"),
    getFormTemplates(),
    getFormSubmissionsForClient(id),
    getMilestones(id),
  ]);

  const milestone = milestones.find((m) => m.milestone_key === "intake_complete");

  return (
    <AppShell title={`Intake & Assessment — ${client.full_name}`}>
      <ClientPhaseNav clientId={id} current="intake" />
      <p className="text-xs uppercase tracking-wide text-ink-400 mb-4">Phase 1 · 90 minutes</p>
      <MilestoneToggleBanner
        clientId={id}
        milestoneKey="intake_complete"
        label="Intake & Assessment"
        initialCompleted={milestone?.completed ?? false}
      />
      <PhasePrepareMe clientId={id} sessionTypeLabel="Intake & Assessment" sessionType="intake_assessment" />
      <IntakeWorkspace
        clientId={id}
        clientName={client.full_name}
        documents={documents}
        formTemplates={formTemplates}
        formSubmissions={formSubmissions}
        existingSummaries={summaries}
      />
    </AppShell>
  );
}
