"use client";

import { useState } from "react";
import { AiSummary, CheckIn, ClientDocument, FormSubmission, FormTemplate, Recording } from "@/lib/types";
import TranscriptInput from "@/components/ai/TranscriptInput";
import AiGenerateButton from "@/components/ai/AiGenerateButton";
import SummaryVersions from "@/components/ai/SummaryVersions";
import { useStageNotes } from "@/components/ai/useStageNotes";
import ActionCardHeader from "@/components/client/ActionCardHeader";
import StageFormsCard from "@/components/client/StageFormsCard";
import { ScrollText, Sparkles } from "@/components/ui/HeartfulIcon";
import { formatDateTime } from "@/lib/utils";

const LEGACY_FIELDS: { key: keyof CheckIn; label: string }[] = [
  { key: "emotional_state", label: "Emotional State" },
  { key: "physical_state", label: "Physical State" },
  { key: "immediate_insights", label: "Immediate Insights" },
  { key: "support_needs", label: "Support Needs" },
  { key: "safety_concerns", label: "Safety Concerns" },
];

// The 12-Hour Check-In stage, laid out exactly like the other stages:
// Forms for This Session → Session Notes & Transcript (with the Session
// Recording box) → AI summary with every version kept.
export default function CheckInStageWorkspace({
  clientId,
  clientName,
  documents,
  formTemplates,
  formSubmissions,
  legacyCheckIn,
  existingSummaries,
  initialNotes,
  initialRecordings = [],
  canCompleteStage,
}: {
  clientId: string;
  clientName: string;
  documents: ClientDocument[];
  formTemplates: FormTemplate[];
  formSubmissions: FormSubmission[];
  /** A check-in recorded the older way (before it became a form), if any. */
  legacyCheckIn?: CheckIn;
  existingSummaries: AiSummary[];
  initialNotes: string;
  initialRecordings?: Recording[];
  canCompleteStage: boolean;
}) {
  const { notes, setNotes, saveState } = useStageNotes(clientId, "check_in_12hr", initialNotes);
  const [summaries, setSummaries] = useState(existingSummaries);
  const legacyEntries = legacyCheckIn?.submitted_at
    ? LEGACY_FIELDS.map(({ key, label }) => ({ label, value: String(legacyCheckIn[key] ?? "").trim() })).filter((e) => e.value)
    : [];

  return (
    <div className="space-y-6">
      <StageFormsCard
        clientId={clientId}
        sessionType="check_in_12hr"
        formTemplates={formTemplates}
        documents={documents}
        formSubmissions={formSubmissions}
      />

      {legacyEntries.length > 0 && (
        <details className="card p-4 text-sm">
          <summary className="cursor-pointer select-none font-medium text-ink-700">
            Check-in answers recorded earlier{legacyCheckIn?.submitted_at ? ` — ${formatDateTime(legacyCheckIn.submitted_at)}` : ""}
          </summary>
          <dl className="mt-3 space-y-2">
            {legacyEntries.map((entry) => (
              <div key={entry.label}>
                <dt className="text-xs uppercase tracking-wide text-ink-400">{entry.label}</dt>
                <dd className="whitespace-pre-wrap text-ink-800">{entry.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      <div className="card p-5 space-y-4">
        <h2 className="flex items-center gap-2 font-semibold text-ink-900"><ScrollText className="h-4 w-4 text-ink-500" />Session Notes &amp; Transcript</h2>
        <TranscriptInput
          clientId={clientId}
          stage="check_in_12hr"
          initialRecordings={initialRecordings}
          value={notes}
          onChange={setNotes}
          saveState={saveState}
          hideLabel
        />
      </div>
      <div className="card p-5 space-y-4">
        <ActionCardHeader
          title={<><Sparkles className="h-4 w-4 text-ink-500" />12-Hour Check-In Summary</>}
          description={`Generated from the check-in form and your notes above. Saves to ${clientName}'s record and completes the 12-Hour Check-In. Each one is kept as a new version.`}
          action={
            <AiGenerateButton
              clientId={clientId}
              summaryType="check_in_12hr_summary"
              label={summaries.length > 0 ? "Generate New Version" : "Generate Check-In Summary"}
              extra={{ transcript: notes, stageNotesKey: "check_in_12hr" }}
              onDone={(s) => setSummaries((prev) => [s as unknown as AiSummary, ...prev])}
              disabled={!canCompleteStage}
              className="btn-primary inline-flex items-center gap-2 whitespace-nowrap text-sm disabled:opacity-60"
            />
          }
        />
      </div>
      <SummaryVersions
        clientId={clientId}
        summaries={summaries}
        onChange={setSummaries}
        heading="12-Hour Check-In Summary"
        description={`Every check-in summary generated for ${clientName}, newest first.`}
        cardTitle="12-Hour Check-In Summary"
      />
    </div>
  );
}
