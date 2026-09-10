"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarDays, RefreshCw, Unplug, CheckCircle2, AlertTriangle } from "lucide-react";
import { disconnectGoogleCalendarAction, syncGoogleCalendarNowAction } from "@/lib/actions";
import { formatDateTime } from "@/lib/utils";

export default function GoogleCalendarSettings({
  configured,
  connected,
  connectedEmail,
  lastSyncedAt,
  lastSyncError,
  flash,
  flashReason,
}: {
  configured: boolean;
  connected: boolean;
  connectedEmail?: string;
  lastSyncedAt?: string;
  lastSyncError?: string;
  flash?: string;
  flashReason?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState({ lastSyncedAt, lastSyncError });

  function disconnect() {
    if (!confirm("Disconnect Google Calendar? Sessions and prospect calls will stop syncing until you reconnect.")) return;
    startTransition(async () => {
      await disconnectGoogleCalendarAction();
    });
  }

  function syncNow() {
    startTransition(async () => {
      const updated = await syncGoogleCalendarNowAction();
      setStatus({ lastSyncedAt: updated.last_synced_at, lastSyncError: updated.last_sync_error });
    });
  }

  return (
    <div className="card p-5 space-y-3 lg:col-span-2">
      <h2 className="font-semibold text-ink-900 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-clay-500" /> Google Calendar Sync
      </h2>

      {flash === "connected" && (
        <div className="text-xs bg-sage-50 text-sage-700 rounded-lg px-3 py-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Google Calendar connected.</span>
          <Link href="/settings" className="underline">Dismiss</Link>
        </div>
      )}
      {flash === "error" && (
        <div className="text-xs bg-red-50 text-red-700 rounded-lg px-3 py-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Couldn&apos;t connect: {flashReason ?? "unknown error"}</span>
          <Link href="/settings" className="underline">Dismiss</Link>
        </div>
      )}
      {flash === "not_configured" && (
        <div className="text-xs bg-amber-50 text-amber-700 rounded-lg px-3 py-2">
          Google OAuth isn&apos;t configured yet — see the setup instructions below.
        </div>
      )}

      {!configured && (
        <p className="text-sm text-ink-500">
          Not set up yet. Add <code className="bg-ink-50 px-1 rounded">GOOGLE_CLIENT_ID</code>,{" "}
          <code className="bg-ink-50 px-1 rounded">GOOGLE_CLIENT_SECRET</code>, and{" "}
          <code className="bg-ink-50 px-1 rounded">GOOGLE_REDIRECT_URI</code> as environment variables to enable this.
        </p>
      )}

      {configured && !connected && (
        <div className="space-y-2">
          <p className="text-sm text-ink-500">
            Not connected. Connect your Google Calendar so Sessions and Prospect Calls sync both ways automatically.
          </p>
          <a href="/api/integrations/google/connect" className="btn-primary text-sm px-3 py-1.5 inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" /> Connect Google Calendar
          </a>
        </div>
      )}

      {configured && connected && (
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-ink-700">
              <CheckCircle2 className="h-4 w-4 text-sage-600" /> Connected
            </span>
            {connectedEmail && <span className="text-ink-500 text-xs">{connectedEmail}</span>}
          </div>
          <p className="text-xs text-ink-400">
            Sessions and prospect calls sync to a dedicated &quot;Heartful OS&quot; calendar. Your primary calendar is watched
            (read-only) so scheduling here always checks for conflicts with your other commitments.
          </p>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-ink-400">
              {status.lastSyncedAt ? `Last synced ${formatDateTime(status.lastSyncedAt)}` : "Not synced yet"}
            </span>
            <div className="flex gap-2">
              <button onClick={syncNow} disabled={pending} className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1">
                <RefreshCw className={pending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> Sync now
              </button>
              <button onClick={disconnect} disabled={pending} className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1 text-red-600 hover:bg-red-50">
                <Unplug className="h-3.5 w-3.5" /> Disconnect
              </button>
            </div>
          </div>
          {status.lastSyncError && (
            <p className="text-xs text-red-600">Last sync error: {status.lastSyncError}</p>
          )}
        </div>
      )}
    </div>
  );
}
