"use client";

import { useState } from "react";
import { ShieldAlert, Pencil, X, Loader2, Check } from "lucide-react";
import { updateClientProfileAction } from "@/lib/actions";

export default function EmergencyContactEditor({
  clientId,
  initialName,
  initialRelationship,
  initialPhone,
  overview = false,
}: {
  clientId: string;
  initialName?: string;
  initialRelationship?: string;
  initialPhone?: string;
  overview?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName ?? "");
  const [relationship, setRelationship] = useState(initialRelationship ?? "");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [busy, setBusy] = useState(false);

  // Local display values (optimistic)
  const [displayName, setDisplayName] = useState(initialName ?? "");
  const [displayRelationship, setDisplayRelationship] = useState(initialRelationship ?? "");
  const [displayPhone, setDisplayPhone] = useState(initialPhone ?? "");

  const hasContact = !!displayName;

  async function save() {
    setBusy(true);
    await updateClientProfileAction(clientId, {
      emergency_contact_name: name.trim(),
      emergency_contact_relationship: relationship.trim(),
      emergency_contact_phone: phone.trim(),
    });
    setDisplayName(name.trim());
    setDisplayRelationship(relationship.trim());
    setDisplayPhone(phone.trim());
    setBusy(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="mt-3 bg-ink-50 rounded-lg px-3 py-3 w-full max-w-md space-y-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-ink-700 flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-clay-500" />
            Emergency Contact
          </span>
          <button
            onClick={() => {
              setName(displayName);
              setRelationship(displayRelationship);
              setPhone(displayPhone);
              setEditing(false);
            }}
            className="p-1 rounded hover:bg-ink-100 text-ink-400 hover:text-ink-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          className="w-full border border-ink-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-clay-200"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            placeholder="Relationship (e.g. spouse)"
            className="w-full border border-ink-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-clay-200"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            className="w-full border border-ink-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-clay-200"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={() => {
              setName(displayName);
              setRelationship(displayRelationship);
              setPhone(displayPhone);
              setEditing(false);
            }}
            className="text-xs text-ink-500 hover:text-ink-700 px-2 py-1 rounded"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={save}
            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Save
          </button>
        </div>
      </div>
    );
  }

  if (overview) {
    return (
      <div className="wn-emergency-overview">
        <div className="min-w-0">
          <span>Emergency contact</span>
          {hasContact ? (
            <strong>
              {displayName}{displayRelationship && ` (${displayRelationship})`}{displayPhone && ` — ${displayPhone}`}
            </strong>
          ) : (
            <strong className="is-empty">Not provided</strong>
          )}
        </div>
        <button
          onClick={() => setEditing(true)}
          className="wn-emergency-edit"
          title="Edit emergency contact"
          aria-label="Edit emergency contact"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2 text-xs text-ink-500 bg-ink-50 rounded-lg px-3 py-2 w-fit">
      <ShieldAlert className="h-3.5 w-3.5 text-clay-500 shrink-0" />
      {hasContact ? (
        <span>
          Emergency contact: <span className="text-ink-700 font-medium">{displayName}</span>
          {displayRelationship && ` (${displayRelationship})`}
          {displayPhone && ` — ${displayPhone}`}
        </span>
      ) : (
        <span className="text-ink-400 italic">No emergency contact on file</span>
      )}
      <button
        onClick={() => setEditing(true)}
        className="ml-1 p-0.5 rounded hover:bg-ink-200 text-ink-400 hover:text-ink-600 transition-colors"
        title="Edit emergency contact"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}
