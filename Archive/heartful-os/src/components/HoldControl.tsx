"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PauseCircle, PlayCircle, X } from "lucide-react";
import { DEFAULT_HOLD_DAYS } from "@/lib/types";
import {
  putClientOnHoldAction,
  releaseClientHoldAction,
  putProspectOnHoldAction,
  releaseProspectHoldAction,
} from "@/lib/actions";

/** yyyy-mm-dd for an <input type="date"> N days from today, in local time. */
function dateInputValue(daysOut: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOut);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Turn a date input value into a 9am-local ISO timestamp. */
function toFollowUpIso(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 9, 0, 0, 0).toISOString();
}

export default function HoldControl({
  kind,
  recordId,
  name,
  onHold,
  followUpAt,
  reason,
}: {
  kind: "client" | "prospect";
  recordId: string;
  name: string;
  onHold: boolean;
  followUpAt?: string;
  reason?: string;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(dateInputValue(DEFAULT_HOLD_DAYS));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function confirmHold() {
    if (busy) return;
    setBusy(true);
    try {
      const opts = { followUpAt: toFollowUpIso(date), reason: note.trim() || undefined };
      if (kind === "client") await putClientOnHoldAction(recordId, opts);
      else await putProspectOnHoldAction(recordId, opts);
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function release() {
    if (busy) return;
    setBusy(true);
    try {
      if (kind === "client") await releaseClientHoldAction(recordId);
      else await releaseProspectHoldAction(recordId);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (onHold) {
    return (
      <button
        type="button"
        onClick={release}
        disabled={busy}
        title={
          followUpAt
            ? `Follow-up scheduled ${new Date(followUpAt).toLocaleDateString()}${reason ? ` — ${reason}` : ""}`
            : undefined
        }
        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
      >
        <PlayCircle className="h-3.5 w-3.5" />
        {busy ? "Resuming…" : "Resume"}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
      >
        <PauseCircle className="h-3.5 w-3.5" /> Put on Hold
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
          <div className="card w-full max-w-md p-5">
            <div className="flex items-start justify-between gap-4 mb-1">
              <h2 className="text-base font-semibold text-ink-900">Put {name} on hold</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-ink-400 hover:text-ink-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-ink-500 mb-4">
              They&rsquo;ll be hidden from your lists, dashboard and calendar. A follow-up
              reminder goes on your calendar for the date below.
            </p>

            <label className="block text-xs font-medium text-ink-600 mb-1">Follow up on</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-300 mb-1"
            />
            <div className="flex gap-2 mb-4">
              {[30, 60, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDate(dateInputValue(d))}
                  className="text-xs px-2 py-1 rounded-md border border-ink-200 text-ink-500 hover:bg-ink-50"
                >
                  {d} days
                </button>
              ))}
            </div>

            <label className="block text-xs font-medium text-ink-600 mb-1">
              Reason <span className="text-ink-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Travelling until spring"
              className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-300 mb-5"
            />

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary text-sm px-3 py-1.5">
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmHold}
                disabled={busy || !date}
                className="btn-primary text-sm px-3 py-1.5"
              >
                {busy ? "Saving…" : "Put on hold"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
