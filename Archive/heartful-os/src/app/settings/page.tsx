import AppShell from "@/components/layout/AppShell";
import { getPractitioner, getReferralSources, getGoogleCalendarSettings } from "@/lib/data";
import { isFirebaseConfigured } from "@/lib/firebaseAdmin";
import { isGoogleOAuthConfigured } from "@/lib/googleCalendar";
import { Building2, KeyRound, Database, Sparkles, FileText, ArrowRight } from "lucide-react";
import Link from "next/link";
import PracticeProfileForm from "@/components/settings/PracticeProfileForm";
import VenmoSettingsForm from "@/components/settings/VenmoSettingsForm";
import ReferralSourcesManager from "@/components/settings/ReferralSourcesManager";
import GoogleCalendarSettings from "@/components/settings/GoogleCalendarSettings";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; reason?: string }>;
}) {
  const [practitioner, referralSources, googleSettings, { google: googleFlash, reason: googleFlashReason }] = await Promise.all([
    getPractitioner(),
    getReferralSources(),
    getGoogleCalendarSettings(),
    searchParams,
  ]);
  const hasOpenAiKey = !!process.env.OPENAI_API_KEY;

  return (
    <AppShell title="Settings">
      <Link href="/dashboard" className="text-sm text-ink-400 hover:text-ink-700 flex items-center gap-1 mb-5">
        ← Dashboard
      </Link>
      <div className="grid lg:grid-cols-2 gap-6 max-w-4xl">
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-ink-900 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-clay-500" /> Practice Profile
          </h2>
          <PracticeProfileForm
            profile={{
              full_name: practitioner.full_name,
              practice_name: practitioner.practice_name,
              email: practitioner.email,
              phone: practitioner.phone,
            }}
          />
          <div className="pt-2 border-t border-ink-100">
            <VenmoSettingsForm venmoHandle={practitioner.venmo_handle} />
          </div>
        </div>

        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-ink-900 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-clay-500" /> Integrations
          </h2>
          <div className="text-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-ink-700"><Database className="h-4 w-4 text-ink-400" /> Firestore Database</span>
              <span className={`badge ${isFirebaseConfigured ? "bg-sage-100 text-sage-700" : "bg-ink-100 text-ink-500"}`}>
                {isFirebaseConfigured ? "Connected" : "Mock data mode"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-ink-700"><Sparkles className="h-4 w-4 text-ink-400" /> AI Summaries</span>
              <span className={`badge ${hasOpenAiKey ? "bg-sage-100 text-sage-700" : "bg-ink-100 text-ink-500"}`}>
                {hasOpenAiKey ? "Connected" : "Mock AI mode"}
              </span>
            </div>
          </div>
          {!isFirebaseConfigured && (
            <p className="text-xs text-ink-400 pt-1">
              Running on in-memory mock data — add Firebase credentials in <code className="bg-ink-50 px-1 rounded">.env.local</code> to switch over.
            </p>
          )}
        </div>

        <Link
          href="/settings/forms"
          className="card p-5 space-y-3 lg:col-span-2 flex items-center justify-between hover:border-clay-200 transition-colors"
        >
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-clay-500" />
            <div>
              <h2 className="font-semibold text-ink-900">Form Library</h2>
              <p className="text-sm text-ink-500">Manage which consents &amp; intake forms auto-attach to new clients.</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-ink-400" />
        </Link>

        <div className="card p-5 space-y-3 lg:col-span-2">
          <h2 className="font-semibold text-ink-900">Referral Sources</h2>
          <p className="text-xs text-ink-400">Add or remove sources that appear in the new client form.</p>
          <ReferralSourcesManager initial={referralSources} />
        </div>

        <GoogleCalendarSettings
          configured={isGoogleOAuthConfigured}
          connected={googleSettings.connected}
          connectedEmail={googleSettings.connected_email}
          lastSyncedAt={googleSettings.last_synced_at}
          lastSyncError={googleSettings.last_sync_error}
          flash={googleFlash}
          flashReason={googleFlashReason}
        />
      </div>
    </AppShell>
  );
}
