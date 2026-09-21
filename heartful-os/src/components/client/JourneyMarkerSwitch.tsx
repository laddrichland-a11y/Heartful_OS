"use client";

import { useState } from "react";
import { Check, Loader2, MoreHorizontal } from "@/components/ui/HeartfulIcon";
import { formatDateTime, toDatetimeLocalValue, fromDatetimeLocalValue } from "@/lib/utils";

/** Records a journey event while keeping time correction and removal available. */
export default function JourneyMarkerSwitch({
  label,
  actionLabel,
  recordedLabel,
  on,
  pending,
  disabled = false,
  isoTimestamp,
  onToggle,
  onTimeChange,
  timeSaving,
}: {
  label: string;
  actionLabel: string;
  recordedLabel: string;
  on: boolean;
  pending: boolean;
  disabled?: boolean;
  isoTimestamp?: string;
  onToggle: () => void;
  onTimeChange?: (newIso: string) => void;
  timeSaving?: boolean;
}) {
  const [editingTime, setEditingTime] = useState(false);
  const [draftTime, setDraftTime] = useState("");

  return (
    <div className="journey-timing-event">
      <p className="journey-timing-label">{label}</p>
      {on && isoTimestamp ? (
        <>
          <div className="journey-timing-recorded" title={formatDateTime(isoTimestamp)}>
            <Check aria-hidden="true" />
            <span>{recordedLabel} · <time dateTime={isoTimestamp} suppressHydrationWarning>{new Date(isoTimestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</time></span>
          </div>
          {editingTime ? (
            <div className="journey-timing-time-editor">
              <input aria-label={`Correct ${label.toLowerCase()} time`} type="datetime-local" value={draftTime} onChange={(event) => setDraftTime(event.target.value)} />
              <button disabled={timeSaving || !draftTime} onClick={() => {
                if (draftTime && onTimeChange) onTimeChange(fromDatetimeLocalValue(draftTime));
                setEditingTime(false);
              }}>{timeSaving ? "Saving…" : "Save time"}</button>
              <button onClick={() => setEditingTime(false)}>Cancel</button>
            </div>
          ) : (
            <details className="journey-timing-menu">
              <summary aria-label={`Manage ${label.toLowerCase()} record`}><MoreHorizontal aria-hidden="true" /></summary>
              <div>
                {onTimeChange && <button onClick={(event) => {
                  event.currentTarget.closest("details")?.removeAttribute("open");
                  setDraftTime(toDatetimeLocalValue(isoTimestamp));
                  setEditingTime(true);
                }}>Edit time</button>}
                <button disabled={pending} onClick={onToggle}>Remove record</button>
              </div>
            </details>
          )}
        </>
      ) : (
        <button className="journey-timing-action" disabled={disabled || pending} onClick={onToggle}>
          {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {pending ? "Recording…" : actionLabel}
        </button>
      )}
    </div>
  );
}
