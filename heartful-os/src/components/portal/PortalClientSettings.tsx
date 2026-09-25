"use client";

import { useState, useTransition } from "react";
import { portalLogoutAction, updatePortalProfileAction } from "@/lib/actions";
import type { Client } from "@/lib/types";
import { CheckCircle2, FileText, LogOut, Mail, Settings, UserRound } from "@/components/ui/HeartfulIcon";
import { getSavedTheme, saveTheme, ThemeOptions, type Theme } from "@/components/settings/ThemeSettings";

const NOTIFICATIONS = [
  { key: "appointments", label: "Appointment reminders", description: "Reminders about upcoming sessions." },
  { key: "forms", label: "Forms & check-ins", description: "When something is ready for you to complete." },
  { key: "messages", label: "New messages", description: "When your practitioner sends a message." },
  { key: "journey", label: "Journey / integration reminders", description: "Gentle prompts for your next step." },
] as const;

function storageKey(clientId: string) {
  return `heartful-portal-preferences-${clientId}`;
}

function savedPreferences(clientId: string) {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(storageKey(clientId)) ?? "{}") as {
      notifications?: Record<string, boolean>;
      theme?: Theme;
    };
  } catch {
    return {};
  }
}

export default function PortalClientSettings({
  client,
  onSaved,
  onViewAgreements,
}: {
  client: Client;
  onSaved: () => void;
  onViewAgreements: () => void;
}) {
  const [fullName, setFullName] = useState(client.full_name);
  const [email, setEmail] = useState(client.email ?? client.portal_email ?? "");
  const [phone, setPhone] = useState(client.phone ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = savedPreferences(client.id).theme;
    return saved === "golden-canopy" || saved === "mushroom-grove" || saved === "original" || saved === "dark"
      ? saved
      : getSavedTheme();
  });
  const [notifications, setNotifications] = useState<Record<string, boolean>>(() => ({
    appointments: true,
    forms: true,
    messages: true,
    journey: true,
    ...savedPreferences(client.id).notifications,
  }));
  const [isPending, startTransition] = useTransition();

  function saveLocal(nextNotifications: Record<string, boolean>, nextTheme: Theme) {
    try {
      window.localStorage.setItem(storageKey(client.id), JSON.stringify({ notifications: nextNotifications, theme: nextTheme }));
    } catch {
      // Controls still work until the client closes this page.
    }
  }

  function updateNotification(key: string, value: boolean) {
    const next = { ...notifications, [key]: value };
    setNotifications(next);
    saveLocal(next, theme);
  }

  function selectTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    saveTheme(nextTheme);
    saveLocal(notifications, nextTheme);
  }

  function saveProfile() {
    setMessage(null);
    startTransition(async () => {
      const result = await updatePortalProfileAction(client.id, { full_name: fullName, email, phone });
      setMessage(result.ok ? "Changes saved." : result.error ?? "We couldn’t save your changes.");
      if (result.ok) onSaved();
    });
  }

  return (
    <div className="portal-client-settings" aria-label="Client settings">
      <section className="portal-settings-card portal-settings-card--profile">
        <div className="portal-settings-card-heading">
          <span className="portal-settings-icon" aria-hidden="true"><UserRound /></span>
          <div><h2>Profile &amp; Contact</h2><p>Keep your contact details up to date.</p></div>
        </div>
        <div className="portal-settings-fields">
          <label><span>Full name</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" /></label>
          <label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
          <label><span>Phone</span><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" /></label>
        </div>
        <p className="portal-settings-note">Preferred name and time zone are not yet saved in your Heartful profile.</p>
        <div className="portal-settings-save-row">
          <button type="button" className="btn-primary" onClick={saveProfile} disabled={isPending}>{isPending ? "Saving…" : "Save changes"}</button>
          {message && <span className="portal-settings-save-message" role="status">{message}</span>}
        </div>
      </section>

      <section className="portal-settings-card">
        <div className="portal-settings-card-heading">
          <span className="portal-settings-icon" aria-hidden="true"><Mail /></span>
          <div><h2>Notifications</h2><p>Choose the reminders you want to see on this device.</p></div>
        </div>
        <div className="portal-settings-toggles">
          {NOTIFICATIONS.map((notification) => (
            <label className="portal-settings-toggle" key={notification.key}>
              <span><strong>{notification.label}</strong><small>{notification.description}</small></span>
              <input type="checkbox" checked={notifications[notification.key]} onChange={(event) => updateNotification(notification.key, event.target.checked)} />
            </label>
          ))}
        </div>
        <p className="portal-settings-note">Delivery channels aren&apos;t configurable in the portal yet.</p>
      </section>

      <section className="portal-settings-card portal-settings-card--appearance">
        <div className="portal-settings-card-heading">
          <span className="portal-settings-icon" aria-hidden="true"><Settings /></span>
          <div><h2>Appearance</h2><p>Choose how this portal looks.</p></div>
        </div>
        <ThemeOptions theme={theme} onSelect={selectTheme} />
      </section>

      <section className="portal-settings-card portal-settings-card--security">
        <div className="portal-settings-card-heading">
          <span className="portal-settings-icon" aria-hidden="true"><CheckCircle2 /></span>
          <div><h2>Privacy &amp; Security</h2><p>Manage the account actions available in your portal.</p></div>
        </div>
        <div className="portal-settings-actions">
          <button type="button" onClick={onViewAgreements}><FileText aria-hidden="true" />View signed agreements</button>
          <button type="button" className="portal-settings-logout" onClick={() => startTransition(async () => { await portalLogoutAction(client.id); })} disabled={isPending}><LogOut aria-hidden="true" />Log out</button>
        </div>
      </section>
    </div>
  );
}
