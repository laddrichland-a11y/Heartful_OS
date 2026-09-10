"use client";

import { Save, Loader2 } from "lucide-react";

// Small labeled text input + save button for recording a free-text dose
// amount (e.g. "25mg", "3.5g") — free text since substances and units vary
// by practice. Used for both the initial dose and the booster dose.
export default function DoseAmountField({
  label,
  value,
  onChange,
  onSave,
  saving,
  saved,
  placeholder = "e.g. 25mg, 3.5g…",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="text-xs font-medium text-ink-500">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-sm border border-ink-200 rounded-lg px-2 py-1 w-40 focus:outline-none focus:ring-2 focus:ring-clay-200"
      />
      <button
        disabled={saving}
        onClick={onSave}
        className="btn-ghost text-xs px-2 py-1 flex items-center gap-1"
      >
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
        Save
      </button>
      {saved && <span className="text-xs text-sage-600">Saved</span>}
    </div>
  );
}
