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
import ActionCardHeader from "@/components/client/ActionCardHeader";
import SummaryCard from "@/components/ai/SummaryCard";
import { cx } from "@/lib/utils";
import { FileText, ScrollText } from "@/components/ui/HeartfulIcon";
import Link from "next/link";
import { formTemplateAppliesToSession, requiredFormsForSession } from "@/lib/requiredForms";

export default function PreparationWorkspace({
  clientId,
  clientName,
  documents,
  formTemplates,
  formSubmissions,
  existingBrief,
  canCompleteStage,
}: {
  clientId: string;
  clientName: string;
  documents: ClientDocument[];
  formTemplates: FormTemplate[];
  formSubmissions: FormSubmission[];
  existingBrief?: AiSummary;
  canCompleteStage: boolean;
}) {
  // Persisted to localStorage (not just React state) so the pasted transcript
  // survives a Generate click — that button triggers a router.refresh() to
  // pull the freshly generated summary from the server, and plain useState
  // isn't guaranteed to survive that trip through the Server Component tree.
  const transcriptStorageKey = `heartful_transcript_${clientId}_preparation`;
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
  const [brief, setBrief] = useState(existingBrief);

  const prepTemplates = formTemplates.filter(
    (template) => formTemplateAppliesToSession(template, "preparation")
  );
  const prepForms = prepTemplates.flatMap((t) => {
    const doc = documents.find((d) => d.document_type === t.document_type);
    return doc
      ? [{ doc, template: t, submission: formSubmissions.find((s) => s.document_id === doc.id) }]
      : [];
  });
  const unavailablePrepForms = requiredFormsForSession({
    sessionType: "preparation",
    templates: formTemplates,
    documents,
    submissions: formSubmissions,
  }).filter((form) => form.state === "missing_template" || form.state === "missing_document");

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
          description={`Generate a Journey Brief from ${clientName}'s preparation work for use on Journey Day.`}
          action={
            <AiGenerateButton
              clientId={clientId}
              summaryType="journey_brief"
              label="Generate Journey Brief"
              extra={{ transcript }}
              onDone={(s) => {
                setBrief(s as unknown as AiSummary);
                setTranscript("");
              }}
              disabled={!canCompleteStage || !transcript.trim()}
              className="btn-primary inline-flex items-center gap-2 whitespace-nowrap text-sm disabled:opacity-60"
            />
          }
        />
        <TranscriptInput value={transcript} onChange={setTranscript} hideLabel inlineUploadActions />
      </div>

      {brief && (
        <SummaryCard
          title="Journey Brief"
          titleAs="h2"
          titleClassName="font-semibold text-ink-900"
          content={brief.content}
          model={brief.model}
        />
      )}

      {(prepForms.length > 0 || unavailablePrepForms.length > 0) && (
        <div className="card p-4">
          <h3 className="session-panel-heading mb-3 flex items-center gap-3">
            <FileText className="h-4 w-4" aria-hidden="true" />
            Forms for This Session
          </h3>
          <div className="space-y-2">
            {prepForms.map(({ doc, template, submission }) => (
              <FormRow
                key={doc.id}
                doc={doc}
                template={template}
                submission={submission}
                clientId={clientId}
              />
            ))}
            {unavailablePrepForms.map((form) => (
              <div key={form.documentType} className="flex flex-wrap items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-sm text-ink-600">
                <FileText className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <span><strong className="font-medium text-ink-800">{form.title}</strong> {form.state === "missing_template" ? "is missing from the Form Library." : "is not attached to this client."}</span>
                <Link href="/settings/forms" className="ml-auto font-medium text-clay-700 underline underline-offset-2">Open Form Library</Link>
              </div>
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
