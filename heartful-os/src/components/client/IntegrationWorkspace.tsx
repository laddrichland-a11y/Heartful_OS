"use client";

import { useState } from "react";
import {
  AiSummary,
  Recording,
  ClientDocument,
  FormSubmission,
  FormTemplate,
} from "@/lib/types";
import TranscriptInput from "@/components/ai/TranscriptInput";
import AiGenerateButton from "@/components/ai/AiGenerateButton";
import SummaryVersions from "@/components/ai/SummaryVersions";
import { useStageNotes } from "@/components/ai/useStageNotes";
import ActionCardHeader from "@/components/client/ActionCardHeader";
import { ScrollText, Sparkles } from "@/components/ui/HeartfulIcon";
import StageFormsCard from "@/components/client/StageFormsCard";

export default function IntegrationWorkspace({
  clientId,
  clientName,
  sessionNumber,
  documents,
  formTemplates,
  formSubmissions,
  existingSummaries,
  initialNotes,
  initialRecordings = [],
  canCompleteStage,
}: {
  clientId: string;
  clientName: string;
  sessionNumber: 1 | 2;
  documents: ClientDocument[];
  formTemplates: FormTemplate[];
  formSubmissions: FormSubmission[];
  /** Every summary generated for this integration session, newest first. */
  existingSummaries: AiSummary[];
  /** Notes already saved on the client record for this stage. */
  initialNotes: string;
  /** Recordings already uploaded on this stage page. */
  initialRecordings?: Recording[];
  canCompleteStage: boolean;
}) {
  // Saved to the client record as you type, and kept after generating.
  const { notes, setNotes, saveState } = useStageNotes(
    clientId,
    sessionNumber === 1 ? "integration_1" : "integration_2",
    initialNotes,
  );
  const [summaries, setSummaries] = useState(existingSummaries);

  // "Integration Summary" / "Second Integration Summary" — the button reads
  // `Generate ${summaryLabel}`.
  const summaryLabel = sessionNumber === 1 ? "Integration Summary" : "Second Integration Summary";

  return (
    <div className="space-y-6">
      <StageFormsCard
        clientId={clientId}
        sessionType={sessionNumber === 1 ? "integration_1" : "integration_2"}
        formTemplates={formTemplates}
        documents={documents}
        formSubmissions={formSubmissions}
      />

      {/* AI Generation — same shape for both sessions: paste the transcript,
          generate that session's summary. Pre-session preparation is Prepare
          Me's job now (it reads the whole record, including this session's
          reflection form), so Session One no longer carries a separate
          "Integration Session One Brief" button that did the same work with
          less context. Briefs already generated stay in the client record. */}
      <div className="card p-5 space-y-4">
        <h2 className="flex items-center gap-2 font-semibold text-ink-900"><ScrollText className="h-4 w-4 text-ink-500" />Session Notes &amp; Transcript</h2>
        <TranscriptInput clientId={clientId} stage={sessionNumber === 1 ? "integration_1" : "integration_2"} initialRecordings={initialRecordings} value={notes} onChange={setNotes} saveState={saveState} hideLabel />
      </div>
      <div className="card p-5 space-y-4">
        <ActionCardHeader
          title={<><Sparkles className="h-4 w-4 text-ink-500" />{summaryLabel}</>}
          description={`Generate from the notes above. Saves to the client record and completes Integration Session ${sessionNumber}. Each one is kept as a new version.`}
          action={
            <AiGenerateButton
              clientId={clientId}
              summaryType="integration_summary"
              label={summaries.length > 0 ? "Generate New Version" : `Generate ${summaryLabel}`}
              extra={{
                transcript: notes,
                integrationSession: sessionNumber,
                stageNotesKey: sessionNumber === 1 ? "integration_1" : "integration_2",
              }}
              onDone={(s) => setSummaries((prev) => [s as unknown as AiSummary, ...prev])}
              disabled={!canCompleteStage || !notes.trim()}
              className="btn-primary inline-flex items-center gap-2 whitespace-nowrap text-sm disabled:opacity-60"
            />
          }
        />
      </div>
      <SummaryVersions
        clientId={clientId}
        summaries={summaries}
        onChange={setSummaries}
        heading={summaryLabel}
        description={`Every ${summaryLabel.toLowerCase()} generated for ${clientName}, newest first.`}
        cardTitle={summaryLabel}
      />
    </div>
  );
}
