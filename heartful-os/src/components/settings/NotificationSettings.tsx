"use client";

import { useEffect, useState } from "react";
import { Bell } from "@/components/ui/HeartfulIcon";

const STORAGE_KEY = "heartful-notification-preferences";
const items = [
  ["sessions", "Upcoming session reminders"],
  ["forms", "Outstanding forms & tasks"],
  ["activity", "New client / prospect activity"],
] as const;
type Key = typeof items[number][0];
type Preferences = Record<Key, boolean>;
const defaults: Preferences = { sessions: true, forms: true, activity: true };

export default function NotificationSettings() {
  const [preferences, setPreferences] = useState(defaults);

  /* Browser storage is read after the server render. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Preferences>;
      setPreferences({ ...defaults, ...stored });
    } catch {
      setPreferences(defaults);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function toggle(key: Key) {
    setPreferences((previous) => {
      const next = { ...previous, [key]: !previous[key] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Keep the session preference. */ }
      return next;
    });
  }

  return (
    <section className="settings-block settings-notifications-block" aria-labelledby="notifications-heading">
      <h3 id="notifications-heading" className="settings-heading"><Bell aria-hidden="true" />Notification</h3>
      <div className="settings-notification-list">
        {items.map(([key, label]) => (
          <label className="settings-row settings-notification-row" key={key}>
            <span>{label}</span>
            <input type="checkbox" role="switch" checked={preferences[key]} onChange={() => toggle(key)} />
          </label>
        ))}
      </div>
    </section>
  );
}
