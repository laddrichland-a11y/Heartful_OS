"use client";

import { useState, useTransition } from "react";
import { ClientStatus, JourneyPhase, STATUS_LABELS } from "@/lib/types";
import { cx, phaseForStatus, statusBadgeClasses } from "@/lib/utils";
import { updateClientStatusAction } from "@/lib/actions";
import { ChevronDown, Loader2 } from "@/components/ui/HeartfulIcon";

// Practitioner-facing manual override for a client's journey status/phase.
// Scheduling and completing sessions already advance status automatically
// (see lib/data.ts), but practitioners need to be able to correct or roll
// back a status by hand — e.g. a client postpones, or a status was set
// wrong. This control allows moving to ANY status in either direction.
const STATUS_OPTIONS = Object.keys(STATUS_LABELS) as ClientStatus[];

export default function ClientStatusControl({
  clientId,
  status,
  phase,
}: {
  clientId: string;
  status: ClientStatus;
  phase: JourneyPhase;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleChange(next: ClientStatus) {
    setOpen(false);
    if (next === status) return;
    const nextPhase = phaseForStatus(next, phase);
    startTransition(async () => {
      await updateClientStatusAction(clientId, next, nextPhase);
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
          statusBadgeClasses(status)
        )}
        title="Manually advance or roll back this client's status"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        {STATUS_LABELS[status]}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-56 max-h-72 overflow-y-auto rounded-lg border border-ink-200 bg-white shadow-lg py-1">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleChange(s)}
                className={cx(
                  "w-full text-left px-3 py-1.5 text-sm hover:bg-ink-50 flex items-center justify-between",
                  s === status && "font-semibold text-clay-700"
                )}
              >
                {STATUS_LABELS[s]}
                {s === status && <span className="text-xs text-ink-400">current</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
