import AppShell from "@/components/layout/AppShell";
import {
  getClient,
  getAiSummaries,
  getSessions,
  getMilestones,
  getPractitioner,
  getRecordings,
  getStageRecordings,
  pickPhaseSession,
  ensureClientFormDocuments,
  getFormTemplates,
  getDocuments,
  getFormSubmissionsForClient,
} from "@/lib/data";
import { notFound, redirect } from "next/navigation";
import JourneyDayWorkspace from "@/components/client/JourneyDayWorkspace";
import MilestoneToggleBanner from "@/components/client/MilestoneToggleBanner";
import ClientPhaseNav from "@/components/client/ClientPhaseNav";
import JourneyPrepEmailButton from "@/components/client/JourneyPrepEmailButton";
import JourneySummaryTextButton from "@/components/client/JourneySummaryTextButton";
import ClientPhaseWorkspace from "@/components/client/ClientPhaseWorkspace";
import PhasePrepareMe from "@/components/client/PhasePrepareMe";
import { headers } from "next/headers";
import { getJourneyStageWorkspaceState } from "@/lib/utils";
import { selectCurrentOrNextSession, selectUpcomingSessions } from "@/lib/sessionSelectors";

export const dynamic = "force-dynamic";

export default async function JourneyDayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Attach any Form Library form this client doesn't have yet (e.g. one
  // added after they became a client) so it shows under Forms for This Session.
  await ensureClientFormDocuments(id);
  const client = await getClient(id);
  if (!client) notFound();

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol = h.get("x-forwarded-proto") ?? "http";
  const portalUrl = `${protocol}://${host}/portal?client=${id}`;
  const [sessions, milestones, practitioner, manualNotesSummaries, callSummaries, formTemplates, documents, formSubmissions] =
    await Promise.all([
      getSessions(id),
      getMilestones(id),
      getPractitioner(),
      getAiSummaries(id, "journey_manual_notes_summary"),
      getAiSummaries(id, "session_call_summary"),
      getFormTemplates(),
      getDocuments(id),
      getFormSubmissionsForClient(id),
    ]);
  // Prefer the scheduled Journey Day session if one exists; otherwise fall
  // back to the most recent one by date (completed/cancelled) — see
  // pickPhaseSession, which every stage page now shares.
  const session = pickPhaseSession(sessions, "harm_reduction_support");
  const canonicalSessionHref = session ? `/clients/${id}/sessions/${session.id}` : undefined;
  if (canonicalSessionHref) redirect(canonicalSessionHref);
  const recordings = session ? await getRecordings(id, session.id) : [];
  const stageRecordings = session ? [] : await getStageRecordings(id, "journey_day");
  const milestone = milestones.find((m) => m.milestone_key === "journey_complete");
  const stage = getJourneyStageWorkspaceState(client, milestones, "harm_reduction_session", "journey_complete");
  const pastCallSummaries = session ? callSummaries.filter((s) => s.session_id === session.id) : [];

  // Earliest still-scheduled session after Journey Day (e.g. the 12hr
  // check-in) — used as the "we'll talk again on ___" line in the prep email.
  const currentOrNext = selectCurrentOrNextSession(sessions.filter((candidate) => candidate.id !== session?.id));
  const followUpSession = currentOrNext && (!session?.scheduled_at || (currentOrNext.scheduled_at ?? "") > session.scheduled_at)
    ? currentOrNext
    : selectUpcomingSessions(sessions, session?.scheduled_at)[0];

  return (
    <AppShell title={client.full_name} variant="wellnest-client">
      <ClientPhaseWorkspace clientId={id} showClientHeader>
      <ClientPhaseNav clientId={id} current="harm_reduction_session" />
      <div className="mb-4 flex items-center justify-end gap-3">
        <div className="flex items-center gap-2">
          <JourneyPrepEmailButton
            clientId={id}
            clientName={client.full_name}
            clientEmail={client.email}
            practitionerName={practitioner.full_name}
            practiceName={practitioner.practice_name}
            sessionScheduledAt={session?.status === "scheduled" ? session.scheduled_at : undefined}
            followUpScheduledAt={followUpSession?.scheduled_at}
          />
          <JourneySummaryTextButton
            clientId={id}
            clientName={client.full_name}
            clientPhone={client.phone}
            practitionerName={practitioner.full_name}
            portalUrl={portalUrl}
            ready={pastCallSummaries.length > 0}
          />
        </div>
      </div>
      <MilestoneToggleBanner
        clientId={id}
        milestoneKey="journey_complete"
        label="Journey Day"
        meta="Phase 3 · 8 hours"
        initialCompleted={milestone?.completed ?? false}
        stageStatus={stage.status}
        canMarkComplete={stage.canMarkComplete}
        canPrepare={stage.canPrepare}
      />
      <PhasePrepareMe readOnly={!stage.canPrepare} clientId={id} sessionTypeLabel="Journey Day" sessionId={session?.id} />

      <JourneyDayWorkspace
        clientId={id}
        clientName={client.full_name}
        sessionId={session?.id ?? ""}
        initialManualNotes={session?.manual_notes ?? ""}
        existingManualNotesSummary={manualNotesSummaries[0]}
        initialJourneyStartedAt={session?.journey_started_at}
        initialJourneyEndedAt={session?.journey_ended_at}
        initialInitialDoseAmount={session?.initial_dose_amount ?? ""}
        initialBoosterDoseAt={session?.booster_dose_at}
        initialBoosterDoseAmount={session?.booster_dose_amount ?? ""}
        pastCallSummaries={pastCallSummaries}
        initialTranscript={session?.transcript ?? ""}
        initialRecordings={recordings}
        initialStageRecordings={stageRecordings}
        formTemplates={formTemplates}
        documents={documents}
        formSubmissions={formSubmissions}
      />
      </ClientPhaseWorkspace>
    </AppShell>
  );
}
