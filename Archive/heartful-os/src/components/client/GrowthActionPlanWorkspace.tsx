"use client";

import { useState } from "react";
import { AiSummary, GrowthActionPlan } from "@/lib/types";
import TranscriptInput from "@/components/ai/TranscriptInput";
import AiGenerateButton from "@/components/ai/AiGenerateButton";
import { Trash2 } from "lucide-react";
import { deleteGrowthActionPlanAction } from "@/lib/actions";

// Standalone Growth Action Plan step — pulled out of IntegrationWorkspace so
// it has its own stable URL (/clients/[id]/growth-plan) instead of living
// inside Integration Session Two, which the client header's phase pill
// stops linking to once a completed session record exists for that phase.
export default function GrowthActionPlanWorkspace({
  clientId,
  clientName,
  existingGrowthPlan,
}: {
  clientId: string;
  clientName: string;
  existingGrowthPlan?: GrowthActionPlan;
}) {
  // Persisted to localStorage (not just React state) so the pasted transcript
  // survives a Generate/Enhance click — that button triggers a router.refresh()
  // to pull the freshly generated plan from the server, and plain useState
  // isn't guaranteed to survive that trip through the Server Component tree.
  const transcriptStorageKey = `heartful_transcript_${clientId}_growth_plan`;
  const [transcript, setTranscriptState] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(transcriptStorageKey) ?? "";
  });
  function setTranscript(v: string) {
    setTranscriptState(v);
    if (typeof window !== "undefined") {
      if (v) window.localStorage.setItem(transcriptStorageKey, v);
      else window.localStorage.removeItem(transcriptStorageKey);
    }
  }

  const [growthPlan, setGrowthPlan] = useState(existingGrowthPlan);
  const [deletingPlan, setDeletingPlan] = useState(false);

  async function handleDeleteGrowthPlan() {
    if (!confirm("Delete this Growth Action Plan? You can regenerate a new one afterward.")) return;
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
        <h2 className="font-semibold text-ink-900">Session Transcript</h2>
        <TranscriptInput value={transcript} onChange={setTranscript} />
      </div>

      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-ink-900">Growth Action Plan</h3>
          {growthPlan && (
            <button
              type="button"
              onClick={handleDeleteGrowthPlan}
              disabled={deletingPlan}
              className="p-1 rounded text-ink-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-50"
              title="Delete this Growth Action Plan"
              aria-label="Delete this Growth Action Plan"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <p className="text-xs text-ink-400">
          {growthPlan
            ? `Paste a new transcript above and click "Enhance Growth Action Plan" to fold it into the existing plan — it revises and adds to what's already there instead of starting over.`
            : `Synthesizes ${clientName}'s entire journey into 30-day commitments, behavioral experiments, daily practices, reflection questions, and accountability commitments.`}
        </p>
        <AiGenerateButton
          clientId={clientId}
          summaryType="growth_action_plan"
          label={growthPlan ? "Enhance Growth Action Plan" : "Generate Growth Action Plan"}
          extra={{ transcript }}
          onDone={(s) => {
            const content = (s as unknown as AiSummary).content as unknown as GrowthActionPlan;
            setGrowthPlan({
              ...content,
              id: growthPlan?.id ?? "local",
              client_id: clientId,
              created_at: new Date().toISOString(),
            });
          }}
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
    </div>
  );
}

function PlanList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-ink-400 mb-1">{title}</div>
      <ul className="list-disc list-inside text-ink-700 space-y-0.5">
        {items.map((i, idx) => (
          <li key={idx}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
