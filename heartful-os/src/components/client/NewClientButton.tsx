"use client";

import { useState } from "react";
import { Plus, X } from "@/components/ui/HeartfulIcon";
import { createClientAction, createReferralSourceAction } from "@/lib/actions";
import { ReferralSource } from "@/lib/types";

const OTHER_VALUE = "__other__";

export default function NewClientButton({
  referralSources: initial,
  initialOpen = false,
}: {
  referralSources: ReferralSource[];
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [referralSourceId, setReferralSourceId] = useState("");
  const [otherSource, setOtherSource] = useState("");
  const [packageName, setPackageName] = useState("");
  const [packageValue, setPackageValue] = useState("");
  // Live list so newly-added "Other" sources appear immediately
  const [sources, setSources] = useState(initial);

  const isOther = referralSourceId === OTHER_VALUE;

  function close() {
    setOpen(false);
    setFullName("");
    setEmail("");
    setPhone("");
    setReferralSourceId("");
    setOtherSource("");
    setPackageName("");
    setPackageValue("");
    setError(null);
  }

  return (
    <>
      <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> New Client
      </button>

      {open && (
        <div className="new-client-backdrop fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
          <div className="card w-full max-w-md p-6 bg-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium text-ink-900">New Client</h2>
              <button className="btn-ghost p-1" onClick={close} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!fullName.trim()) return;
                setBusy(true);
                setError(null);
                try {
                  // If "Other" was chosen, create the new referral source first
                  let resolvedSourceId = isOther ? undefined : (referralSourceId || undefined);
                  if (isOther && otherSource.trim()) {
                    const newSrc = await createReferralSourceAction(otherSource.trim());
                    setSources((prev) => [...prev, newSrc]);
                    resolvedSourceId = newSrc.id;
                  }

                  await createClientAction({
                    full_name: fullName.trim(),
                    email: email.trim() || undefined,
                    phone: phone.trim() || undefined,
                    referral_source_id: resolvedSourceId,
                    package_name: packageName.trim() || undefined,
                    // Guard against a lone "." surviving the input filter and
                    // sending NaN through to the client record.
                    package_value: Number.isFinite(Number(packageValue)) && packageValue
                      ? Number(packageValue)
                      : undefined,
                  });
                  setBusy(false);
                  close();
                } catch (err) {
                  if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
                  setBusy(false);
                  setError(err instanceof Error ? err.message : "Something went wrong creating this client.");
                }
              }}
            >
              <div>
                <label className="text-xs font-medium text-ink-500">Full name *</label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
                  placeholder="Jordan Avery"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-500">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
                  placeholder="jordan@example.com"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-500">Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
                  placeholder="(555) 555-0100"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-500">Referral source</label>
                <select
                  value={referralSourceId}
                  onChange={(e) => setReferralSourceId(e.target.value)}
                  className="mt-1 w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
                >
                  <option value="">— None —</option>
                  {sources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                  <option value={OTHER_VALUE}>Other…</option>
                </select>
                {isOther && (
                  <input
                    value={otherSource}
                    onChange={(e) => setOtherSource(e.target.value)}
                    placeholder="Describe the referral source"
                    className="mt-2 w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
                    autoFocus
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-ink-500">Package</label>
                  <input
                    value={packageName}
                    onChange={(e) => setPackageName(e.target.value)}
                    className="mt-1 w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
                    placeholder="Full Journey Support"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-500">Value ($)</label>
                  <input
                    // Deliberately not type="number" — that renders the browser's
                    // up/down spinner arrows, which are meaningless for a dollar
                    // amount nobody nudges one at a time. Text input with a numeric
                    // keypad on mobile and non-numeric characters filtered out.
                    type="text"
                    inputMode="decimal"
                    value={packageValue}
                    onChange={(e) => setPackageValue(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="mt-1 w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
                    placeholder="2400"
                  />
                </div>
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-ghost text-sm px-3 py-2" onClick={close}>
                  Cancel
                </button>
                <button type="submit" disabled={busy || !fullName.trim()} className="btn-primary text-sm px-4 py-2">
                  {busy ? "Creating..." : "Create Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
