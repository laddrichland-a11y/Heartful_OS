"use client";

import { useEffect, useState } from "react";
import { Check, Sparkles } from "@/components/ui/HeartfulIcon";

const THEME_KEY = "heartful-theme";
export type Theme = "golden-canopy" | "mushroom-grove" | "dark";

export const THEMES: { value: Theme; label: string }[] = [
  { value: "golden-canopy", label: "Golden Canopy" },
  { value: "mushroom-grove", label: "Mushroom Grove" },
  { value: "dark", label: "Dark" },
];

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
}

export function getSavedTheme(): Theme {
  try {
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    if (savedTheme === "golden-canopy" || savedTheme === "mushroom-grove" || savedTheme === "dark") return savedTheme;
    if (savedTheme === "light") {
      window.localStorage.setItem(THEME_KEY, "golden-canopy");
      return "golden-canopy";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "golden-canopy";
  } catch {
    return "golden-canopy";
  }
}

export function saveTheme(theme: Theme) {
  applyTheme(theme);
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // The preference remains active for this session when storage is unavailable.
  }
}

/** Applies the persisted preference before a practitioner page is displayed. */
export function ThemeBootstrap() {
  useEffect(() => {
    applyTheme(getSavedTheme());
  }, []);

  return null;
}

export function ThemeOptions({ theme, onSelect }: { theme: Theme; onSelect: (theme: Theme) => void }) {
  return (
    <div className="settings-theme-options" role="group" aria-label="Color theme">
      {THEMES.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          className="settings-theme-option"
          data-selected={theme === value ? "true" : "false"}
          onClick={() => onSelect(value)}
          aria-pressed={theme === value}
        >
          {theme === value && (
            <span className="settings-theme-check" aria-hidden="true">
              <Check className="h-3 w-3" />
            </span>
          )}
          <span className="settings-theme-preview" data-preview-theme={value} aria-hidden="true">
            <span className="settings-theme-preview-sidebar"><i /><i /><i /></span>
            <span className="settings-theme-preview-page">
              <span className="settings-theme-preview-heading" />
              <span className="settings-theme-preview-card"><i /><i /></span>
              <span className="settings-theme-preview-card"><i /><i /></span>
            </span>
          </span>
          <span className="settings-theme-label">{label}</span>
        </button>
      ))}
    </div>
  );
}

export default function ThemeSettings() {
  const [theme, setTheme] = useState<Theme>("golden-canopy");

  /* Browser storage is intentionally read after the server render. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setTheme(getSavedTheme());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function selectTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    saveTheme(nextTheme);
  }

  return (
    <section className="settings-block settings-theme-block" aria-label="Theme">
      <div className="settings-row settings-theme-row">
        <div className="settings-theme-intro">
          <h3 className="settings-heading"><Sparkles aria-hidden="true" />Theme</h3>
          <p className="settings-description">Choose how Heartful looks across your workspace.</p>
        </div>
        <ThemeOptions theme={theme} onSelect={selectTheme} />
      </div>
    </section>
  );
}
