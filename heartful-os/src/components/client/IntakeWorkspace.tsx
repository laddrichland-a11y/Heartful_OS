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
import { cx, isGeneralPaperwork } from "@/lib/utils";
import { FileText } from "@/components/ui/HeartfulIcon";
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
  // Persisted to localStorage (not just React state) so the pasted transcript
  // survives a Generate click — that button triggers a router.refresh() to
  // pull the freshly generated summary from the server, and plain useState
  // isn't guaranteed to survive that trip through the Server Component tree.
  const transcriptStorageKey = `heartful_transcript_${clientId}_intake`;
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
  const [latest, setLatest] = useState(existingSummaries[0]);

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
      {/* Session Forms */}
      {intakeForms.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-ink-900 mb-4">Session Forms</h2>
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

      {/* Transcript + AI Summary */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-4 space-y-4">
          <ActionCardHeader
            title="Session Transcript"
            titleAs="h2"
            description={`Generate a client intake summary from ${clientName}'s transcript and save it to the client record.`}
            action={
              <AiGenerateButton
                clientId={clientId}
                summaryType="client_assessment_summary"
                label="Generate Client Intake Summary"
                extra={{ transcript }}
                onDone={(s) => setLatest(s as unknown as AiSummary)}
                className="btn-primary inline-flex items-center gap-2 whitespace-nowrap text-sm disabled:opacity-60"
              />
            }
          />
          <TranscriptInput value={transcript} onChange={setTranscript} />
        </div>
        <div className="space-y-4">
          <h2 className="font-semibold text-ink-900">Client Intake Summary</h2>
          {latest ? (
            <SummaryCard
              title="Client Intake Summary"
              content={latest.content}
              model={latest.model}
            />
          ) : (
            <div className="card p-6 text-sm text-ink-400 text-center">
              No assessment summary yet. Paste or upload a transcript and generate one.
            </div>
          )}
        </div>
      </div>
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
