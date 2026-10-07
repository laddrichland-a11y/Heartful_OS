"use client";

import { useState } from "react";
import { AiSummary, GrowthActionPlan, Recording } from "@/lib/types";
import TranscriptInput from "@/components/ai/TranscriptInput";
import SummaryVersions from "@/components/ai/SummaryVersions";
import { useStageNotes } from "@/components/ai/useStageNotes";
import AiGenerateButton from "@/components/ai/AiGenerateButton";
import ActionCardHeader from "@/components/client/ActionCardHeader";
import { ScrollText, Trash2 } from "@/components/ui/HeartfulIcon";
import { deleteGrowthActionPlanAction } from "@/lib/actions";

// Standalone Growth Action Plan step — pulled out of IntegrationWorkspace so
// it has its own stable URL (/clients/[id]/growth-plan) instead of living
// inside Integration Session Two, which the client header's phase pill
// stops linking to once a completed session record exists for that phase.
export default function GrowthActionPlanWorkspace({
  clientId,
  clientName,
  existingGrowthPlan,
  existingVersions,
  initialNotes,
  initialRecordings = [],
  canCompleteStage,
}: {
  clientId: string;
  clientName: string;
  existingGrowthPlan?: GrowthActionPlan;
  /** Every plan the AI has generated, newest first. */
  existingVersions: AiSummary[];
  /** Notes already saved on the client record for this stage. */
  initialNotes: string;
  /** Recordings already uploaded on this stage page. */
  initialRecordings?: Recording[];
  canCompleteStage: boolean;
}) {
  // Saved to the client record as you type, and kept after generating.
  const { notes, setNotes, saveState } = useStageNotes(clientId, "growth_plan", initialNotes);
  const [versions, setVersions] = useState(existingVersions);

  const [growthPlan, setGrowthPlan] = useState(existingGrowthPlan);
  const [deletingPlan, setDeletingPlan] = useState(false);

  async function handleDeleteGrowthPlan() {
    if (!confirm("Clear the current Growth Action Plan so you can generate a fresh one? Earlier generated versions stay in the Versions list below.")) return;
    setDeletingPlan(true);
    try {
      await deleteGrowthActionPlanAction(clientId);
      setGrowthPlan(undefined);
    } finally {
      setDeletingPlan(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-5 space-y-4">
        <h2 className="flex items-center gap-2 font-semibold text-ink-900"><ScrollText className="h-4 w-4 text-ink-500" />Session Notes &amp; Transcript</h2>
        <TranscriptInput clientId={clientId} stage="growth_plan" initialRecordings={initialRecordings} value={notes} onChange={setNotes} saveState={saveState} hideLabel />
      </div>

      <div className="card p-5 space-y-4">
        <ActionCardHeader
          title="Growth Action Plan"
          description={growthPlan
            ? "Enhance the existing plan using your notes above, without starting over. Each result is kept as a new version."
            : `Turn ${clientName}'s journey into practical 30-day commitments and next steps.`}
          titleAction={growthPlan && (
            <button
              type="button"
              onClick={handleDeleteGrowthPlan}
              disabled={deletingPlan}
              className="p-1 rounded text-ink-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-50"
              title="Clear the current plan"
              aria-label="Clear the current Growth Action Plan"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          action={
            <AiGenerateButton
              clientId={clientId}
              summaryType="growth_action_plan"
              label={growthPlan ? "Enhance Growth Action Plan" : "Generate Growth Action Plan"}
              extra={{ transcript: notes, stageNotesKey: "growth_plan" }}
              disabled={!canCompleteStage || !notes.trim()}
              onDone={(s) => {
                setVersions((prev) => [s as unknown as AiSummary, ...prev]);
                const content = (s as unknown as AiSummary).content as unknown as GrowthActionPlan;
                setGrowthPlan({
                  ...content,
                  id: growthPlan?.id ?? "local",
                  client_id: clientId,
                  created_at: new Date().toISOString(),
                });
              }}
              className="btn-primary inline-flex items-center gap-2 whitespace-nowrap text-sm disabled:opacity-60"
            />
          }
        />
        {growthPlan ? (
          <div className="grid sm:grid-cols-2 gap-4 mt-2 text-sm">
            <PlanList title="30-Day Commitments" items={growthPlan.thirty_day_commitments} />
            <PlanList title="Behavioral Experiments" items={growthPlan.behavioral_experiments} />
            <PlanList title="Daily Practices" items={growthPlan.daily_practices} />
            <PlanList title="Reflection Questions" items={growthPlan.reflection_questions} />
            <PlanList title="Accountability Commitments" items={growthPlan.accountability_commitments} />
          </div>
        ) : (
          <p className="text-sm text-ink-400">No Growth Action Plan generated yet.</p>
        )}
      </div>

      <SummaryVersions
        clientId={clientId}
        summaries={versions}
        onChange={setVersions}
        heading="Growth Action Plan Versions"
        description={`Every plan the AI has generated for ${clientName}, newest first, with the notes each one came from. Deleting a version here doesn't change the current plan above.`}
        cardTitle="Growth Action Plan"
      />
    </div>
  );
}

function PlanList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-400 mb-1">{title}</div>
      <ul className="list-disc list-inside text-ink-700 space-y-0.5">
        {items.map((i, idx) => (
          <li key={idx}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
