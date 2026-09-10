"use client";

import { useRef, useState } from "react";
import { FormTemplate, FormSubmission } from "@/lib/types";
import SignatureField, { SignatureValue } from "./SignatureField";
import { cx } from "@/lib/utils";
import { useFormSync } from "@/hooks/useFormSync";
import { FormPrefill } from "@/lib/formPrefill";

type Answers = Record<string, string | string[] | boolean>;

// Signature values are objects, but FormSubmission.answers is typed as
// Record<string, string | string[] | boolean> to mirror the future Supabase
// JSON column shape. We pack/unpack each SignatureValue into a handful of
// flat keys under the field id so it round-trips through that same map.
function packSignature(fieldId: string, sig: SignatureValue): Answers {
  return {
    [`${fieldId}__mode`]: sig.mode,
    [`${fieldId}__typedName`]: sig.typedName ?? "",
    [`${fieldId}__drawnDataUrl`]: sig.drawnDataUrl ?? "",
    [`${fieldId}__acknowledged`]: sig.acknowledged,
    [`${fieldId}__signedAt`]: sig.signedAt ?? "",
  };
}

function unpackSignature(fieldId: string, answers: Answers): SignatureValue | undefined {
  const mode = answers[`${fieldId}__mode`];
  if (mode !== "typed" && mode !== "drawn") return undefined;
  return {
    mode,
    typedName: (answers[`${fieldId}__typedName`] as string) || undefined,
    drawnDataUrl: (answers[`${fieldId}__drawnDataUrl`] as string) || undefined,
    acknowledged: Boolean(answers[`${fieldId}__acknowledged`]),
    signedAt: (answers[`${fieldId}__signedAt`] as string) || undefined,
  };
}

function isSignatureComplete(sig: SignatureValue | undefined): boolean {
  if (!sig || !sig.acknowledged) return false;
  if (sig.mode === "typed") return Boolean(sig.typedName?.trim());
  return Boolean(sig.drawnDataUrl);
}

