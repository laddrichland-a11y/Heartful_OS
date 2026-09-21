"use client";

import { useState } from "react";
import { Trash2, Pencil, Check, X, Loader2, MoreHorizontal } from "@/components/ui/HeartfulIcon";

const ASSESSMENT_GROUPS = [
  { title: "Goals & background", keys: ["client_goals", "personal_history"] },
  { title: "Clinical context", keys: ["mental_health_history", "previous_psychedelic_experience", "current_challenges"] },
  { title: "Safety & support", keys: ["potential_risk_factors", "support_resources", "facilitator_concerns", "follow_up_recommendations"] },
] as const;

const JOURNEY_GROUPS = [
  { title: "Client context", keys: ["client_summary", "intentions", "themes"] },
  { title: "Navigation & support", keys: ["potential_challenges", "navigation_reminders", "support_recommendations"] },
  { title: "Integration", keys: ["integration_focus_areas"] },
] as const;

const ATTENTION_FIELDS = new Set(["potential_risk_factors", "facilitator_concerns", "potential_challenges", "navigation_reminders"]);

function assessmentLabel(key: string) {
  const label = key.replace(/_/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function SummaryCard({
  title,
  content,
  onDelete,
  onSave,
  variant,
}: {
  title: string;
  content: Record<string, unknown>;
  model?: string | null;
  /** If provided, shows a delete button that clears this summary. */
  onDelete?: () => void;
  /** If provided, shows an edit button that lets the practitioner hand-correct any field before saving. */
  onSave?: (content: Record<string, unknown>) => void | Promise<void>;
  variant?: "assessment" | "journey" | "analysis";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(() => toEditableStrings(content));
  const [saving, setSaving] = useState(false);
  const isSessionBrief = "focus_for_today" in content;

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

  if (variant) {
    const groups = variant === "assessment" ? ASSESSMENT_GROUPS : variant === "journey" ? JOURNEY_GROUPS : [];
    const groupedKeys = new Set<string>(groups.flatMap((group) => [...group.keys]));
    const extraEntries = Object.entries(content).filter(([key]) => !groupedKeys.has(key));

    return (
      <div className="session-assessment-content">
        <div className="session-assessment-actions" aria-label={`${title} actions`}>
          {editing ? (
            <>
              <button type="button" onClick={handleSave} disabled={saving}><Check aria-hidden="true" />{saving ? "Saving…" : "Save"}</button>
              <button type="button" onClick={() => setEditing(false)} disabled={saving}><X aria-hidden="true" />Cancel</button>
            </>
          ) : (
            <>
              {onSave && <button type="button" onClick={startEditing}><Pencil aria-hidden="true" />Edit</button>}
              {onDelete && (
                <details className="session-assessment-menu">
                  <summary aria-label={`More ${title} actions`} title="More actions"><MoreHorizontal aria-hidden="true" /></summary>
                  <div><button type="button" onClick={onDelete}><Trash2 aria-hidden="true" />Delete summary</button></div>
                </details>
              )}
            </>
          )}
        </div>
        {editing ? (
          <div className="session-assessment-edit-fields">
            {Object.entries(draft).map(([key, value]) => (
              <label key={key}>
                <span>{assessmentLabel(key)}</span>
                <textarea
                  value={value}
                  onChange={(event) => setDraft((previous) => ({ ...previous, [key]: event.target.value }))}
                  rows={Math.min(8, Math.max(2, Math.ceil(value.length / 60)))}
                />
              </label>
            ))}
          </div>
        ) : (
          <div className="session-assessment-groups">
            {groups.map((group) => {
              const entries = group.keys.filter((key) => key in content).map((key) => [key, content[key]] as const);
              return entries.length > 0 && (
                <section key={group.title} className="session-assessment-group" aria-label={group.title}>
                  <h4>{group.title}</h4>
                  <dl>{entries.map(([key, value]) => (
                    <div key={key} className={`session-assessment-field${ATTENTION_FIELDS.has(key) ? " session-assessment-field--attention" : key === "integration_focus_areas" ? " session-assessment-field--direction" : ""}`}>
                      <dt>{assessmentLabel(key)}</dt>
                      <dd>{toDisplayString(value)}</dd>
                    </div>
                  ))}</dl>
                </section>
              );
            })}
            {extraEntries.length > 0 && (
              <section className="session-assessment-group" aria-label="Additional details">
                <h4>{groups.length > 0 ? "Additional details" : "Details"}</h4>
                <dl>{extraEntries.map(([key, value]) => <div key={key} className="session-assessment-field"><dt>{assessmentLabel(key)}</dt><dd>{toDisplayString(value)}</dd></div>)}</dl>
              </section>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={isSessionBrief ? "ai-session-brief" : "card p-4 border-plum-200 bg-plum-50/40"}>
      <div className={isSessionBrief ? "ai-session-brief-header" : "flex items-center justify-between mb-2 gap-2"}>
        <div>
          <span className={isSessionBrief ? "ai-session-brief-title" : "font-medium text-sm text-plum-800"}>{title}</span>
          {isSessionBrief && <span className="ai-session-brief-kicker">A quick scan before the session</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
      ) : isSessionBrief ? (
        <SessionBriefContent content={content} />
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

export function SessionBriefContent({ content }: { content: Record<string, unknown> }) {
  const field = (key: string) => toDisplayString(content[key]);
  const focus = field("focus_for_today");
  const risk = field("risks_to_hold");
  const hasRisk = hasMeaningfulContent(risk);

  return (
    <div className="ai-session-brief-content">
      {focus && (
        <section className="ai-session-brief-focus">
          <p>Focus for today</p>
          <div>{renderBriefValue(focus)}</div>
        </section>
      )}
      <div className="ai-session-brief-grid">
        <section className="ai-session-brief-section">
          <h4>Context</h4>
          <BriefField label="Who is this client" value={field("who_is_this_client")} />
          <BriefField label="Why are they here" value={field("why_are_they_here")} />
        </section>
        <section className="ai-session-brief-section">
          <h4>Intentions &amp; insights</h4>
          <BriefField label="Their intentions" value={field("their_intentions")} />
          <BriefField label="Insights so far" value={field("insights_so_far")} />
        </section>
      </div>
      {hasRisk && (
        <section className="ai-session-brief-risk">
          <BriefField label="Risks to hold" value={risk} />
        </section>
      )}
      <section className="ai-session-brief-section ai-session-brief-commitments">
        <BriefField label="Commitments made" value={field("commitments_made")} />
      </section>
    </div>
  );
}

function BriefField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return <div className="ai-session-brief-field"><p>{label}</p><div>{renderBriefValue(value)}</div></div>;
}

function renderBriefValue(value: string) {
  const items = value.split(/\n|(?:^|\s)[•·]\s+/).map((item) => item.trim()).filter(Boolean);
  return items.length > 1 ? <ul>{items.map((item, index) => <li key={`${item}-${index}`}>{item.replace(/^[-*]\s*/, "")}</li>)}</ul> : <p>{value}</p>;
}

function toDisplayString(value: unknown) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String).join("\n");
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value);
}

function hasMeaningfulContent(value: string) {
  return Boolean(value) &&
    !/^(none(?: requiring immediate practitioner outreach)?|no (?:known|current|immediate|significant) (?:risks?|concerns?|safety concerns?)|no safety concerns?|no risks?|nothing|n\/?a)[.!\s]*$/i.test(value) &&
    !/^anything flagged from intake or prior sessions/i.test(value);
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
