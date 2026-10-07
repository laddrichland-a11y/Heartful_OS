"use client";

import { useState } from "react";
import AiGenerateButton from "@/components/ai/AiGenerateButton";
import { MoreHorizontal, Sparkles, Trash2 } from "@/components/ui/HeartfulIcon";
import { deleteAiSummaryAction } from "@/lib/actions";
import { AiSummary } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

function SummaryContent({ content }: { content: Record<string, unknown> }) {
  return (
    <dl className="journey-ai-summary-fields">
      {Object.entries(content).map(([key, value]) => (
        <div key={key}>
          <dt>{key.replace(/_/g, " ")}</dt>
          <dd>{Array.isArray(value) ? value.join(", ") : String(value ?? "—")}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function JourneyAiSummaries({ clientId, initialSummaries, checkInSubmitted, canCompleteStage }: {
  clientId: string;
  initialSummaries: AiSummary[];
  checkInSubmitted: boolean;
  canCompleteStage: boolean;
}) {
  const [summaries, setSummaries] = useState(initialSummaries);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const checkInSummaries = summaries
    .filter((summary) => summary.summary_type === "check_in_12hr_summary")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const current = checkInSummaries[0];
  const history = summaries
    .filter((summary) => summary.id !== current?.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  async function remove(summary: AiSummary) {
    if (!window.confirm(`Delete ${summary.title}? This cannot be undone.`)) return;
    setDeletingId(summary.id);
    try {
      await deleteAiSummaryAction(summary.id, clientId);
      setSummaries((previous) => previous.filter((item) => item.id !== summary.id));
    } finally {
      setDeletingId(null);
    }
  }

  function menu(summary: AiSummary) {
    return (
      <details className="journey-ai-summary-menu">
        <summary aria-label={`More actions for ${summary.title}`} title="More actions">
          <MoreHorizontal aria-hidden="true" />
        </summary>
        <div className="journey-ai-summary-menu-panel">
          <button type="button" disabled={deletingId === summary.id} onClick={() => remove(summary)}>
            <Trash2 aria-hidden="true" /> Delete summary
          </button>
        </div>
      </details>
    );
  }

  return (
    <section className="journey-ai-summaries" aria-labelledby="journey-ai-summaries-heading">
      <div className="journey-ai-summaries-header">
        <div>
          <h3 id="journey-ai-summaries-heading" className="journey-icon-heading"><Sparkles aria-hidden="true" />AI Summaries</h3>
        </div>
        <AiGenerateButton
          clientId={clientId}
          summaryType="check_in_12hr_summary"
          label={current ? "Regenerate" : "Generate Summary"}
          className="btn-primary journey-ai-summary-generate"
          disabled={!checkInSubmitted || !canCompleteStage}
          onDone={(summary) => {
            const generated = summary as AiSummary;
            setSummaries((previous) => [generated, ...previous.filter((item) => item.id !== generated.id)]);
          }}
        />
      </div>

      {current ? (
        <article className="journey-ai-summary-current">
          <div className="journey-ai-summary-title-row">
            <div>
              <h4>{current.title}</h4>
              <time dateTime={current.created_at} title={current.model ? `Model: ${current.model}` : undefined}>
                {formatDateTime(current.created_at)}
              </time>
            </div>
            {menu(current)}
          </div>
          <SummaryContent content={current.content} />
          <SourceNotesDetails notes={current.source_notes} />
        </article>
      ) : null}

      {history.length > 0 && (
        <details className="journey-ai-summary-history">
          <summary>View previous summaries ({history.length})</summary>
          <div className="journey-ai-summary-history-list">
            {history.map((summary) => (
              <article key={summary.id}>
                <div className="journey-ai-summary-title-row">
                  <details className="journey-ai-summary-history-entry">
                    <summary>
                      <strong>{summary.title}</strong>
                      <time dateTime={summary.created_at} title={summary.model ? `Model: ${summary.model}` : undefined}>
                        {formatDateTime(summary.created_at)}
                      </time>
                    </summary>
                    <SummaryContent content={summary.content} />
                    <SourceNotesDetails notes={summary.source_notes} />
                  </details>
                  {menu(summary)}
                </div>
              </article>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function SourceNotesDetails({ notes }: { notes?: string }) {
  if (!notes?.trim()) return null;
  return (
    <details className="mt-3 rounded-lg border border-ink-100 bg-white/60 px-3 py-2 text-sm">
      <summary className="cursor-pointer select-none text-xs font-medium text-ink-500 hover:text-ink-800">
        Notes this version was generated from
      </summary>
      <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap text-ink-700">{notes}</p>
    </details>
  );
}
