"use client";

import { useState } from "react";
import {
  AiSummary,
  ClientDocument,
  FormSubmission,
  FormTemplate,
  DOCUMENT_LABELS,
} from "@/lib/types";
import TranscriptInput from "@/components/ai/TranscriptInput";
import AiGenerateButton from "@/components/ai/AiGenerateButton";
import SummaryCard from "@/components/ai/SummaryCard";
import { cx } from "@/lib/utils";
import { FileText } from "@/components/ui/HeartfulIcon";
import Link from "next/link";

export default function IntegrationWorkspace({
  clientId,
  clientName,
  sessionNumber,
  documents,
  formTemplates,
  formSubmissions,
  existingSummary,
}: {
  clientId: string;
  clientName: string;
  sessionNumber: 1 | 2;
  documents: ClientDocument[];
  formTemplates: FormTemplate[];
  formSubmissions: FormSubmission[];
  existingSummary?: AiSummary;
}) {
  // Persisted to localStorage (not just React state) so the pasted transcript
  // survives a Generate click — that button triggers a router.refresh() to
  // pull the freshly generated summary from the server, and plain useState
  // isn't guaranteed to survive that trip through the Server Component tree.
  const transcriptStorageKey = `heartful_transcript_${clientId}_integration_${sessionNumber}`;
  const [transcript, setTranscriptState] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(transcriptStorageKey) ?? "";
  });
  function setTranscript(v: string) {
    setTranscriptState(v);
    if (typeof window !== "undefined") {
      if (v) window.localStorage.setItem(transcriptStorageKey, v);
      else window.localStorage.removeItem(transcriptStorageKey);
    }
  }
  const [summary, setSummary] = useState(existingSummary);

  // "Integration Summary" / "Second Integration Summary" — the button reads
  // `Generate ${summaryLabel}`.
  const summaryLabel = sessionNumber === 1 ? "Integration Summary" : "Second Integration Summary";

  const docType = sessionNumber === 1 ? "integration_session_1" : "integration_session_2";
  const doc = documents.find((d) => d.document_type === docType);
  const template = formTemplates.find((t) => t.document_type === docType);
  const submission = doc ? formSubmissions.find((s) => s.document_id === doc.id) : undefined;

  return (
    <div className="space-y-6">
      {/* Reflection Form */}
      <div className="card p-5">
        <h2 className="font-semibold text-ink-900 mb-4">
          Integration Session {sessionNumber} — Reflection Form
        </h2>
        {doc && template ? (
          <IntegrationFormCard
            doc={doc}
            template={template}
            submission={submission}
            clientId={clientId}
            clientName={clientName}
          />
        ) : (
          <p className="text-sm text-ink-400">
            Form not attached yet — go to <strong>Settings → Form Library → Update form content</strong> to sync.
          </p>
        )}
      </div>

      {/* AI Generation — same shape for both sessions: paste the transcript,
          generate that session's summary. Pre-session preparation is Prepare
          Me's job now (it reads the whole record, including this session's
          reflection form), so Session One no longer carries a separate
          "Integration Session One Brief" button that did the same work with
          less context. Briefs already generated stay in the client record. */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-ink-900">Session Transcript</h2>
        <TranscriptInput value={transcript} onChange={setTranscript} />
      </div>
      <div className="card p-5 space-y-3">
        <h3 className="font-semibold text-ink-900">{summaryLabel}</h3>
        <AiGenerateButton
          clientId={clientId}
          summaryType="integration_summary"
          label={`Generate ${summaryLabel}`}
          extra={{ transcript, integrationSession: sessionNumber }}
          onDone={(s) => setSummary(s as unknown as AiSummary)}
        />
        {summary ? (
          <SummaryCard title={summaryLabel} content={summary.content} model={summary.model} />
        ) : (
          <p className="text-xs text-ink-400">
            Paste the session transcript above, then generate the summary — it saves to the client
            record and marks Integration Session {sessionNumber} complete.
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simple clickable form row — title + status badge, opens full-page on click
// ---------------------------------------------------------------------------
function IntegrationFormCard({
  doc,
  template,
  submission,
  clientId,
}: {
  doc: ClientDocument;
  template: FormTemplate;
  submission?: FormSubmission;
  clientId: string;
  clientName: string;
}) {
  const submissionStatus = submission?.status ?? "missing";
  const docStatus = doc.status;

  const statusBadge =
    docStatus === "reviewed"
      ? { label: "Reviewed", cls: "bg-blue-100 text-blue-700" }
      : submissionStatus === "signed"
        ? { label: "Signed", cls: "bg-sage-100 text-sage-700" }
        : submissionStatus === "submitted"
          ? { label: "Submitted", cls: "bg-sage-100 text-sage-700" }
          : submissionStatus === "in_progress"
            ? { label: "In Progress", cls: "bg-amber-100 text-amber-700" }
            : { label: "Not Started", cls: "bg-ink-100 text-ink-500" };

  return (
    <Link
      href={`/clients/${clientId}/forms/${doc.id}`}
      target="_blank"
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-ink-100 hover:bg-ink-50/60 hover:border-clay-200 transition-colors group"
    >
      <FileText className="h-4 w-4 text-ink-400 shrink-0 group-hover:text-clay-500" />
      <span className="text-sm font-medium text-ink-800 group-hover:text-clay-700">
        {DOCUMENT_LABELS[doc.document_type] ?? template.title}
      </span>
      <span className={cx("badge ml-auto", statusBadge.cls)}>{statusBadge.label}</span>
    </Link>
  );
}
