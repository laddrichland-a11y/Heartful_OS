"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X } from "lucide-react";
import { createProspectAction } from "@/lib/actions";

export default function NewProspectButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [referral, setReferral] = useState("");

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    const prospect = await createProspectAction({
      full_name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      referral_source: referral.trim() || undefined,
    });
    router.push(`/prospects/${prospect.id}`);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-primary text-sm flex items-center gap-1.5"
      >
        <Plus className="h-4 w-4" /> New Prospect
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink-900">New Prospect</h2>
          <button onClick={() => setOpen(false)} className="text-ink-400 hover:text-ink-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-ink-600 block mb-1">Full Name *</label>
            <input
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-300"
              placeholder="First Last"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600 block mb-1">Email</label>
            <input
              type="email"
              autoComplete="off"
              className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-300"
              placeholder="optional"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600 block mb-1">Phone</label>
            <input
              autoComplete="off"
              className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-300"
              placeholder="optional"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600 block mb-1">Referral Source</label>
            <input
              autoComplete="off"
              className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-300"
              placeholder="e.g. Word of mouth, Psychology Today…"
              value={referral}
              onChange={(e) => setReferral(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={() => setOpen(false)} className="btn-ghost text-sm px-4 py-2">Cancel</button>
          <button
            disabled={saving || !name.trim()}
            onClick={handleCreate}
            className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create Prospect
          </button>
        </div>
      </div>
    </div>
  );
}
