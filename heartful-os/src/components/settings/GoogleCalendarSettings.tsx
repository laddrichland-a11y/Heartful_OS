"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { disconnectGoogleCalendarAction, syncGoogleCalendarNowAction } from "@/lib/actions";
import { formatDateTime } from "@/lib/utils";
import { CalendarDays } from "@/components/ui/HeartfulIcon";

export default function GoogleCalendarSettings({
  configured, connected, connectedEmail, lastSyncedAt, lastSyncError, flash,
}: {
  configured: boolean;
  connected: boolean;
  connectedEmail?: string;
  lastSyncedAt?: string;
  lastSyncError?: string;
  flash?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [managed, setManaged] = useState(false);
  const [status, setStatus] = useState({ lastSyncedAt, lastSyncError });
  const [actionError, setActionError] = useState("");

  function disconnect() {
    if (!confirm("Disconnect Google Calendar? Sessions and prospect calls will stop syncing until you reconnect.")) return;
    startTransition(async () => {
      try {
        await disconnectGoogleCalendarAction();
      } catch {
        setActionError("Could not disconnect Google Calendar. Try again.");
      }
    });
  }

  function syncNow() {
    startTransition(async () => {
      try {
        const updated = await syncGoogleCalendarNowAction();
        setStatus({ lastSyncedAt: updated.last_synced_at, lastSyncError: updated.last_sync_error });
        setActionError("");
      } catch {
        setActionError("Could not sync Google Calendar. Try again.");
      }
    });
  }

  return (
    <div className="settings-block settings-calendar">
      <div className="settings-calendar-main">
        <div>
          <div className="settings-calendar-title-row">
            <h3 className="settings-heading"><CalendarDays aria-hidden="true" />Google Calendar</h3>
            <span className={`settings-status ${connected ? "settings-status-connected" : ""}`}>
              {connected ? "Connected" : "Not connected"}
            </span>
          </div>
          <p className="settings-description">Keep Heartful sessions and your Google Calendar in sync.</p>
          {connected && connectedEmail && <p className="settings-connected-email">{connectedEmail}</p>}
        </div>
        <div className="settings-calendar-controls">
          {connected ? (
            <div className="settings-calendar-actions">
              <button type="button" className="settings-outline-button" onClick={() => setManaged((value) => !value)} aria-expanded={managed}>Manage</button>
              <button type="button" className="settings-text-button" onClick={disconnect} disabled={pending}>Disconnect</button>
            </div>
          ) : configured ? (
            <a href="/api/integrations/google/connect" className="btn-primary">Connect Google Calendar</a>
          ) : (
            <button type="button" className="btn-primary" disabled title="Google Calendar connection is currently unavailable">Connect Google Calendar</button>
          )}
        </div>
      </div>
      {flash === "connected" && <p className="settings-success" role="status">Google Calendar connected. <Link href="/settings">Dismiss</Link></p>}
      {flash === "error" && <p className="settings-error" role="alert">Could not connect Google Calendar. Please try again. <Link href="/settings">Dismiss</Link></p>}
      {flash === "not_configured" && <p className="settings-error" role="alert">Google Calendar connection is currently unavailable.</p>}
      {actionError && <p className="settings-error" role="alert">{actionError}</p>}
      {connected && managed && (
        <div className="settings-calendar-details">
          <span>{status.lastSyncedAt ? `Last synced ${formatDateTime(status.lastSyncedAt)}` : "Not synced yet"}</span>
          <button type="button" className="settings-outline-button" onClick={syncNow} disabled={pending}>{pending ? "Syncing…" : "Sync now"}</button>
          {status.lastSyncError && <p className="settings-error" role="alert">Last sync error: {status.lastSyncError}</p>}
        </div>
      )}
    </div>
  );
}
