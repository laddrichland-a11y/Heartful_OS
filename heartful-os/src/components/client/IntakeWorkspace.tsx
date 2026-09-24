"use client";

import { useState } from "react";
import TranscriptInput from "@/components/ai/TranscriptInput";
import AiGenerateButton from "@/components/ai/AiGenerateButton";
import ActionCardHeader from "@/components/client/ActionCardHeader";
import SummaryCard from "@/components/ai/SummaryCard";
import {
  AiSummary,
  ClientDocument,
  FormSubmission,
  FormTemplate,
  DOCUMENT_LABELS,
} from "@/lib/types";
import { cx, formatDateTime, isGeneralPaperwork } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  MessageSquareText,
  ScrollText,
} from "@/components/ui/HeartfulIcon";
import Link from "next/link";

export default function IntakeWorkspace({
  clientId,
  clientName,
  documents,
  formTemplates,
  formSubmissions,
  existingSummaries,
}: {
  clientId: string;
  clientName: string;
  documents: ClientDocument[];
  formTemplates: FormTemplate[];
  formSubmissions: FormSubmission[];
  existingSummaries: AiSummary[];
}) {
  // Keep only an unfinished transcript draft. Once it has generated a summary,
  // its local copy is cleared so the ready-to-use field does not repopulate
  // with text that has already been processed.
  const transcriptStorageKey = `heartful_transcript_${clientId}_intake`;
  const transcriptDraftKey = `${transcriptStorageKey}_draft`;
  const [transcript, setTranscriptState] = useState(() => {
    if (typeof window === "undefined") return "";
    if (window.localStorage.getItem(transcriptDraftKey) !== "true") {
      window.localStorage.removeItem(transcriptStorageKey);
      return "";
    }
    return window.localStorage.getItem(transcriptStorageKey) ?? "";
  });
  function setTranscript(v: string) {
    setTranscriptState(v);
    if (typeof window !== "undefined") {
      if (v) {
        window.localStorage.setItem(transcriptStorageKey, v);
        window.localStorage.setItem(transcriptDraftKey, "true");
      } else {
        window.localStorage.removeItem(transcriptStorageKey);
        window.localStorage.removeItem(transcriptDraftKey);
      }
    }
  }
  const [latest, setLatest] = useState(existingSummaries[0]);
  const [summaryExpanded, setSummaryExpanded] = useState(true);

  // Only the intake's own form(s). The signed-once agreements are tagged for
  // this session type so the client portal serves them at the right moment,
  // but they aren't intake work — they live under "All Paperwork" instead.
  const intakeTemplates = formTemplates.filter(
    (t) =>
      t.session_types?.includes("intake_assessment") &&
      t.active &&
      !isGeneralPaperwork(t.document_type)
  );
  const intakeForms = intakeTemplates.flatMap((t) => {
    const doc = documents.find((d) => d.document_type === t.document_type);
    return doc
      ? [{ doc, template: t, submission: formSubmissions.find((s) => s.document_id === doc.id) }]
      : [];
  });

  return (
    <div className="space-y-6">
      <div className="card p-4 space-y-3">
        <ActionCardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <ScrollText className="h-4 w-4" aria-hidden="true" />
              Session Transcript
            </span>
          }
          titleAs="h2"
          description={`Generate a client intake summary from ${clientName}'s transcript and save it to the client record.`}
          action={
            <AiGenerateButton
              clientId={clientId}
              summaryType="client_assessment_summary"
              label="Generate Client Intake Summary"
              extra={{ transcript }}
              onDone={(s) => {
                setLatest(s as unknown as AiSummary);
                setSummaryExpanded(true);
                setTranscript("");
              }}
              disabled={!transcript.trim()}
              className="btn-primary inline-flex items-center gap-2 whitespace-nowrap text-sm disabled:opacity-60"
            />
          }
        />
        <TranscriptInput value={transcript} onChange={setTranscript} hideLabel inlineUploadActions />
      </div>

      {latest && (
        <div className="card p-4 space-y-3">
          <h3 className="session-panel-heading flex items-center gap-3">
            <MessageSquareText className="h-4 w-4" aria-hidden="true" />
            Session Summary
          </h3>
          <p className="text-xs text-ink-400">
            The client intake summary of record, generated from the intake transcript and saved to {clientName}&apos;s
            client record.
          </p>
          <button
            type="button"
            onClick={() => setSummaryExpanded((expanded) => !expanded)}
            aria-expanded={summaryExpanded}
            aria-controls={`intake-summary-${latest.id}`}
            className="flex w-full items-center gap-2 py-1 text-left text-sm text-ink-500 hover:text-ink-800"
          >
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Session Summary — {formatDateTime(latest.created_at)}</span>
            {summaryExpanded ? (
              <ChevronUp className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" />
            )}
          </button>
          {summaryExpanded && (
            <div id={`intake-summary-${latest.id}`} className="mt-2">
              <SummaryCard
                title="Client Intake Summary"
                content={latest.content}
                model={latest.model}
                titleAs="h2"
                titleClassName="font-semibold text-ink-900"
              />
            </div>
          )}
        </div>
      )}

      {intakeForms.length > 0 && (
        <div className="card p-4">
          <h3 className="session-panel-heading mb-3 flex items-center gap-3">
            <FileText className="h-4 w-4" aria-hidden="true" />
            Forms for This Session
          </h3>
          <div className="space-y-2">
            {intakeForms.map(({ doc, template, submission }) => (
              <FormRow
                key={doc.id}
                doc={doc}
                template={template}
                submission={submission}
                clientId={clientId}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simple clickable form row — title + status badge, opens full-page on click
// ---------------------------------------------------------------------------
function FormRow({
  doc,
  template,
  submission,
  clientId,
}: {
  doc: ClientDocument;
  template: FormTemplate;
  submission?: FormSubmission;
  clientId: string;
}) {
  const submissionStatus = submission?.status ?? "missing";
  const statusBadge =
    doc.status === "reviewed"
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
