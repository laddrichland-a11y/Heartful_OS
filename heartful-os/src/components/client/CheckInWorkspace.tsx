"use client";

import { useState, useTransition } from "react";
import { AiSummary, CheckIn } from "@/lib/types";
import { submitCheckInAction } from "@/lib/actions";
import AiGenerateButton from "@/components/ai/AiGenerateButton";
import SummaryCard from "@/components/ai/SummaryCard";
import { Send } from "@/components/ui/HeartfulIcon";

const FIELDS: { key: keyof CheckIn; label: string }[] = [
  { key: "emotional_state", label: "Emotional State" },
  { key: "physical_state", label: "Physical State" },
  { key: "immediate_insights", label: "Immediate Insights" },
  { key: "support_needs", label: "Support Needs" },
  { key: "safety_concerns", label: "Safety Concerns" },
];

export default function CheckInWorkspace({
  clientId,
  clientName,
  existingCheckIn,
  existingSummary,
}: {
  clientId: string;
  clientName: string;
  existingCheckIn?: CheckIn;
  existingSummary?: AiSummary;
}) {
  const [fields, setFields] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, (existingCheckIn?.[f.key] as string) ?? ""]))
  );
  const [submitted, setSubmitted] = useState(!!existingCheckIn);
  const [summary, setSummary] = useState(existingSummary);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="card p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-ink-900">12-Hour Check-In Form</h2>
          <p className="text-xs text-ink-400 mt-1">For {clientName} — captures how things feel 12 hours after the journey.</p>
        </div>
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="text-sm font-medium text-ink-800">{f.label}</label>
            <textarea
              value={fields[f.key]}
              onChange={(e) => setFields((s) => ({ ...s, [f.key]: e.target.value }))}
              rows={2}
              className="mt-1 w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
            />
          </div>
        ))}
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await submitCheckInAction(
                clientId,
                {
                  emotional_state: fields.emotional_state,
                  physical_state: fields.physical_state,
                  immediate_insights: fields.immediate_insights,
                  support_needs: fields.support_needs,
                  safety_concerns: fields.safety_concerns,
                },
                "practitioner"
              );
              setSubmitted(true);
            })
          }
          className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
        >
          <Send className="h-4 w-4" /> {submitted ? "Update Check-In" : "Submit Check-In"}
        </button>
      </div>
      <div className="space-y-4">
        <h2 className="font-semibold text-ink-900">AI Summary</h2>
        <AiGenerateButton
          clientId={clientId}
          summaryType="check_in_12hr_summary"
          label="Generate Check-In Summary"
          onDone={(s) => setSummary(s as unknown as AiSummary)}
        />
        {summary ? (
          <SummaryCard title="12-Hour Check-In Summary" content={summary.content} model={summary.model} />
        ) : (
          <div className="card p-6 text-sm text-ink-400 text-center">Submit the check-in, then generate a summary.</div>
        )}
      </div>
    </div>
  );
}
