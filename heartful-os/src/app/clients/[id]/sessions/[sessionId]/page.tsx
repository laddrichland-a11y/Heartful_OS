import AppShell from "@/components/layout/AppShell";
import {
  getClient,
  getSession,
  getSessions,
  getAiSummaries,
  getFormTemplates,
  getFormSubmissionsForClient,
  getDocuments,
  getMilestones,
  getPractitioner,
  getRecordings,
  getReferralSources,
} from "@/lib/data";
import { notFound } from "next/navigation";
import SessionDetailWorkspace from "@/components/client/SessionDetailWorkspace";
import ClientPhaseNav from "@/components/client/ClientPhaseNav";
import { PhaseNavKey } from "@/components/client/JourneyStageNav";
import { AiSummaryType, SessionType } from "@/lib/types";
import { headers } from "next/headers";
import ClientHeader from "@/components/client/ClientHeader";
import ClientPhaseWorkspace from "@/components/client/ClientPhaseWorkspace";

export const dynamic = "force-dynamic";

// The phase pills deep-link to a session record when one exists, so this page
// is where most pill clicks actually land — it needs the same nav row, with
// the pill for this session's own stage highlighted.
const SESSION_NAV_PHASE: Partial<Record<SessionType, PhaseNavKey>> = {
  intake_assessment: "intake",
  preparation: "preparation",
  harm_reduction_support: "harm_reduction_session",
  check_in_12hr: "post_journey_check_in",
  integration_1: "integration_1",
  integration_2: "integration_2",
};

const SESSION_PRIMARY_SUMMARY_TYPES: Partial<Record<SessionType, AiSummaryType[]>> = {
  intake_assessment: ["client_assessment_summary"],
  preparation: ["journey_brief"],
  harm_reduction_support: ["journey_summary"],
  check_in_12hr: ["check_in_12hr_summary"],
  integration_1: ["integration_1_brief", "integration_summary"],
  integration_2: ["integration_summary"],
};

// Maps session type → milestone key so the toggle on the session detail page
// controls the same milestone as the toggle on the activity page.
const SESSION_MILESTONE_KEY: Partial<Record<SessionType, string>> = {
  intake_assessment: "intake_complete",
  preparation: "preparation_complete",
  harm_reduction_support: "journey_complete",
  check_in_12hr: "check_in_12hr_complete",
  integration_1: "integration_1_complete",
  integration_2: "integration_2_complete",
};

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id, sessionId } = await params;
  const [client, session] = await Promise.all([getClient(id), getSession(sessionId)]);
  if (!client || !session) notFound();

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol = h.get("x-forwarded-proto") ?? "http";
  const portalUrl = `${protocol}://${host}/portal?client=${id}`;

  const [aiSummaries, formTemplates, formSubmissions, documents, milestones, sessions, practitioner, recordings, referralSources] =
    await Promise.all([
      getAiSummaries(id),
      getFormTemplates(),
      getFormSubmissionsForClient(id),
      getDocuments(id),
      getMilestones(id),
      getSessions(id),
      getPractitioner(),
      getRecordings(id, sessionId),
      getReferralSources(),
    ]);

  // Earliest still-scheduled session after this one (e.g. the 12hr check-in
  // after Journey Day) — used as the "we'll talk again on ___" line in the
  // Journey Day prep email.
  const followUpSession = sessions
    .filter(
      (s) => s.status === "scheduled" && s.scheduled_at && session.scheduled_at && s.scheduled_at > session.scheduled_at
    )
    .sort((a, b) => (a.scheduled_at! < b.scheduled_at! ? -1 : 1))[0];

  const pastBriefings = aiSummaries.filter(
    (s) => s.summary_type === "prepare_me_briefing" && s.session_id === sessionId
  );
  // Scoped to this specific session — previously unfiltered by session_id,
  // which meant the "Text Client: Summary Ready" reminder (and the Journey
  // Day Summary - Client list) would show as ready on every appointment
  // page once ANY session had a generated summary, not just this one.
  const pastCallSummaries = aiSummaries.filter(
    (s) => s.summary_type === "session_call_summary" && s.session_id === sessionId
  );
  const primarySummaryTypes = SESSION_PRIMARY_SUMMARY_TYPES[session.session_type] ?? [];
  const primarySummaries = aiSummaries.filter((s) =>
    primarySummaryTypes.includes(s.summary_type)
  );
  const manualNotesSummaries = aiSummaries.filter(
    (s) => s.summary_type === "journey_manual_notes_summary" && s.session_id === sessionId
  );

  const milestoneKey = SESSION_MILESTONE_KEY[session.session_type];
  const milestone = milestoneKey
    ? milestones.find((m) => m.milestone_key === milestoneKey)
    : undefined;

  return (
    <AppShell title={client.full_name} variant="wellnest-client">
      <ClientPhaseWorkspace clientId={id}>
      <ClientHeader
        client={client}
        milestones={milestones}
        sessions={sessions}
        referralSources={referralSources}
        practitioner={practitioner}
        portalUrl={portalUrl}
      />
      <ClientPhaseNav
        clientId={id}
        current={SESSION_NAV_PHASE[session.session_type]}
        hideClientSummary
      />
      <SessionDetailWorkspace
        clientId={id}
        clientName={client.full_name}
        clientEmail={client.email}
        clientPhone={client.phone}
        session={session}
        pastBriefings={pastBriefings}
        pastCallSummaries={pastCallSummaries}
        primarySummaries={primarySummaries}
        milestoneKey={milestoneKey}
        milestoneCompleted={milestone?.completed ?? false}
        formTemplates={formTemplates}
        formSubmissions={formSubmissions}
        documents={documents}
        practitionerName={practitioner.full_name}
        practiceName={practitioner.practice_name}
        followUpScheduledAt={followUpSession?.scheduled_at}
        initialManualNotes={session.manual_notes ?? ""}
        existingManualNotesSummary={manualNotesSummaries[0]}
        initialTranscript={session.transcript ?? ""}
        initialRecordings={recordings}
        portalUrl={portalUrl}
      />
      </ClientPhaseWorkspace>
    </AppShell>
  );
}
