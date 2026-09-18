import AppShell from "@/components/layout/AppShell";
import { getPractitioner, getReferralSources, getGoogleCalendarSettings } from "@/lib/data";
import { isGoogleOAuthConfigured } from "@/lib/googleCalendar";
import { ArrowRight, DollarSign, Tag, UserRound } from "@/components/ui/HeartfulIcon";
import Link from "next/link";
import PracticeProfileForm from "@/components/settings/PracticeProfileForm";
import VenmoSettingsForm from "@/components/settings/VenmoSettingsForm";
import ReferralSourcesManager from "@/components/settings/ReferralSourcesManager";
import GoogleCalendarSettings from "@/components/settings/GoogleCalendarSettings";
import ThemeSettings from "@/components/settings/ThemeSettings";
import NotificationSettings from "@/components/settings/NotificationSettings";
import "./settings.css";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: {
  searchParams: Promise<{ google?: string }>;
}) {
  const [practitioner, referralSources, googleSettings, { google: googleFlash }] = await Promise.all([
    getPractitioner(), getReferralSources(), getGoogleCalendarSettings(), searchParams,
  ]);

  return (
    <AppShell title="Settings">
      <div className="settings-page">
        <div className="settings-groups">
          <section className="settings-group" aria-label="Practice">
            <div className="settings-container">
              <div className="settings-block">
                <h3 className="settings-heading"><UserRound aria-hidden="true" />Practice</h3>
                <PracticeProfileForm profile={{
                  full_name: practitioner.full_name,
                  practice_name: practitioner.practice_name,
                  email: practitioner.email,
                  phone: practitioner.phone,
                }} />
              </div>
            </div>
            <div className="settings-container">
              <div className="settings-block">
                <h3 className="settings-heading"><DollarSign aria-hidden="true" />Payments</h3>
                <VenmoSettingsForm venmoHandle={practitioner.venmo_handle} paymentMethods={practitioner.payment_methods} />
              </div>
            </div>
          </section>
          <section className="settings-group" aria-label="Appearance">
            <div className="settings-container"><ThemeSettings /></div>
            <div className="settings-container"><NotificationSettings /></div>
          </section>
          <section className="settings-group" aria-label="Client setup">
            <div className="settings-container">
              <Link href="/settings/forms" className="settings-nav-row">
                <span><strong>Form Library</strong><small>Manage intake forms, consents and forms assigned to new clients.</small></span>
                <span className="settings-nav-action">Manage <ArrowRight size={15} aria-hidden="true" /></span>
              </Link>
            </div>
            <div className="settings-container">
              <div className="settings-block">
                <h3 className="settings-heading"><Tag aria-hidden="true" />Referral Sources</h3>
                <p className="settings-description">Sources available when adding a new client.</p>
                <ReferralSourcesManager initial={referralSources} />
              </div>
            </div>
          </section>
          <section className="settings-group" aria-label="Integrations">
            <div className="settings-container">
              <GoogleCalendarSettings configured={isGoogleOAuthConfigured} connected={googleSettings.connected} connectedEmail={googleSettings.connected_email} lastSyncedAt={googleSettings.last_synced_at} lastSyncError={googleSettings.last_sync_error} flash={googleFlash} />
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
