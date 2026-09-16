"use client";

import { useState } from "react";
import { Trash2, Pencil, Check, X, Loader2 } from "lucide-react";

export default function SummaryCard({
  title,
  content,
  model,
  onDelete,
  onSave,
}: {
  title: string;
  content: Record<string, unknown>;
  model?: string | null;
  /** If provided, shows a delete button that clears this summary. */
  onDelete?: () => void;
  /** If provided, shows an edit button that lets the practitioner hand-correct any field before saving. */
  onSave?: (content: Record<string, unknown>) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(() => toEditableStrings(content));
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setDraft(toEditableStrings(content));
    setEditing(true);
  }

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    try {
      // Re-parse each field back to its original shape (arrays stay arrays,
      // everything else stays a string) so downstream renderers/consumers of
      // this summary's content don't break on a shape they don't expect.
      const nextContent: Record<string, unknown> = { ...content };
      for (const [k, v] of Object.entries(draft)) {
        nextContent[k] = Array.isArray(content[k]) ? v.split(",").map((s) => s.trim()).filter(Boolean) : v;
      }
      await onSave(nextContent);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-4 border-plum-200 bg-plum-50/40">
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="font-medium text-sm text-plum-800">{title}</span>
        <div className="flex items-center gap-2 shrink-0">
          {model && !editing && <span className="text-xs text-plum-400">{model}</span>}
          {editing ? (
            <>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="p-1 rounded text-plum-400 hover:text-sage-600 hover:bg-sage-50 disabled:opacity-50"
                title="Save changes"
                aria-label="Save changes"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="p-1 rounded text-plum-300 hover:text-ink-600 hover:bg-ink-50 disabled:opacity-50"
                title="Cancel"
                aria-label="Cancel editing"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              {onSave && (
                <button
                  type="button"
                  onClick={startEditing}
                  className="p-1 rounded text-plum-300 hover:text-clay-600 hover:bg-clay-50"
                  title="Edit this summary"
                  aria-label="Edit this summary"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="p-1 rounded text-plum-300 hover:text-red-500 hover:bg-red-50"
                  title="Delete this summary"
                  aria-label="Delete this summary"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {editing ? (
        <div className="space-y-3">
          {Object.entries(draft).map(([k, v]) => (
            <div key={k}>
              <label className="text-xs uppercase tracking-wide text-plum-500">{k.replace(/_/g, " ")}</label>
              <textarea
                value={v}
                onChange={(e) => setDraft((prev) => ({ ...prev, [k]: e.target.value }))}
                rows={Math.min(8, Math.max(2, Math.ceil(v.length / 60)))}
                className="mt-1 w-full border border-plum-200 rounded-lg px-2.5 py-1.5 text-sm text-ink-800 focus:outline-none focus:ring-2 focus:ring-plum-200 resize-y"
              />
            </div>
          ))}
        </div>
      ) : (
        <dl className="space-y-2">
          {Object.entries(content).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs uppercase tracking-wide text-plum-500">{k.replace(/_/g, " ")}</dt>
              <dd className="text-sm text-ink-800 whitespace-pre-line">{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

// Flattens arbitrary AiSummary.content (strings, arrays, occasionally other
// JSON-safe values) into plain strings a <textarea> can hold — arrays get
// joined as comma-separated so they round-trip back into an array on save.
function toEditableStrings(content: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(content)) {
    result[k] = Array.isArray(v) ? v.join(", ") : String(v);
  }
  return result;
}
