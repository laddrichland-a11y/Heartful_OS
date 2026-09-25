"use client";

import { useState } from "react";
import ClientAvatarEditor from "@/components/client/ClientAvatarEditor";
import { CalendarDays, CheckCircle2, ChevronDown, ChevronUp, CircleDollarSign, KeyRound, Mail, PauseCircle, Phone, UserRound } from "@/components/ui/HeartfulIcon";
import { Client, JourneyMilestone, Profile, ReferralSource, Session } from "@/lib/types";
import { clientAvatarSrc, cx, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { selectCurrentOrNextSession } from "@/lib/sessionSelectors";
import ClientStatusControl from "@/components/client/ClientStatusControl";
import ClientHeaderActions from "@/components/client/ClientHeaderActions";
import QuickNoteButton from "@/components/client/QuickNoteButton";
import DeleteClientButton from "@/components/client/DeleteClientButton";
import ResetPortalPasswordButton from "@/components/client/ResetPortalPasswordButton";
import RecordPaymentButton from "@/components/client/RecordPaymentButton";
import EmergencyContactEditor from "@/components/client/EmergencyContactEditor";
import HoldControl from "@/components/HoldControl";

export default function ClientHeader({ client, milestones, sessions = [], referralSources, practitioner, portalUrl, autoOpenIntro = false }: {
  client: Client;
  milestones: JourneyMilestone[];
  sessions?: Session[];
  referralSources: ReferralSource[];
  practitioner: Profile;
  portalUrl: string;
  autoOpenIntro?: boolean;
}) {
  const headerStateKey = `heartful:client-header:${client.id}:expanded`;
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.sessionStorage.getItem(headerStateKey) !== "false";
  });
  const referral = referralSources.find((source) => source.id === client.referral_source_id);
  const avatarSrc = clientAvatarSrc(client);
  const balance = Math.max(0, (client.package_value ?? 0) - (client.amount_paid ?? 0));
  const now = new Date().toISOString();
  const nextSession = selectCurrentOrNextSession(sessions, now);
  const nextSessionLabel = nextSession ? formatDateTime(nextSession.scheduled_at) : "No session scheduled";
  const paymentLabel = balance > 0 ? `${formatCurrency(balance)} outstanding` : "Paid in full";

  function toggleExpanded() {
    setExpanded((current) => {
      const next = !current;
      window.sessionStorage.setItem(headerStateKey, String(next));
      return next;
    });
  }

  const introActionProps = {
    autoOpenIntro,
    clientId: client.id,
    clientName: client.full_name,
    clientEmail: client.email,
    practitionerName: practitioner.full_name,
    practiceName: practitioner.practice_name,
    portalUrl,
    packageName: client.package_name,
    packageValue: client.package_value,
    amountDue: balance,
    venmoHandle: practitioner.venmo_handle,
  };

  return (
    <section className={`client-workspace-chrome wn-client-header wn-client-overview mb-5 ${expanded ? "is-expanded" : "is-collapsed"}`} aria-label="Client overview">
      {client.on_hold_at && (
        <div className="wn-hold-banner">
          <PauseCircle className="h-4 w-4" />
          <strong>Client on hold</strong>
          {client.hold_reason && <span>{client.hold_reason}</span>}
          {client.hold_follow_up_at && <span>Follow up {formatDate(client.hold_follow_up_at)}</span>}
        </div>
      )}

      <div className="wn-overview-summary">
        <div className="wn-overview-identity">
          <ClientAvatarEditor
            clientId={client.id}
            clientName={client.full_name}
            avatarUrl={client.avatar_url}
            fallbackAvatarSrc={avatarSrc}
          />
          <div className="wn-overview-name">
            <span className="wn-section-eyebrow">Client overview</span>
            <div className="wn-overview-title-row">
              <h1>{client.full_name}</h1>
              <ClientStatusControl clientId={client.id} status={client.status} phase={client.current_phase} milestones={milestones} />
            </div>
          </div>
        </div>

        {!expanded && (
          <div className="wn-overview-compact-facts">
            <CompactFact label="Next session" value={nextSessionLabel} />
            <CompactFact label="Payment" value={paymentLabel} tone={balance > 0 ? "warning" : "success"} />
          </div>
        )}

        <div className="wn-overview-summary-actions">
          {!expanded && (
            <>
              <QuickNoteButton clientId={client.id} clientName={client.full_name} compact />
              {client.email && <a className="wn-compact-icon-action" href={`mailto:${client.email}`} aria-label={`Email ${client.full_name}`} title="Email client"><Mail /></a>}
              {client.phone && <a className="wn-compact-icon-action" href={`tel:${client.phone}`} aria-label={`Call ${client.full_name}`} title="Call client"><Phone /></a>}
            </>
          )}
          <button type="button" className="wn-overview-toggle" onClick={toggleExpanded} aria-expanded={expanded} aria-controls="client-overview-details">
            {expanded ? <ChevronUp /> : <ChevronDown />}
          </button>
        </div>
      </div>

      {expanded && (
        <div id="client-overview-details" className="wn-overview-details">
          <div className="wn-overview-section wn-overview-contact">
            <h2>Contact</h2>
            <dl className="wn-overview-field-list">
              <OverviewFact
                icon={<Mail />}
                iconAction={client.email ? <a className="wn-utility-icon wn-email-icon" href={`mailto:${client.email}`} aria-label={`Email ${client.full_name}`}><Mail /></a> : undefined}
                label="Email"
                value={client.email ?? "Not provided"}
                href={client.email ? `mailto:${client.email}` : undefined}
              />
              <OverviewFact icon={<Phone />} label="Phone" value={client.phone ?? "Not provided"} href={client.phone ? `tel:${client.phone}` : undefined} />
            </dl>
            <div className="wn-overview-emergency">
              <span className="wn-utility-icon"><UserRound /></span>
              <EmergencyContactEditor clientId={client.id} initialName={client.emergency_contact_name} initialRelationship={client.emergency_contact_relationship} initialPhone={client.emergency_contact_phone} overview />
            </div>
          </div>

          <div className="wn-overview-section wn-overview-journey">
            <h2>Client relationship</h2>
            <dl className="wn-overview-text-grid">
              <ProfileFact label="Client since" value={formatDate(client.created_at)} />
              <ProfileFact label="Referral source" value={referral?.name ?? "Direct inquiry"} />
              <ProfileFact className="wn-overview-package" label="Package" value={client.package_name ?? "Not assigned"} />
            </dl>
          </div>

          <div className="wn-overview-section wn-overview-operations">
            <h2>Operational</h2>
            <dl className="wn-overview-field-list">
              <OverviewFact icon={<CalendarDays />} label="Next session" value={nextSessionLabel} tone={nextSession ? "next-session" : undefined} />
              <OverviewFact
                icon={<CircleDollarSign />}
                label="Payment status"
                value={paymentLabel}
                note={`${formatCurrency(client.amount_paid)} of ${formatCurrency(client.package_value)}`}
                action={<RecordPaymentButton clientId={client.id} outstanding={balance} />}
                tone={balance > 0 ? "attention" : "positive"}
              />
              <OverviewFact
                icon={client.portal_password_hash ? <CheckCircle2 /> : <KeyRound />}
                label="Portal access"
                value={client.portal_password_hash ? "Account active" : "Not set up"}
                note={client.portal_email}
                action={client.portal_password_hash ? <ResetPortalPasswordButton clientId={client.id} clientName={client.full_name} inline /> : undefined}
                tone={client.portal_password_hash ? "positive" : "attention"}
              />
            </dl>
          </div>

          <footer className="wn-overview-actions">
            <div className="wn-overview-action-buttons">
              <ClientHeaderActions {...introActionProps} />
              <HoldControl kind="client" recordId={client.id} name={client.full_name} onHold={Boolean(client.on_hold_at)} followUpAt={client.hold_follow_up_at} reason={client.hold_reason} />
              <QuickNoteButton clientId={client.id} clientName={client.full_name} />
              <DeleteClientButton clientId={client.id} clientName={client.full_name} />
            </div>
          </footer>
        </div>
      )}
    </section>
  );
}

