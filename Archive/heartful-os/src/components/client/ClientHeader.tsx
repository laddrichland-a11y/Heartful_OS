import { Client, JourneyMilestone, Profile, ReferralSource, Session } from "@/lib/types";
import { formatCurrency, formatDate, initials, phaseForStatus } from "@/lib/utils";
import JourneyProgressBar from "@/components/JourneyProgressBar";
import ClientStatusControl from "@/components/client/ClientStatusControl";
import ClientHeaderActions from "@/components/client/ClientHeaderActions";
import DeleteClientButton from "@/components/client/DeleteClientButton";
import ResetPortalPasswordButton from "@/components/client/ResetPortalPasswordButton";
import { Mail, Phone, KeyRound, CheckCircle2, PauseCircle } from "lucide-react";
import RecordPaymentButton from "@/components/client/RecordPaymentButton";
import EmergencyContactEditor from "@/components/client/EmergencyContactEditor";
import HoldControl from "@/components/HoldControl";
import { PhaseNavPills, PHASE_LINKS } from "@/components/client/ClientPhaseNav";


export default function ClientHeader({
  client,
  milestones,
  sessions = [],
  referralSources,
  practitioner,
  portalUrl,
  autoOpenIntro = false,
}: {
  client: Client;
  milestones: JourneyMilestone[];
  sessions?: Session[];
  referralSources: ReferralSource[];
  practitioner: Profile;
  portalUrl: string;
  autoOpenIntro?: boolean;
}) {
  const referral = referralSources.find((r) => r.id === client.referral_source_id);
  const balance = Math.max(0, (client.package_value ?? 0) - (client.amount_paid ?? 0));

  // Which pill shows as "active" — the phase whose session was most recently
  // completed, rather than the client's current/next phase. Falls back to
  // the current-phase-based pill if nothing's been completed yet (e.g. a
  // brand new client) or the completed session type isn't one of the pills.
  const lastCompletedSession = sessions
    .filter((s) => s.status === "completed")
    .sort((a, b) => ((b.scheduled_at ?? "") > (a.scheduled_at ?? "") ? 1 : -1))[0];
  const activePhase =
    (lastCompletedSession &&
      PHASE_LINKS.find((p) => p.sessionType === lastCompletedSession.session_type)?.phase) ??
    phaseForStatus(client.status, client.current_phase);

  const growthPlanDone = milestones.some((m) => m.milestone_key === "growth_action_plan_complete" && m.completed);

  return (
    <div className="card p-5 mb-6">
      {client.on_hold_at && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <PauseCircle className="h-4 w-4 shrink-0" />
          <span className="font-medium">On hold</span>
          {client.hold_reason && <span>— {client.hold_reason}</span>}
          {client.hold_follow_up_at && (
            <span className="text-amber-700">
              · follow up {formatDate(client.hold_follow_up_at)}
            </span>
          )}
          <span className="text-amber-700">· hidden from lists, dashboard and calendar</span>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-full bg-clay-100 text-clay-700 flex items-center justify-center font-semibold text-lg">
            {initials(client.full_name)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-ink-900">{client.full_name}</h2>
              <ClientStatusControl clientId={client.id} status={client.status} phase={client.current_phase} />
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-ink-500 mt-1">
              {client.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {client.email}
                </span>
              )}
              {client.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {client.phone}
                </span>
              )}
              {referral && <span>Referred via {referral.name}</span>}
              <span>Client since {formatDate(client.created_at)}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs">
              {client.portal_password_hash ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-sage-500" />
                  <span className="text-ink-500">Portal account set up{client.portal_email ? `: ${client.portal_email}` : ""}</span>
                </>
              ) : (
                <>
                  <KeyRound className="h-3 w-3 text-ink-400" />
                  <span className="text-ink-400">Client hasn&apos;t set up their portal login yet</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="text-right space-y-2">
          <div>
            <div className="text-sm text-ink-900 font-medium">{formatCurrency(client.amount_paid)} collected</div>
            <div className="text-xs text-ink-500">{formatCurrency(balance)} outstanding of {formatCurrency(client.package_value)}</div>
            <RecordPaymentButton clientId={client.id} outstanding={balance} />
          </div>
          <ClientHeaderActions
            autoOpenIntro={autoOpenIntro}
            clientId={client.id}
            clientName={client.full_name}
            clientEmail={client.email}
            practitionerName={practitioner.full_name}
            practiceName={practitioner.practice_name}
            portalUrl={portalUrl}
            packageName={client.package_name}
            packageValue={client.package_value}
            amountDue={balance}
            venmoHandle={practitioner.venmo_handle}
          />
          {client.portal_password_hash && (
            <ResetPortalPasswordButton clientId={client.id} clientName={client.full_name} />
          )}
          <HoldControl
            kind="client"
            recordId={client.id}
            name={client.full_name}
            onHold={Boolean(client.on_hold_at)}
            followUpAt={client.hold_follow_up_at}
            reason={client.hold_reason}
          />
          <DeleteClientButton clientId={client.id} clientName={client.full_name} />
        </div>
      </div>

      <EmergencyContactEditor
        clientId={client.id}
        initialName={client.emergency_contact_name}
        initialRelationship={client.emergency_contact_relationship}
        initialPhone={client.emergency_contact_phone}
      />

      <div className="mt-5">
        <JourneyProgressBar milestones={milestones} />
      </div>

      <div className="mt-4">
        {/* Shared with every stage page — see ClientPhaseNav. This page is
            the overview, so the Overview pill is the lit one here. */}
        <PhaseNavPills
          clientId={client.id}
          sessions={sessions}
          activePhase={activePhase}
          growthPlanDone={growthPlanDone}
          current="overview"
        />
      </div>
    </div>
  );
}
