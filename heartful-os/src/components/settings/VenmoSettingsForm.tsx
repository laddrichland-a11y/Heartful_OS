"use client";

import { useState, useTransition } from "react";
import { updatePractitionerAction } from "@/lib/actions";
import { Check, Wallet } from "lucide-react";

export default function VenmoSettingsForm({ venmoHandle }: { venmoHandle?: string }) {
  const [value, setValue] = useState(venmoHandle ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(false);
    startTransition(async () => {
      // Accept a pasted profile URL or a handle with/without the @ — store
      // just the bare username so it's easy to build venmo.com links from it.
      const cleaned = value.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?venmo\.com\//i, "");
      setValue(cleaned);
      await updatePractitionerAction({ venmo_handle: cleaned });
      setSaved(true);
    });
  }

  return (
    <div>
      <label className="text-xs font-medium text-ink-500 flex items-center gap-1.5">
        <Wallet className="h-3.5 w-3.5" /> Venmo handle
      </label>
      <div className="flex items-center gap-2 mt-1">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          placeholder="your-venmo-username"
          className="flex-1 border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
        />
        <button onClick={save} disabled={pending} className="btn-secondary text-xs px-3 py-2 shrink-0">
          {pending ? "Saving..." : saved ? <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Saved</span> : "Save"}
        </button>
      </div>
      <p className="text-xs text-ink-400 mt-1">Used to build a payment link in intro emails to new clients.</p>
    </div>
  );
}