export default function FormRenderer({
  template,
  submission,
  clientId,
  documentId,
  readOnly = false,
  packageValue,
  prefill,
  onSaveProgress,
  onSubmit,
  live = false,
  onPoll,
  editorLabel,
}: {
  template: FormTemplate;
  submission?: FormSubmission;
  clientId: string;
  documentId: string;
  readOnly?: boolean;
  // The fee owed is something the practitioner sets once on the client
  // record (Client.package_value), not something the client should be
  // asked to type in themselves. When provided, "fee" fields auto-fill from
  // this and render read-only instead of as an open text input.
  packageValue?: number;
  // Name/email/phone for the client and facilitator, drawn from records we
  // already hold (see lib/formPrefill.ts). Seeds matching short_text fields
  // that are still empty so neither party retypes what we already know.
  prefill?: FormPrefill;
  onSaveProgress?: (answers: Answers) => Promise<void>;
  onSubmit?: (answers: Answers, signed: boolean) => Promise<void>;
  // Live co-editing: when true, edits autosave (debounced) instead of only
  // saving on the explicit "Save progress" click, and `onPoll` is called on
  // an interval to pull in the other party's in-flight edits. Only fields
  // the other side touched are merged in — anything the local user is
  // currently mid-edit on (tracked in `dirtyRef`) is left alone so a poll
  // can never clobber what someone's actively typing.
  live?: boolean;
  onPoll?: () => Promise<FormSubmission | undefined>;
  // Shown in the live-sync indicator, e.g. "Molly" or "Ladd", so each side
  // knows whose screen they're watching update.
  editorLabel?: string;
}) {
  // Seed "fee" fields with the practitioner-set package value, and name/email/
  // phone fields from `prefill`, so neither party has to retype what we
  // already hold — but never stomp an existing saved/submitted answer.
  // Computed once as the initial state (rather than in an effect) since this
  // component remounts fresh each time its containing form card is opened.
  const [answers, setAnswers] = useState<Answers>(() => {
    const initial = submission?.answers ?? {};
    const next = { ...initial };

    if (packageValue !== undefined) {
      const formatted = `$${packageValue.toLocaleString()}`;
      for (const section of template.sections) {
        for (const field of section.fields) {
          if (field.type === "fee" && !next[field.id]) next[field.id] = formatted;
        }
      }
    }

    if (prefill) {
      // Restricted to short_text so a prefill key can never land on an
      // initial, signature, consent, or free-response field by accident.
      for (const section of template.sections) {
        for (const field of section.fields) {
          if (field.type !== "short_text") continue;
          const value = prefill[field.id];
          if (value && !next[field.id]) next[field.id] = value;
        }
      }
    }

    return next;
  });
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  // Tracks live submission state separately from the initial `submission`
  // prop so a poll picking up the other party's submit/sign can lock the
  // form immediately, without waiting for a full page reload.
  const [liveStatus, setLiveStatus] = useState(submission?.status);
  const [liveSignedAt, setLiveSignedAt] = useState(submission?.signed_at);
  const [syncState, setSyncState] = useState<"idle" | "saving" | "synced">("idle");
  const locked = readOnly || liveStatus === "signed" || liveStatus === "submitted";

  // Field ids edited locally since the last successful save — autosave only
  // ever sends this subset, and a poll only ever merges fields *not* in
  // this set, so the two directions can never stomp each other.
  const dirtyRef = useRef<Set<string>>(new Set());
  // Fields whose values are currently in-flight (save started, snapshot not
  // yet confirmed). Kept so that a delayed snapshot can't overwrite a field
  // between dirtyRef.clear() and the save completing.
  const pendingSaveRef = useRef<Set<string>>(new Set());
  // Always points at the latest answers state so debounce timeouts don't
  // bake in stale values from the render that created the closure.
  const answersRef = useRef<Answers>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep answersRef in sync with state on every render.
  answersRef.current = answers;

  function pick(obj: Answers, keys: Iterable<string>): Answers {
    const out: Answers = {};
    for (const k of keys) if (k in obj) out[k] = obj[k];
    return out;
  }

  function scheduleAutosave() {
    if (!live || !onSaveProgress) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const keys = [...dirtyRef.current];
      if (keys.length === 0) return;
      setSyncState("saving");
      // Read from the ref, not the closure — captures the latest state even if
      // the user kept typing after this timeout was scheduled.
      const partial = pick(answersRef.current, keys);
      // Mark as in-flight BEFORE clearing dirty, so the merge guard stays
      // active across the entire save round-trip.
      for (const k of keys) pendingSaveRef.current.add(k);
      dirtyRef.current.clear();
      await onSaveProgress(partial);
      for (const k of keys) pendingSaveRef.current.delete(k);
      setSyncState("synced");
    }, 350); // fast autosave so the other side sees updates quickly
  }

  function setField(id: string, value: string | string[] | boolean) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    dirtyRef.current.add(id);
    scheduleAutosave();
  }

  // Real-time sync: uses Firestore onSnapshot when Firebase client vars are
  // set, otherwise falls back to fast polling (700 ms). Either way, only
  // fields not currently dirty locally are merged in.
  useFormSync(
    documentId,
    live && !locked,
    (latest) => {
      setLiveStatus(latest.status);
      setLiveSignedAt(latest.signed_at);
      setAnswers((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [key, value] of Object.entries(latest.answers)) {
          // Skip fields the user is currently editing OR whose save is still
          // in-flight — prevents delayed snapshots from overwriting local input.
          if (dirtyRef.current.has(key) || pendingSaveRef.current.has(key)) continue;
          if (next[key] !== value) { next[key] = value; changed = true; }
        }
        return changed ? next : prev;
      });
    },
    onPoll ?? undefined,
    dirtyRef
  );

  // Whether any field will actually render the red asterisk below — if so the
  // form needs a legend explaining what it means. Derived rather than set per
  // template so every form in the library picks it up automatically.
  const showsRequiredMarker = template.sections.some((s) =>
    s.fields.some((f) => f.required && f.type !== "static_text" && f.type !== "signature")
  );

  const signatureFieldIds = template.sections.flatMap((s) => s.fields.filter((f) => f.type === "signature").map((f) => f.id));
  const allSignaturesComplete = signatureFieldIds.every((id) => isSignatureComplete(unpackSignature(id, answers)));

  async function handleSave() {
    if (!onSaveProgress) return;
    setBusy("save");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const keys = dirtyRef.current.size > 0 ? [...dirtyRef.current] : Object.keys(answers);
    dirtyRef.current.clear();
    await onSaveProgress(pick(answers, keys));
    setSyncState("synced");
    setBusy(null);
  }

  async function handleSubmit() {
    if (!onSubmit) return;
    setBusy("submit");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    dirtyRef.current.clear();
    await onSubmit(answers, allSignaturesComplete);
    setBusy(null);
  }

  return (
    <div className="space-y-6">
      {live && !locked && (
        <div className="flex items-center gap-1.5 text-xs text-ink-400">
          <span
            className={cx(
              "h-1.5 w-1.5 rounded-full",
              syncState === "saving" ? "bg-amber-400 animate-pulse" : "bg-sage-400"
            )}
          />
          {syncState === "saving"
            ? "Saving..."
            : editorLabel
              ? `Live — syncing with ${editorLabel}`
              : "Live — changes sync automatically"}
        </div>
      )}
      {locked && (
        <div className="rounded-xl bg-sage-50 border border-sage-200 text-sage-800 text-sm px-4 py-2.5">
          {liveStatus === "signed" ? "Signed and submitted." : "Submitted — awaiting review."}
          {liveSignedAt && <span className="text-sage-600"> · {new Date(liveSignedAt).toLocaleString()}</span>}
        </div>
      )}

      {showsRequiredMarker && !locked && (
        <p className="text-xs text-ink-500">
          <span className="text-clay-600">*</span> Required — this field must be completed before the form can be
          submitted.
        </p>
      )}

      {template.sections.map((section) => (
        <div key={section.id} className="card p-5">
          {section.title && <h3 className="font-medium text-ink-900 mb-2">{section.title}</h3>}
          {section.body && <p className="text-sm text-ink-600 whitespace-pre-line mb-4 leading-relaxed">{section.body}</p>}

          <div className="space-y-4">
            {section.fields.map((field) => {
              const value = answers[field.id];

              if (field.type === "static_text") {
                return (
                  <p key={field.id} className="text-sm text-ink-500 italic leading-relaxed">
                    {field.label}
                  </p>
                );
              }

              if (field.type === "signature") {
                return (
                  <SignatureField
                    key={field.id}
                    label={field.label}
                    declaration={
                      section.body ??
                      "By signing, I declare that I acknowledge and agree to the statement above and intend this signature to be legally binding."
                    }
                    value={unpackSignature(field.id, answers)}
                    disabled={locked}
                    onChange={(sig) => {
                      const packed = packSignature(field.id, sig);
                      setAnswers((prev) => ({ ...prev, ...packed }));
                      for (const key of Object.keys(packed)) dirtyRef.current.add(key);
                      scheduleAutosave();
                    }}
                  />
                );
              }

              return (
                <div key={field.id}>
                  <label className="text-sm text-ink-700 leading-snug block mb-1.5">
                    {field.label}
                    {field.required && <span className="text-clay-600"> *</span>}
                  </label>
                  {field.helpText && <p className="text-xs text-ink-400 mb-1.5">{field.helpText}</p>}

                  {field.type === "short_text" && (
                    <input
                      disabled={locked}
                      value={(value as string) ?? ""}
                      onChange={(e) => setField(field.id, e.target.value)}
                      className="w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200 disabled:bg-ink-50"
                    />
                  )}

                  {field.type === "long_text" && (
                    <textarea
                      disabled={locked}
                      value={(value as string) ?? ""}
                      onChange={(e) => setField(field.id, e.target.value)}
                      rows={3}
                      className="w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200 disabled:bg-ink-50"
                    />
                  )}

                  {field.type === "fee" && (
                    <input
                      disabled={locked || packageValue !== undefined}
                      value={(value as string) ?? ""}
                      onChange={(e) => setField(field.id, e.target.value)}
                      placeholder="$"
                      className="w-40 border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200 disabled:bg-ink-50"
                    />
                  )}

                  {field.type === "initial" && (
                    <input
                      disabled={locked}
                      value={(value as string) ?? ""}
                      onChange={(e) => setField(field.id, e.target.value)}
                      placeholder="Initials"
                      maxLength={6}
                      className="w-28 border border-ink-200 rounded-xl px-3 py-2 text-sm text-center font-medium italic focus:outline-none focus:ring-2 focus:ring-clay-200 disabled:bg-ink-50"
                    />
                  )}

                  {field.type === "yes_no" && (
                    <div className="flex gap-2">
                      {(["yes", "no"] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          disabled={locked}
                          onClick={() => setField(field.id, opt)}
                          className={cx(
                            "text-sm px-4 py-1.5 rounded-full border capitalize",
                            value === opt ? "bg-clay-600 text-white border-clay-600" : "border-ink-200 text-ink-600"
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}

                  {field.type === "select" && field.options && (
                    <select
                      disabled={locked}
                      value={(value as string) ?? ""}
                      onChange={(e) => setField(field.id, e.target.value)}
                      className="w-full sm:w-72 border border-ink-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-clay-200 disabled:bg-ink-50"
                    >
                      <option value="">Select one...</option>
                      {field.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {field.type === "multi_select" && field.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {field.options.map((opt) => {
                        const selected = Array.isArray(value) && value.includes(opt.value);
                        return (
                          <label key={opt.value} className="flex items-start gap-2 text-xs text-ink-600">
                            <input
                              type="checkbox"
                              disabled={locked}
                              checked={selected}
                              onChange={(e) => {
                                const current = Array.isArray(value) ? value : [];
                                setField(
                                  field.id,
                                  e.target.checked ? [...current, opt.value] : current.filter((v) => v !== opt.value)
                                );
                              }}
                              className="mt-0.5"
                            />
                            {opt.label}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {!locked && (onSaveProgress || onSubmit) && (
        <div className="flex justify-end gap-2">
          {onSaveProgress && (
            <button type="button" onClick={handleSave} disabled={busy !== null} className="btn-ghost text-sm px-4 py-2">
              {busy === "save" ? "Saving..." : "Save progress"}
            </button>
          )}
          {onSubmit && (
            <button type="button" onClick={handleSubmit} disabled={busy !== null} className="btn-primary text-sm px-4 py-2">
              {busy === "submit" ? "Submitting..." : allSignaturesComplete ? "Submit & Sign" : "Submit"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
