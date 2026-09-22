"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "@/components/ui/HeartfulIcon";

const CONTEXT_RAIL_COLLAPSED_KEY = "heartful-client-context-collapsed";
const DESKTOP_QUERY = "(min-width: 1001px)";

export default function ClientWorkspace({ children, rail }: { children: ReactNode; rail: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [desktop, setDesktop] = useState(true);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const updateDesktop = () => setDesktop(media.matches);
    // Browser-only preferences intentionally synchronize after server render.
    /* eslint-disable react-hooks/set-state-in-effect */
    updateDesktop();
    media.addEventListener("change", updateDesktop);
    try {
      setCollapsed(window.localStorage.getItem(CONTEXT_RAIL_COLLAPSED_KEY) === "true");
    } catch {
      // The control remains usable when browser storage is unavailable.
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => media.removeEventListener("change", updateDesktop);
  }, []);

  const hidden = desktop && collapsed;

  function toggleRail() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(CONTEXT_RAIL_COLLAPSED_KEY, String(next));
      } catch {
        // Keep the preference for this page without persistent storage.
      }
      return next;
    });
  }

  return (
    <div className="wn-client-page-grid" data-context-collapsed={hidden ? "true" : "false"}>
      {children}
      <div className="wn-context-rail-frame" id="client-context-panel" inert={hidden} aria-hidden={hidden}>
        {rail}
      </div>
      <button
        type="button"
        className="wn-context-rail-toggle"
        onClick={toggleRail}
        aria-label={hidden ? "Show context panel" : "Hide context panel"}
        title={hidden ? "Show context panel" : "Hide context panel"}
        aria-controls="client-context-panel"
        aria-expanded={!hidden}
      >
        {hidden ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
      </button>
    </div>
  );
}
