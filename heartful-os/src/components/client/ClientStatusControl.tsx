"use client";

import { useState, useTransition } from "react";
import { ClientStatus, JourneyMilestone, JourneyPhase } from "@/lib/types";
import { canSetJourneyStatus, clientStatusBadgeClasses, cx, phaseForStatus, phaseLabel } from "@/lib/utils";
import { updateClientStatusAction } from "@/lib/actions";
import { ChevronDown, Loader2 } from "@/components/ui/HeartfulIcon";

// Practitioner-facing manual override for a client's journey status/phase.
// Scheduling and completing sessions already advance status automatically
// (see lib/data.ts), but practitioners need to be able to correct or roll
// back a status by hand — e.g. a client postpones, or a status was set
// wrong. This control allows moving to ANY status in either direction.
const STATUS_PRESENTATION: Record<Exclude<ClientStatus, "inactive">, { stage: string; state: string }> = {
  inquiry: { stage: "Intake", state: "Inquiry" },
  intake_scheduled: { stage: "Intake", state: "Scheduled" },
  intake_complete: { stage: "Intake", state: "Completed" },
  preparation: { stage: "Preparation", state: "Current" },
  preparation_complete: { stage: "Preparation", state: "Completed" },
  journey_scheduled: { stage: "Journey Day", state: "Scheduled" },
  journey_complete: { stage: "Journey Day", state: "Completed" },
  check_in_complete: { stage: "12-Hour Check-In", state: "Completed" },
  integration_1: { stage: "Integration 1", state: "Current" },
  integration_1_complete: { stage: "Integration 1", state: "Completed" },
  integration_2: { stage: "Integration 2", state: "Current" },
  integration_2_complete: { stage: "Integration 2", state: "Completed" },
  journey_closed: { stage: "Growth Plan", state: "Completed" },
};

const STATUS_OPTIONS = [...Object.keys(STATUS_PRESENTATION), "inactive"] as ClientStatus[];

function statusPresentation(status: ClientStatus, phase: JourneyPhase) {
  return status === "inactive"
    ? { stage: phaseLabel(phase), state: "Inactive" }
    : STATUS_PRESENTATION[status];
}

export default function ClientStatusControl({
  clientId,
  status,
  phase,
  milestones,
}: {
  clientId: string;
  status: ClientStatus;
  phase: JourneyPhase;
  milestones: JourneyMilestone[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selectedPresentation = statusPresentation(selectedStatus, phaseForStatus(selectedStatus, phase));

  function handleChange(next: ClientStatus) {
    setOpen(false);
    if (next === selectedStatus) return;
    setError(null);
    setSelectedStatus(next);
    const nextPhase = phaseForStatus(next, phase);
    startTransition(async () => {
      try {
        await updateClientStatusAction(clientId, next, nextPhase);
      } catch {
        setSelectedStatus(status);
        setError("Couldn’t update the status. Complete the next journey stage and try again.");
      }
    });
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        className={cx(
          "badge inline-flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity",
          clientStatusBadgeClasses(selectedStatus)
        )}
        data-status={selectedStatus}
        title="Manually advance or roll back this client's status"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        <span>{selectedPresentation.stage}</span>
        <span aria-hidden="true">·</span>
        <span>{selectedPresentation.state}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-56 max-h-72 overflow-y-auto rounded-lg border border-ink-200 bg-white shadow-lg py-1">
            {STATUS_OPTIONS.map((s) => {
              const presentation = statusPresentation(s, phaseForStatus(s, phase));
              const allowed = canSetJourneyStatus(milestones, s);
              return (
              <button
                key={s}
                type="button"
                onClick={() => handleChange(s)}
                disabled={!allowed}
                title={!allowed ? "Complete the next journey stage first" : undefined}
                className={cx(
                  "w-full text-left px-3 py-1.5 text-sm hover:bg-ink-50 flex items-center justify-between",
                  s === selectedStatus && "font-semibold text-clay-700",
                  !allowed && "cursor-not-allowed opacity-45"
                )}
              >
                <span><span>{presentation.stage}</span> <span className="text-ink-400">· {presentation.state}</span></span>
                {s === selectedStatus && <span className="text-xs text-ink-400">current</span>}
              </button>
              );
            })}
          </div>
        </>
      )}
      {error && <p className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-card)] px-2.5 py-2 text-xs text-[var(--danger-text)] shadow-sm" role="alert">{error}</p>}
    </div>
  );
}