function ProfileFact({ className, label, value }: { className?: string; label: string; value: string }) {
  return <div className={className}><dt>{label}</dt><dd>{value}</dd></div>;
}

function OverviewFact({ icon, iconAction, label, value, note, href, action, tone }: {
  icon: React.ReactElement;
  iconAction?: React.ReactNode;
  label: string;
  value: string;
  note?: string;
  href?: string;
  action?: React.ReactNode;
  tone?: "next-session" | "attention" | "positive";
}) {
  return (
    <div className={cx("wn-overview-fact", tone && `is-${tone}`)}>
      {iconAction ?? <span className="wn-utility-icon">{icon}</span>}
      <div className="min-w-0">
        <dt>{label}</dt>
        <dd title={value}>{href ? <a className={href.startsWith("mailto:") ? "wn-email-link" : undefined} href={href}>{value}</a> : value}</dd>
        {note && <small>{note}</small>}
        {action}
      </div>
    </div>
  );
}

function CompactFact({ label, value, href, tone }: { label: string; value: string; href?: string; tone?: "success" | "warning" }) {
  return (
    <div className="wn-compact-fact" data-tone={tone} style={{ paddingInline: 8 }}>
      <div>
        <small>{label}</small>
        <strong title={value}>{href ? <a href={href}>{value}</a> : value}</strong>
      </div>
    </div>
  );
}
