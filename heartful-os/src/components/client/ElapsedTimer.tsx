"use client";

import { Loader2 } from "@/components/ui/HeartfulIcon";
import { useNowTick } from "@/lib/useNowTick";

const QUICK_ADJUST_MINUTES = [-5, -1, 1, 5];

// Live-updating elapsed-time readout (m:ss, or h:mm:ss past an hour). Ticks
// once a second while `since` is set and `until` isn't; freezes on the
// final duration once `until` is set (e.g. Journey End has been marked).
//
// If `onAdjustMinutes` is passed, shows quick +/- buttons that nudge the
// underlying start time — for when the practitioner forgot to toggle the
// marker at the actual moment and wants to add/subtract a few minutes from
// the timer without having to know or type the exact clock time. Adding
// minutes to the elapsed count moves the start time earlier; subtracting
// moves it later.
export default function ElapsedTimer({
  since,
  until,
  label,
  onAdjustMinutes,
  adjusting,
}: {
  since?: string;
  until?: string;
  label: string;
  onAdjustMinutes?: (deltaMinutes: number) => void;
  adjusting?: boolean;
}) {
  const now = useNowTick(1000, !!since && !until);
  if (!since) return null;

  const endMs = until ? new Date(until).getTime() : now;
  const elapsedMs = Math.max(0, endMs - new Date(since).getTime());
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const display = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;

  return (
    <div className="journey-elapsed-timer">
      <p className="journey-elapsed-timer-label">{label}</p>
      <p className="journey-elapsed-timer-value">{display}</p>
      {onAdjustMinutes && (
        <div className="journey-elapsed-timer-adjustments">
          {QUICK_ADJUST_MINUTES.map((delta) => (
            <button
              key={delta}
              disabled={adjusting}
              onClick={() => onAdjustMinutes(delta)}
              className="journey-elapsed-timer-adjust"
              title={`${delta > 0 ? "Add" : "Subtract"} ${Math.abs(delta)} minute${Math.abs(delta) === 1 ? "" : "s"} ${delta > 0 ? "to" : "from"} the timer`}
            >
              {delta > 0 ? `+${delta}m` : `${delta}m`}
            </button>
          ))}
          {adjusting && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
      )}
    </div>
  );
}
