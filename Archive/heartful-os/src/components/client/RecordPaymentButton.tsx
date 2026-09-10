"use client";

import { useState } from "react";
import { DollarSign, Loader2, X, Check } from "lucide-react";
import { recordPaymentAction } from "@/lib/actions";

const METHODS = ["Cash", "Check", "Venmo", "Bank Transfer", "Other"];

export default function RecordPaymentButton({
  clientId,
  outstanding,
}: {
  clientId: string;
  outstanding: number;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(outstanding.toFixed(2));
  const [method, setMethod] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  if (outstanding <= 0) return null;

  async function handleSubmit() {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return;
    setSaving(true);
    await recordPaymentAction(clientId, parsed, method, notes || undefined);
    setSaving(false);
    setDone(true);
    setTimeout(() => {
      setOpen(false);
      setDone(false);
    }, 1000);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-sage-600 hover:text-sage-800 font-medium flex items-center gap-1 mt-0.5"
      >
        <DollarSign className="h-3 w-3" /> Record payment
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-ink-900">Record Payment</h2>
              <button onClick={() => setOpen(false)} className="text-ink-400 hover:text-ink-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-ink-600 block mb-1">Amount ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  autoFocus
                  className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-300"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-600 block mb-1">Method</label>
                <select
                  className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-300"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  {METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-ink-600 block mb-1">Notes (optional)</label>
                <input
                  className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-300"
                  placeholder="e.g. Final installment"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setOpen(false)} className="btn-ghost text-sm px-4 py-2">Cancel</button>
              <button
                disabled={saving || done}
                onClick={handleSubmit}
                className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5"
              >
                {done ? (
                  <><Check className="h-4 w-4" /> Saved</>
                ) : saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                ) : (
                  <><DollarSign className="h-4 w-4" /> Record Payment</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
