"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CalendarClock, Check, CheckCircle2, ChevronDown, CircleDot, Loader2, Sparkles } from "@/components/ui/HeartfulIcon";
import AiGenerateButton from "@/components/ai/AiGenerateButton";
import { SessionBriefContent } from "@/components/ai/SummaryCard";
import { AiSummary } from "@/lib/types";
import { toggleMilestoneAction } from "@/lib/actions";
import { cx } from "@/lib/utils";

export default function MilestoneToggleBanner({
  clientId,
  milestoneKey,
  label,
  meta,
  initialCompleted,
  prepareMeSessionId,
  initialBriefing,
  autoPrepare = false,
}: {
  clientId: string;
  milestoneKey: string;
  label: string;
  meta?: string;
  initialCompleted: boolean;
  prepareMeSessionId?: string;
  initialBriefing?: AiSummary;
  autoPrepare?: boolean;
}) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [pending, startTransition] = useTransition();
  const [briefing, setBriefing] = useState<{ content: Record<string, unknown>; title: string } | null>(initialBriefing ?? null);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const autoStarted = useRef(false);
  const prepareButtonId = `stage-prepare-${clientId}-${milestoneKey}`;

  useEffect(() => {
    if (!autoPrepare || autoStarted.current || completed) return;
    autoStarted.current = true;
    if (briefing) {
      setBriefingOpen(true);
      return;
    }
    const frame = window.requestAnimationFrame(() => document.getElementById(prepareButtonId)?.click());
    return () => window.cancelAnimationFrame(frame);
  }, [autoPrepare, briefing, completed, prepareButtonId]);

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
          <h2 className="journey-icon-heading text-lg font-semibold text-ink-900"><CalendarClock aria-hidden="true" />{label}</h2>
          <span className={cx("badge inline-flex items-center gap-1.5", completed ? "bg-sage-100 text-sage-700" : "bg-clay-50 text-clay-700")}>
            {completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleDot className="h-3.5 w-3.5" />}
            {completed ? "Completed" : "In progress"}
          </span>
        </div>
        {meta && <p className="mt-1.5 text-xs text-ink-400">{meta}</p>}
      </div>
      <div className="stage-workspace-actions">
        <button onClick={toggle} disabled={pending} className={cx("btn-secondary flex items-center gap-2 text-xs", completed && "border-sage-200 text-sage-700")}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {completed ? "Mark incomplete" : "Mark complete"}
        </button>
        {briefing ? (
          <button type="button" onClick={() => setBriefingOpen(true)} disabled={completed || pending} className="btn-primary stage-workspace-prepare flex items-center gap-2 text-xs">
            <Sparkles className="h-4 w-4" aria-hidden="true" /> View briefing
          </button>
        ) : (
          <AiGenerateButton
            buttonId={prepareButtonId}
            clientId={clientId}
            summaryType="prepare_me_briefing"
            label="Prepare me"
            icon="sparkles"
            disabled={completed || pending}
            extra={{ sessionTypeLabel: label, ...(prepareMeSessionId ? { sessionId: prepareMeSessionId } : {}) }}
            onDone={(summary) => { setBriefing(summary); setBriefingOpen(true); setPrepareError(null); }}
            onError={() => setPrepareError("Couldn’t generate the briefing. Please try again.")}
            className="btn-primary stage-workspace-prepare flex items-center gap-2 text-xs"
          />
        )}
      </div>
      {prepareError && <p className="stage-workspace-prepare-error" role="alert">{prepareError}</p>}
      {briefingOpen && briefing && (
        <div className="prepare-brief-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setBriefingOpen(false); }}>
          <section className="prepare-brief-dialog" role="dialog" aria-modal="true" aria-labelledby="prepare-brief-title">
            <header className="prepare-brief-dialog-header">
              <div>
                <p className="client-eyebrow">Prepared for this stage</p>
                <h2 id="prepare-brief-title">{label}</h2>
              </div>
              <button type="button" onClick={() => setBriefingOpen(false)} aria-label="Collapse briefing" title="Collapse briefing"><ChevronDown aria-hidden="true" /></button>
            </header>
            <SessionBriefContent content={briefing.content} />
            <footer className="prepare-brief-dialog-footer">
              <AiGenerateButton
                clientId={clientId}
                summaryType="prepare_me_briefing"
                label="Regenerate Brief"
                icon="sparkles"
                extra={{ sessionTypeLabel: label, ...(prepareMeSessionId ? { sessionId: prepareMeSessionId } : {}) }}
                onDone={(summary) => { setBriefing(summary); setPrepareError(null); }}
                onError={() => setPrepareError("Couldn’t generate the briefing. Please try again.")}
                className="btn-secondary flex items-center gap-2 text-xs"
              />
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
