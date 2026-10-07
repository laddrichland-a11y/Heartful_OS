"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CalendarClock, Check, CheckCircle2, CircleDot, Loader2, Sparkles, X } from "@/components/ui/HeartfulIcon";
import AiGenerateButton from "@/components/ai/AiGenerateButton";
import { SessionBriefContent } from "@/components/ai/SummaryCard";
import { AiSummary } from "@/lib/types";
import { toggleMilestoneAction } from "@/lib/actions";
import { cx, JourneyStageStatus } from "@/lib/utils";

export default function MilestoneToggleBanner({
  clientId,
  milestoneKey,
  label,
  meta,
  initialCompleted,
  prepareMeSessionId,
  initialBriefing,
  autoPrepare = false,
  stageStatus = initialCompleted ? "completed" : "current",
  canMarkComplete = true,
  canPrepare = true,
}: {
  clientId: string;
  milestoneKey: string;
  label: string;
  meta?: string;
  initialCompleted: boolean;
  prepareMeSessionId?: string;
  initialBriefing?: AiSummary;
  autoPrepare?: boolean;
  stageStatus?: JourneyStageStatus;
  canMarkComplete?: boolean;
  canPrepare?: boolean;
}) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [pending, startTransition] = useTransition();
  const [briefing, setBriefing] = useState<{ content: Record<string, unknown>; title: string } | null>(initialBriefing ?? null);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const autoStarted = useRef(false);
  const prepareButtonId = `stage-prepare-${clientId}-${milestoneKey}`;
  const displayStatus: JourneyStageStatus = completed ? "completed" : stageStatus;
  const showPrepare = canPrepare && !completed;

  useEffect(() => {
    if (!autoPrepare || !showPrepare || autoStarted.current) return;
    autoStarted.current = true;
    if (briefing) {
      const frame = window.requestAnimationFrame(() => setBriefingOpen(true));
      return () => window.cancelAnimationFrame(frame);
    }
    const frame = window.requestAnimationFrame(() => document.getElementById(prepareButtonId)?.click());
    return () => window.cancelAnimationFrame(frame);
  }, [autoPrepare, briefing, prepareButtonId, showPrepare]);

  // Esc closes the briefing dialog.
  useEffect(() => {
    if (!briefingOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setBriefingOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [briefingOpen]);

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
          {displayStatus !== "future" && (
            <span className={cx("badge inline-flex items-center gap-1.5", displayStatus === "completed" ? "bg-sage-100 text-sage-700" : displayStatus === "upcoming" ? "bg-ink-100 text-ink-500" : "bg-clay-50 text-clay-700")}>
              {displayStatus === "completed" ? <CheckCircle2 className="h-3.5 w-3.5" /> : displayStatus === "upcoming" ? <CalendarClock className="h-3.5 w-3.5" /> : <CircleDot className="h-3.5 w-3.5" />}
              {displayStatus === "completed" ? "Completed" : displayStatus === "upcoming" ? "Upcoming" : "Current"}
            </span>
          )}
        </div>
        {meta && <p className="mt-1.5 text-xs text-ink-400">{meta}</p>}
      </div>
      <div className="stage-workspace-actions">
        {canMarkComplete && <button onClick={toggle} disabled={pending} className={cx("btn-secondary flex items-center gap-2 text-xs", completed && "border-sage-200 text-sage-700")}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {completed ? "Mark incomplete" : "Mark complete"}
        </button>}
        {showPrepare && briefing ? (
          <button type="button" onClick={() => setBriefingOpen(true)} disabled={completed || pending} className="btn-primary stage-workspace-prepare flex items-center gap-2 text-xs">
            <Sparkles className="h-4 w-4" aria-hidden="true" /> View briefing
          </button>
        ) : showPrepare ? (
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
        ) : null}
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
              <button type="button" onClick={() => setBriefingOpen(false)} aria-label="Close briefing" title="Close briefing"><X aria-hidden="true" /></button>
            </header>
            <SessionBriefContent content={briefing.content} />
            <footer className="prepare-brief-dialog-footer">
              {/* A long brief scrolls the header's X out of view — always offer a close here too. */}
              <button type="button" onClick={() => setBriefingOpen(false)} className="btn-secondary flex items-center gap-2 text-xs">
                <X className="h-4 w-4" aria-hidden="true" /> Close
              </button>
              <AiGenerateButton
                clientId={clientId}
                summaryType="prepare_me_briefing"
                label="Regenerate Brief"
                icon="sparkles"
                extra={{ sessionTypeLabel: label, regenerate: true, ...(prepareMeSessionId ? { sessionId: prepareMeSessionId } : {}) }}
                onDone={(summary) => { setBriefing(summary); setPrepareError(null); }}
                onError={() => setPrepareError("Couldn’t generate the briefing. Please try again.")}
                refreshOnDone={false}
                className="btn-secondary flex items-center gap-2 text-xs"
              />
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
