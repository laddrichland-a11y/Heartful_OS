"use client";

import { useState } from "react";
import { FormTemplate, FormSubmission } from "@/lib/types";
import { FormPrefill } from "@/lib/formPrefill";
import FormRenderer from "./FormRenderer";
import {
  saveFormProgressAction,
  getFormSubmissionAction,
  submitClientFormAction,
  startLiveSessionAction,
  endLiveSessionAction,
} from "@/lib/actions";
import { Users, Pencil, Radio, Loader2, StopCircle } from "@/components/ui/HeartfulIcon";

export default function FullPageForm({
  clientId,
  documentId,
  templateId,
  template,
  submission: initialSubmission,
  packageValue,
  prefill,
  // When true renders the practitioner-side chrome (Start Live Session button,
  // "your client" editor label). When false renders the client-side view.
  isPractitioner = false,
}: {
  clientId: string;
  documentId: string;
  templateId: string;
  template: FormTemplate;
  submission?: FormSubmission;
  // Passed straight through to FormRenderer so fee fields autofill from the
  // client's package value and contact fields autofill from the client record
  // and practitioner profile.
  packageValue?: number;
  prefill?: FormPrefill;
  isPractitioner?: boolean;
}) {
  const [submission, setSubmission] = useState(initialSubmission);
  const [editing, setEditing] = useState(false);
  const [startingLive, setStartingLive] = useState(false);
  const [endingLive, setEndingLive] = useState(false);
  const status = submission?.status ?? "not_started";
  const isLocked = (status === "submitted" || status === "signed") && !editing;
  const isLive = status === "in_progress";
  const isDraft = status === "draft";

  // When editing a locked form, pass a modified copy so FormRenderer treats it as in-progress
  const submissionForRenderer =
    editing && submission
      ? { ...submission, status: "in_progress" as const, submitted_at: undefined, signed_at: undefined }
      : submission;

  async function handleStartLive() {
    setStartingLive(true);
    await startLiveSessionAction(clientId, documentId, templateId);
    const latest = await getFormSubmissionAction(documentId);
    if (latest) setSubmission(latest);
    setStartingLive(false);
  }

  async function handleEndLive() {
    setEndingLive(true);
    await endLiveSessionAction(clientId, documentId, templateId);
    const latest = await getFormSubmissionAction(documentId);
    if (latest) setSubmission(latest);
    setEndingLive(false);
  }

  return (
    <div className="space-y-4">
      {/* Practitioner: Start Live Session when form not yet in progress (or draft) */}
      {isPractitioner && !isLive && !isLocked && (
        <div className="flex items-center justify-between gap-3 bg-plum-50 border border-plum-200 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-medium text-plum-900">
              {isDraft ? "Resume Live Session" : "Co-edit with your client in real time"}
            </p>
            <p className="text-xs text-plum-600 mt-0.5">
              {isDraft
                ? "Restart the live session — both sides will sync in real time again."
                : "Starts a live session — both of you can fill out the form simultaneously and see each other’s changes as they happen."}
            </p>
          </div>
          <button
            onClick={handleStartLive}
            disabled={startingLive}
            className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1.5 shrink-0 bg-plum-600 hover:bg-plum-700 border-plum-600"
          >
            {startingLive ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Radio className="h-3.5 w-3.5" />
            )}
            {isDraft ? "Resume Live Session" : "Start Live Session"}
          </button>
        </div>
      )}

      {/* Practitioner: End Live Session button when live */}
      {isPractitioner && isLive && (
        <div className="flex justify-end">
          <button
            onClick={handleEndLive}
            disabled={endingLive}
            className="text-xs text-ink-500 hover:text-ink-800 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-ink-100"
          >
            {endingLive ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <StopCircle className="h-3 w-3" />
            )}
            End Live Session
          </button>
        </div>
      )}

      {/* Edit banner for locked forms */}
      {(status === "submitted" || status === "signed") && !editing && (
        <div className="flex items-center justify-between gap-3 bg-ink-50 border border-ink-200 rounded-xl px-4 py-2.5">
          <span className="text-sm text-ink-600">
            This form has been {status}. To make changes, click Edit.
          </span>
          <button
            onClick={() => setEditing(true)}
            className="btn-secondary text-sm px-3 py-1.5 flex items-center gap-1.5 shrink-0"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        </div>
      )}

      {/* Live collaboration notice */}
      {isLive && (
        <div className="flex items-center gap-2 text-xs text-sage-700 bg-sage-50 border border-sage-200 rounded-xl px-4 py-2.5">
          <Users className="h-4 w-4 shrink-0" />
          <span>
            <strong>Live session active</strong> — changes sync in real time. Both you and your{" "}
            {isPractitioner ? "client" : "practitioner"} can fill this out simultaneously.
          </span>
        </div>
      )}

      <FormRenderer
        template={template}
        submission={submissionForRenderer}
        clientId={clientId}
        documentId={documentId}
        readOnly={isLocked}
        packageValue={packageValue}
        prefill={prefill}
        live={isLive || editing}
        onPoll={async () => {
          const latest = await getFormSubmissionAction(documentId);
          if (latest) setSubmission(latest);
          return latest ?? undefined;
        }}
        editorLabel={isPractitioner ? "your client" : "your practitioner"}
        onSaveProgress={async (answers) => {
          await saveFormProgressAction(clientId, documentId, templateId, answers);
          const latest = await getFormSubmissionAction(documentId);
          if (latest) setSubmission(latest);
        }}
        onSubmit={async (answers, signed) => {
          await submitClientFormAction(clientId, documentId, templateId, answers, signed);
          setEditing(false);
          const latest = await getFormSubmissionAction(documentId);
          if (latest) setSubmission(latest);
        }}
      />
    </div>
  );
}
