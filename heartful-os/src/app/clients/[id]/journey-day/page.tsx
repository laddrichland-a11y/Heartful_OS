import AppShell from "@/components/layout/AppShell";
import {
  getClient,
  getDocuments,
  getPreparationPlan,
  getAiSummaries,
  getSessions,
  getSessionNotes,
  getMilestones,
  getPractitioner,
  getRecordings,
  pickPhaseSession,
} from "@/lib/data";
import { notFound, redirect } from "next/navigation";
import { DOCUMENT_LABELS } from "@/lib/types";
import JourneyDayWorkspace from "@/components/client/JourneyDayWorkspace";
import MilestoneToggleBanner from "@/components/client/MilestoneToggleBanner";
import ClientPhaseNav from "@/components/client/ClientPhaseNav";
import JourneyPrepEmailButton from "@/components/client/JourneyPrepEmailButton";
import JourneySummaryTextButton from "@/components/client/JourneySummaryTextButton";
import ClientPhaseWorkspace from "@/components/client/ClientPhaseWorkspace";
import PhasePrepareMe from "@/components/client/PhasePrepareMe";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function JourneyDayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol = h.get("x-forwarded-proto") ?? "http";
  const portalUrl = `${protocol}://${host}/portal?client=${id}`;
  const [documents, plan, briefs, sessions, summaries, milestones, practitioner, manualNotesSummaries, callSummaries] =
    await Promise.all([
      getDocuments(id),
      getPreparationPlan(id),
      getAiSummaries(id, "journey_brief"),
      getSessions(id),
      getAiSummaries(id, "journey_summary"),
      getMilestones(id),
      getPractitioner(),
      getAiSummaries(id, "journey_manual_notes_summary"),
      getAiSummaries(id, "session_call_summary"),
    ]);
  // Prefer the scheduled Journey Day session if one exists; otherwise fall
  // back to the most recent one by date (completed/cancelled) — see
  // pickPhaseSession, which every stage page now shares.
  const session = pickPhaseSession(sessions, "harm_reduction_support");
  const canonicalSessionHref = session ? `/clients/${id}/sessions/${session.id}` : undefined;
  if (canonicalSessionHref) redirect(canonicalSessionHref);
  const notes = session ? await getSessionNotes(session.id) : [];
  const recordings = session ? await getRecordings(id, session.id) : [];
  const milestone = milestones.find((m) => m.milestone_key === "journey_complete");
  const pastCallSummaries = session ? callSummaries.filter((s) => s.session_id === session.id) : [];

  // Earliest still-scheduled session after Journey Day (e.g. the 12hr
  // check-in) — used as the "we'll talk again on ___" line in the prep email.
  const followUpSession = sessions
    .filter(
      (s) =>
        s.status === "scheduled" &&
        s.scheduled_at &&
        session?.scheduled_at &&
        s.scheduled_at > session.scheduled_at
    )
    .sort((a, b) => (a.scheduled_at! < b.scheduled_at! ? -1 : 1))[0];

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
        meta="Phase 3 · Harm Reduction Support · 8 hours"
        initialCompleted={milestone?.completed ?? false}
      />
      <PhasePrepareMe clientId={id} sessionTypeLabel="Journey Day" sessionId={session?.id} />

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-ink-900 mb-2">Health &amp; Emergency Info</h3>
          <p className="text-sm text-ink-700">
            {client.emergency_contact_name
              ? `${client.emergency_contact_name}${client.emergency_contact_relationship ? ` (${client.emergency_contact_relationship})` : ""}${client.emergency_contact_phone ? ` — ${client.emergency_contact_phone}` : ""}`
              : <span className="text-ink-400 text-xs">No emergency contact on file</span>}
          </p>
          <div className="mt-2 space-y-1">
            {documents
              .filter((d) => d.document_type === "participant_screening_form")
              .map((d) => (
                <div key={d.id} className="text-xs text-ink-500 capitalize">
                  {DOCUMENT_LABELS[d.document_type]}: {d.status}
                </div>
              ))}
          </div>
        </div>
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-ink-900 mb-2">Signed Agreements</h3>
          {documents
            .filter((d) => d.document_type.includes("agreement") || d.document_type === "informed_consent")
            .map((d) => (
              <div key={d.id} className="text-xs text-ink-500 capitalize">
                {DOCUMENT_LABELS[d.document_type]}: {d.status}
              </div>
            ))}
        </div>
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-ink-900 mb-2">Journey Brief</h3>
          {briefs[0] ? (
            <p className="text-xs text-ink-600 whitespace-pre-line">{String(briefs[0].content.client_summary ?? "")}</p>
          ) : (
            <p className="text-xs text-ink-400">No Journey Brief on file.</p>
          )}
        </div>
      </div>

      {plan && (
        <details className="card p-4 mb-6">
          <summary className="text-sm font-semibold text-ink-900 cursor-pointer">Preparation &amp; Navigation Plan (expand)</summary>
          <dl className="grid md:grid-cols-2 gap-3 mt-3">
            {Object.entries(plan)
              .filter(([k]) => !["id", "client_id", "updated_at"].includes(k))
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs uppercase tracking-wide text-ink-400">{k.replace(/_/g, " ")}</dt>
                  <dd className="text-sm text-ink-700">{String(v ?? "—")}</dd>
                </div>
              ))}
          </dl>
        </details>
      )}

      <JourneyDayWorkspace
        clientId={id}
        clientName={client.full_name}
        sessionId={session?.id ?? ""}
        initialNotes={notes}
        existingSummary={summaries[0]}
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
      />
      </ClientPhaseWorkspace>
    </AppShell>
  );
}
