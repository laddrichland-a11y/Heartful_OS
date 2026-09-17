"use client";

import { useState, useTransition } from "react";
import { Check, CheckCircle2, CircleDot, Loader2 } from "@/components/ui/HeartfulIcon";
import { toggleMilestoneAction } from "@/lib/actions";
import { cx } from "@/lib/utils";

export default function MilestoneToggleBanner({
  clientId,
  milestoneKey,
  label,
  meta,
  initialCompleted,
}: {
  clientId: string;
  milestoneKey: string;
  label: string;
  meta?: string;
  initialCompleted: boolean;
}) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !completed;
    setCompleted(next);
    startTransition(async () => {
      await toggleMilestoneAction(clientId, milestoneKey, next);
    });
  }

  return (
    <section className="client-surface mb-5 flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div>
        <p className="client-eyebrow">Stage workspace</p>
        <div className="mt-1 flex flex-wrap items-center gap-2.5">
          <h2 className="text-lg font-semibold text-ink-900">{label}</h2>
          <span className={cx("badge inline-flex items-center gap-1.5", completed ? "bg-sage-100 text-sage-700" : "bg-clay-50 text-clay-700")}>
            {completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleDot className="h-3.5 w-3.5" />}
            {completed ? "Completed" : "In progress"}
          </span>
        </div>
        {meta && <p className="mt-1.5 text-xs text-ink-400">{meta}</p>}
      </div>
      <button onClick={toggle} disabled={pending} className={cx("btn-secondary flex items-center gap-2 text-xs", completed && "border-sage-200 text-sage-700")}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {completed ? "Mark incomplete" : "Mark complete"}
      </button>
    </section>
  );
}
