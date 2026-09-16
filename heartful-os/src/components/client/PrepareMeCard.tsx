"use client";

import { useState } from "react";
import AiGenerateButton from "@/components/ai/AiGenerateButton";
import SummaryCard from "@/components/ai/SummaryCard";
import { AiSummary } from "@/lib/types";
import { FileText } from "lucide-react";

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
    <section className="client-surface mb-6 overflow-hidden border-l-[3px] border-l-plum-500">
      <div className="flex flex-wrap items-start justify-between gap-5 px-5 py-5">
        <div className="max-w-2xl">
          <p className="client-eyebrow text-plum-600">AI Session Brief</p>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold text-ink-900">
            <FileText className="h-5 w-5 text-plum-600" /> Prepare for {sessionTypeLabel}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-500">
            A concise briefing based on the client&apos;s intake, previous sessions, intentions, recent themes, risks, and open threads.
          </p>
        </div>
      <AiGenerateButton
        clientId={clientId}
        summaryType="prepare_me_briefing"
        label="Generate Brief"
        icon="document"
        extra={{ sessionTypeLabel, ...(sessionId ? { sessionId } : {}) }}
        onDone={(s) => setBriefing(s as unknown as AiSummary)}
        />
      </div>
      {briefing && (
        <div className="border-t border-ink-100 px-5 py-5">
          <SummaryCard title="AI Session Brief" content={briefing.content} model={briefing.model} />
        </div>
      )}
      {!briefing && (
        <div className="grid border-t border-ink-100 bg-ink-50/30 sm:grid-cols-2 xl:grid-cols-5">
          {["Context", "Intentions", "Recent themes", "Risks / considerations", "Suggested focus"].map((section) => (
            <div key={section} className="min-h-[78px] border-b border-ink-100 px-4 py-4 last:border-b-0 sm:border-r xl:border-b-0 xl:last:border-r-0">
              <p className="text-xs font-semibold text-ink-700">{section}</p>
              <span className="mt-2 block h-1.5 w-12 rounded-full bg-ink-100" />
              <span className="mt-1.5 block h-1.5 w-20 max-w-full rounded-full bg-ink-100" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
