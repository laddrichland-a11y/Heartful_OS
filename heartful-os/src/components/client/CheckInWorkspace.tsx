"use client";

import { useState, useTransition } from "react";
import { CheckIn, Recording } from "@/lib/types";
import { RecordingsSection, useRecordings } from "@/components/ai/RecordingsPanel";
import { submitCheckInAction } from "@/lib/actions";
import { ClipboardList, Send } from "@/components/ui/HeartfulIcon";

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
  onSubmitted,
  initialRecordings = [],
}: {
  clientId: string;
  clientName: string;
  existingCheckIn?: CheckIn;
  onSubmitted?: () => void;
  /** Recordings of the 12-hour check-in call added before it was scheduled. */
  initialRecordings?: Recording[];
}) {
  const rec = useRecordings(clientId, { stage: "check_in_12hr" }, initialRecordings);
  const [fields, setFields] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, (existingCheckIn?.[f.key] as string) ?? ""]))
  );
  const [submitted, setSubmitted] = useState(!!existingCheckIn);
  const [pending, startTransition] = useTransition();

  return (
      <section className="client-surface mb-6 p-5">
        <div>
          <p className="client-eyebrow">Check-in record</p>
          <h2 className="journey-icon-heading mt-1 text-lg font-semibold text-ink-900"><ClipboardList aria-hidden="true" />12-Hour Check-In Form</h2>
          <p className="mt-1.5 text-sm leading-6 text-ink-500">
            For {clientName} — captures how things feel 12 hours after the journey.
          </p>
        </div>
        <div className="mt-5 space-y-4 border-t border-ink-100 pt-5">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="text-sm font-medium text-ink-800">{f.label}</label>
              <textarea
                value={fields[f.key]}
                onChange={(e) => setFields((s) => ({ ...s, [f.key]: e.target.value }))}
                rows={2}
                className="mt-1.5 min-h-[80px] w-full resize-y rounded-xl border border-ink-200 bg-ink-50/30 px-3 py-2.5 text-sm text-ink-800 transition-colors placeholder:text-ink-400 focus:border-clay-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-clay-100"
              />
            </div>
          ))}
        </div>
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
              onSubmitted?.();
            })
          }
          className="btn-primary mt-5 ml-auto inline-flex items-center justify-center gap-2 text-sm"
        >
          <Send className="h-4 w-4" /> {submitted ? "Update Check-In" : "Submit Check-In"}
        </button>
        <div className="mt-5">
          <RecordingsSection
            busy={rec.busy}
            error={rec.error}
            recordings={rec.recordings}
            onFile={rec.upload}
            onPlay={rec.play}
            onRemove={rec.remove}
          />
        </div>
      </section>
  );
}
