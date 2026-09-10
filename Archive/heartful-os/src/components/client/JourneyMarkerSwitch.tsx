"use client";

import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { cx, formatDateTime, toDatetimeLocalValue, fromDatetimeLocalValue } from "@/lib/utils";

// Toggle switch for Journey Begin / Journey End / Booster Dose — same visual
// language as MilestoneToggleBanner's completion switch. Once a marker is
// on, it also exposes a small "fix the time" affordance (a datetime-local
// input) for correcting the timestamp after the fact — e.g. the
// practitioner forgot to toggle it until a few minutes into the actual
// event. Toggle logic (calling the action, updating sibling state like
// Manual Notes) lives in the parent.
export default function JourneyMarkerSwitch({
  label,
  on,
  pending,
  isoTimestamp,
  onToggle,
  onTimeChange,
  timeSaving,
}: {
  label: string;
  on: boolean;
  pending: boolean;
  isoTimestamp?: string;
  onToggle: () => void;
  onTimeChange?: (newIso: string) => void;
  timeSaving?: boolean;
}) {
  const [editingTime, setEditingTime] = useState(false);
  const [draftTime, setDraftTime] = useState("");

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className={cx("text-sm font-medium", on ? "text-sage-700" : "text-ink-600")}>{label}</span>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin text-ink-400" />
        ) : (
          <button
            onClick={onToggle}
            role="switch"
            aria-checked={on}
            className={cx(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-500",
              on ? "bg-sage-500" : "bg-ink-200 hover:bg-ink-300"
            )}
          >
            <span
              className={cx(
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200",
                on ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        )}
      </div>

      {isoTimestamp && (
        <div className="mt-1 flex items-center gap-1.5">
          {editingTime ? (
            <>
              <input
                type="datetime-local"
                value={draftTime}
                onChange={(e) => setDraftTime(e.target.value)}
                className="text-xs border border-ink-200 rounded px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-clay-200"
              />
              <button
                disabled={timeSaving || !draftTime}
                onClick={() => {
                  if (draftTime && onTimeChange) onTimeChange(fromDatetimeLocalValue(draftTime));
                  setEditingTime(false);
                }}
                className="text-xs text-clay-600 hover:text-clay-800 font-medium disabled:opacity-50"
              >
                {timeSaving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setEditingTime(false)}
                className="text-xs text-ink-400 hover:text-ink-600"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-ink-400">{formatDateTime(isoTimestamp)}</p>
              {onTimeChange && (
                <button
                  onClick={() => {
                    setDraftTime(toDatetimeLocalValue(isoTimestamp));
                    setEditingTime(true);
                  }}
                  className="text-ink-300 hover:text-clay-600"
                  title="Fix the time"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
