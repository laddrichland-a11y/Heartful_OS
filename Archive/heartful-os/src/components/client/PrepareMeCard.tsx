"use client";

import { useState } from "react";
import AiGenerateButton from "@/components/ai/AiGenerateButton";
import SummaryCard from "@/components/ai/SummaryCard";
import { AiSummary } from "@/lib/types";
import { CalendarClock } from "lucide-react";

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
  sessionId,
  existing,
}: {
  clientId: string;
  sessionTypeLabel: string;
  sessionId?: string;
  existing?: AiSummary;
}) {
  const [briefing, setBriefing] = useState<AiSummary | undefined>(existing);

  return (
    <div className="card p-5 mb-6">
      <h2 className="font-semibold text-ink-900 mb-1 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-clay-500" /> Prepare Me For This Session
      </h2>
      <p className="text-xs text-ink-400 mb-4">
        A pre-session briefing for {sessionTypeLabel} — who this client is, why they&apos;re here, intentions,
        risks, and what to focus on today, pulled from their full record.
      </p>
      <AiGenerateButton
        clientId={clientId}
        summaryType="prepare_me_briefing"
        label="Prepare Me"
        extra={{ sessionTypeLabel, ...(sessionId ? { sessionId } : {}) }}
        onDone={(s) => setBriefing(s as unknown as AiSummary)}
      />
      {briefing && (
        <div className="mt-4">
          <SummaryCard title="Pre-Session Briefing" content={briefing.content} model={briefing.model} />
        </div>
      )}
    </div>
  );
}
