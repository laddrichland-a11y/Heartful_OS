"use client";

import { useEffect, useRef, useState } from "react";
import AiGenerateButton from "@/components/ai/AiGenerateButton";
import { SessionBriefContent } from "@/components/ai/SummaryCard";
import { AiSummary } from "@/lib/types";
import { ChevronDown, ChevronUp, FileText } from "@/components/ui/HeartfulIcon";

/**
 * Prepare Me, on a stage page.
 *
 * `sessionId` is passed when the stage has a session on the calendar, so the
 * briefing is filed against that session and the stage page and the session
 * detail page stay in sync. Without one (a brand-new client with nothing
 * scheduled, or Growth Action Plan, which has no session) the API still
 * assembles the full client dump — the briefing is just as complete, it's
 * filed by stage label instead.
 */
export default function PrepareMeCard({
  clientId,
  sessionTypeLabel,
  clientName,
  sessionId,
  existing,
  autoGenerate = false,
  readOnly = false,
}: {
  clientId: string;
  sessionTypeLabel: string;
  clientName?: string;
  sessionId?: string;
  existing?: AiSummary;
  autoGenerate?: boolean;
  /**
   * Finished stage: show the briefing that was used to prepare, for
   * reference, with no Generate/Regenerate. Nothing renders if none was made.
   */
  readOnly?: boolean;
}) {
  const [briefing, setBriefing] = useState<AiSummary | undefined>(existing);
  const [activated, setActivated] = useState(Boolean(existing));
  const autoStarted = useRef(false);
  const buttonId = `prepare-me-generate-${clientId}`;
  // Hide/show the brief body. Remembered per client + stage in this browser.
  const hiddenKey = `heartful:prepare-me-hidden:${clientId}:${sessionTypeLabel}`;
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    // Read after mount (server render can't see localStorage) — deferred a
    // frame so it doesn't set state synchronously inside the effect.
    const frame = window.requestAnimationFrame(() => {
      try {
        setHidden(window.localStorage.getItem(hiddenKey) === "1");
      } catch {
        // Storage unavailable (private window etc.) — default to shown.
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hiddenKey]);

  function toggleHidden() {
    const next = !hidden;
    setHidden(next);
    try {
      if (next) window.localStorage.setItem(hiddenKey, "1");
      else window.localStorage.removeItem(hiddenKey);
    } catch {
      // Ignore storage failures; the toggle still works for this visit.
    }
  }

  useEffect(() => {
    if (readOnly) return;
    function generateBrief() {
      setActivated(true);
      window.requestAnimationFrame(() => {
        document.getElementById(buttonId)?.click();
        document.getElementById("prepare-me")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    window.addEventListener(`heartful:prepare-me:${clientId}`, generateBrief);
    if (autoGenerate && !autoStarted.current) {
      autoStarted.current = true;
      generateBrief();
    }
    return () => window.removeEventListener(`heartful:prepare-me:${clientId}`, generateBrief);
  }, [autoGenerate, buttonId, clientId, readOnly]);

  if (readOnly && !briefing) return null;
  if (!activated && !briefing) return <div id="prepare-me" aria-hidden="true" />;

  return (
    <section id="prepare-me" className="client-surface ai-session-brief-shell mb-6 scroll-mt-5" aria-label="AI Session Brief">
      <div className="ai-session-brief-shell-header">
        <div className="min-w-0">
          <h2>
            <FileText aria-hidden="true" /> AI Session Brief
          </h2>
          <p>
            {sessionTypeLabel}{clientName ? ` · ${clientName}` : ""}
            {readOnly ? " · What you used to prepare (read only)" : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {briefing && (
            <button
              type="button"
              onClick={toggleHidden}
              aria-expanded={!hidden}
              aria-controls={`prepare-me-body-${clientId}`}
              className="ai-session-brief-generate"
            >
              {hidden ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
              {hidden ? "Show brief" : "Hide brief"}
            </button>
          )}
          {!readOnly && (
          <AiGenerateButton
            clientId={clientId}
            summaryType="prepare_me_briefing"
            label={briefing ? "Regenerate" : "Generate Brief"}
            icon="document"
            buttonId={buttonId}
            className="ai-session-brief-generate"
            extra={{ sessionTypeLabel, ...(sessionId ? { sessionId } : {}) }}
            onDone={(s) => {
              setBriefing(s as unknown as AiSummary);
              // A fresh brief should be visible even if the old one was hidden.
              if (hidden) toggleHidden();
            }}
          />
          )}
        </div>
      </div>
      {briefing && !hidden && (
        <div id={`prepare-me-body-${clientId}`} className="ai-session-brief-shell-body">
          <SessionBriefContent content={briefing.content} />
        </div>
      )}
    </section>
  );
}
