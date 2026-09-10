"use client";

import { useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { ReferralSource } from "@/lib/types";
import { createReferralSourceAction, deleteReferralSourceAction } from "@/lib/actions";

export default function ReferralSourcesManager({ initial }: { initial: ReferralSource[] }) {
  const [sources, setSources] = useState(initial);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function add() {
    if (!newName.trim()) return;
    setAdding(true);
    const src = await createReferralSourceAction(newName.trim());
    setSources((prev) => [...prev, src]);
    setNewName("");
    setAdding(false);
  }

  async function remove(id: string) {
    setDeletingId(id);
    await deleteReferralSourceAction(id);
    setSources((prev) => prev.filter((s) => s.id !== id));
    setDeletingId(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {sources.map((s) => (
          <span
            key={s.id}
            className="badge bg-ink-100 text-ink-600 flex items-center gap-1.5 pr-1.5"
          >
            {s.name}
            <button
              onClick={() => remove(s.id)}
              disabled={deletingId === s.id}
              className="rounded-full hover:bg-ink-300 p-0.5 transition-colors"
              title="Remove"
            >
              {deletingId === s.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add referral source…"
          className="flex-1 border border-ink-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
        />
        <button
          onClick={add}
          disabled={adding || !newName.trim()}
          className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
        >
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add
        </button>
      </div>
    </div>
  );
}
