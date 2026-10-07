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
import ActionCardHeader from "@/components/client/ActionCardHeader";
import SummaryVersions from "@/components/ai/SummaryVersions";
import { useStageNotes } from "@/components/ai/useStageNotes";
import { ScrollText } from "@/components/ui/HeartfulIcon";
import StageFormsCard from "@/components/client/StageFormsCard";

export default function PreparationWorkspace({
  clientId,
  clientName,
  documents,
  formTemplates,
  formSubmissions,
  existingBriefs,
  initialNotes,
  initialRecordings = [],
  canCompleteStage,
}: {
  clientId: string;
  clientName: string;
  documents: ClientDocument[];
  formTemplates: FormTemplate[];
  formSubmissions: FormSubmission[];
  /** Every Journey Brief generated so far, newest first. */
  existingBriefs: AiSummary[];
  /** Notes already saved on the client record for this stage. */
  initialNotes: string;
  /** Recordings already uploaded on this stage page. */
  initialRecordings?: Recording[];
  canCompleteStage: boolean;
}) {
  // Saved to the client record as you type, and kept after generating.
  const { notes, setNotes, saveState } = useStageNotes(clientId, "preparation", initialNotes);
  const [briefs, setBriefs] = useState(existingBriefs);

  return (
    <div className="space-y-6">
      <StageFormsCard
        clientId={clientId}
        sessionType="preparation"
        formTemplates={formTemplates}
        documents={documents}
        formSubmissions={formSubmissions}
      />

      <div className="card p-4 space-y-3">
        <ActionCardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <ScrollText className="h-4 w-4" aria-hidden="true" />
              Session Notes &amp; Transcript
            </span>
          }
          titleAs="h2"
          description={`Your notes are saved to ${clientName}'s record as you type. Generate a Journey Brief from them for use on Journey Day — each one is kept as a new version.`}
          action={
            <AiGenerateButton
              clientId={clientId}
              summaryType="journey_brief"
              label={briefs.length > 0 ? "Generate New Version" : "Generate Journey Brief"}
              extra={{ transcript: notes, stageNotesKey: "preparation" }}
              onDone={(s) => setBriefs((prev) => [s as unknown as AiSummary, ...prev])}
              disabled={!canCompleteStage || !notes.trim()}
              className="btn-primary inline-flex items-center gap-2 whitespace-nowrap text-sm disabled:opacity-60"
            />
          }
        />
        <TranscriptInput clientId={clientId} stage="preparation" initialRecordings={initialRecordings} value={notes} onChange={setNotes} saveState={saveState} hideLabel inlineUploadActions />
      </div>

      <SummaryVersions
        clientId={clientId}
        summaries={briefs}
        onChange={setBriefs}
        heading="Journey Brief"
        description={`Every Journey Brief generated for ${clientName}, newest first. Open "Notes this version was generated from" to see what each one was based on.`}
        cardTitle="Journey Brief"
        variant="journey"
      />

    </div>
  );
}
