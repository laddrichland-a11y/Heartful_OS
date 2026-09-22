"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "@/components/ui/HeartfulIcon";

const CONTEXT_RAIL_COLLAPSED_KEY = "heartful-client-context-collapsed";

export default function ClientWorkspace({ children, rail }: { children: ReactNode; rail: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Browser-only preferences intentionally synchronize after server render.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      setCollapsed(window.localStorage.getItem(CONTEXT_RAIL_COLLAPSED_KEY) === "true");
    } catch {
      // The control remains usable when browser storage is unavailable.
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const hidden = collapsed;

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
      <div className="wn-context-rail-frame">
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
        <div id="client-context-panel" className="wn-context-rail-content" inert={hidden} aria-hidden={hidden}>
          {rail}
        </div>
      </div>
    </div>
  );
}
