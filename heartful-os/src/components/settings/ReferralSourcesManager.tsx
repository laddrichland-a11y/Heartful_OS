"use client";

import { useRef, useState, type FormEvent } from "react";
import { Plus, X } from "@/components/ui/HeartfulIcon";
import { ReferralSource } from "@/lib/types";
import { createReferralSourceAction, deleteReferralSourceAction } from "@/lib/actions";

export default function ReferralSourcesManager({ initial }: { initial: ReferralSource[] }) {
  const [sources, setSources] = useState(initial);
  const [newName, setNewName] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function reveal() {
    setShowInput(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name || adding) return;
    setAdding(true);
    setError("");
    try {
      const source = await createReferralSourceAction(name);
      setSources((previous) => [...previous, source]);
      setNewName("");
      setShowInput(false);
    } catch {
      setError("Could not add source. Try again.");
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    setDeletingId(id);
    setError("");
    try {
      await deleteReferralSourceAction(id);
      setSources((previous) => previous.filter((source) => source.id !== id));
    } catch {
      setError("Could not remove source. Try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="settings-referrals">
      <div className="settings-source-list">
        {sources.map((source) => (
          <span key={source.id} className="settings-source-chip">
            {source.name}
            <button
              type="button"
              onClick={() => remove(source.id)}
              disabled={deletingId === source.id}
              aria-label={`Remove ${source.name}`}
              title={`Remove ${source.name}`}
            >
              <X size={13} aria-hidden="true" />
            </button>
          </span>
        ))}
        {!showInput && (
          <button type="button" className="settings-add-source" onClick={reveal}>
            <Plus size={14} aria-hidden="true" /> Add source
          </button>
        )}
      </div>
      {showInput && (
        <form className="settings-source-form" onSubmit={add}>
          <label className="sr-only" htmlFor="new-referral-source">New referral source</label>
          <input
            id="new-referral-source"
            ref={inputRef}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Escape") setShowInput(false); }}
            placeholder="Source name"
          />
          <button type="submit" className="btn-primary" disabled={adding || !newName.trim()}>
            {adding ? "Adding…" : "Add"}
          </button>
          <button type="button" className="settings-text-button" onClick={() => { setShowInput(false); setNewName(""); }}>
            Cancel
          </button>
        </form>
      )}
      {error && <p className="settings-error" role="alert">{error}</p>}
    </div>
  );
}
