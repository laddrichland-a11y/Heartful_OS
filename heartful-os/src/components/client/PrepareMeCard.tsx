"use client";

import { useEffect, useRef, useState } from "react";
import AiGenerateButton from "@/components/ai/AiGenerateButton";
import { SessionBriefContent } from "@/components/ai/SummaryCard";
import { AiSummary } from "@/lib/types";
import { FileText } from "@/components/ui/HeartfulIcon";

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
}: {
  clientId: string;
  sessionTypeLabel: string;
  clientName?: string;
  sessionId?: string;
  existing?: AiSummary;
  autoGenerate?: boolean;
}) {
  const [briefing, setBriefing] = useState<AiSummary | undefined>(existing);
  const [activated, setActivated] = useState(Boolean(existing));
  const autoStarted = useRef(false);
  const buttonId = `prepare-me-generate-${clientId}`;

  useEffect(() => {
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
  }, [autoGenerate, buttonId, clientId]);

  if (!activated && !briefing) return <div id="prepare-me" aria-hidden="true" />;

  return (
    <section id="prepare-me" className="client-surface ai-session-brief-shell mb-6 scroll-mt-5" aria-label="AI Session Brief">
      <div className="ai-session-brief-shell-header">
        <div className="min-w-0">
          <h2>
            <FileText aria-hidden="true" /> AI Session Brief
          </h2>
          <p>{sessionTypeLabel}{clientName ? ` · ${clientName}` : ""}</p>
        </div>
        <div className="shrink-0">
          <AiGenerateButton
            clientId={clientId}
            summaryType="prepare_me_briefing"
            label={briefing ? "Regenerate" : "Generate Brief"}
            icon="document"
            buttonId={buttonId}
            className="ai-session-brief-generate"
            extra={{ sessionTypeLabel, ...(sessionId ? { sessionId } : {}) }}
            onDone={(s) => setBriefing(s as unknown as AiSummary)}
          />
        </div>
      </div>
      {briefing && (
        <div className="ai-session-brief-shell-body">
          <SessionBriefContent content={briefing.content} />
        </div>
      )}
    </section>
  );
}
