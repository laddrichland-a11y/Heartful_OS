import type { Client, ClientDocument, DocumentType, FormSubmission, FormTemplate } from "@/lib/types";

export const AGREEMENT_DOCUMENT_TYPES = [
  "informed_consent",
  "harm_reduction_services_agreement",
  "client_services_agreement",
] as const satisfies readonly DocumentType[];

export function isAgreementDocumentType(documentType: DocumentType): boolean {
  return AGREEMENT_DOCUMENT_TYPES.some((candidate) => candidate === documentType);
}

export type AgreementItemState = "not_opened" | "opened" | "completed";

export const AGREEMENT_STATE_LABELS: Record<AgreementItemState, string> = {
  not_opened: "Not opened",
  opened: "Opened",
  completed: "Completed",
};

export interface NormalizedAgreementItem {
  template: FormTemplate;
  document?: ClientDocument;
  submission?: FormSubmission;
  state: AgreementItemState;
  complete: boolean;
  completed_at?: string;
}

export interface NormalizedAgreementStatus {
  items: NormalizedAgreementItem[];
  completed_count: number;
  total_count: number;
  outstanding_count: number;
  complete: boolean;
  engagement: AgreementItemState;
  completed_at?: string;
}

export function requiredAgreementTemplates(templates: FormTemplate[]) {
  return templates.filter(
    (template) => template.active && template.required && isAgreementDocumentType(template.document_type),
  );
}

export function normalizeAgreementItem(
  template: FormTemplate,
  document: ClientDocument | undefined,
  submission: FormSubmission | undefined,
): NormalizedAgreementItem {
  const submissionComplete = submission?.status === "signed" || submission?.status === "submitted";
  // Explicit document-level "signed" is the legacy fallback for agreements
  // completed before digital form submissions became the primary record.
  const documentSigned = document?.status === "signed";
  const complete = submissionComplete || documentSigned;
  // File presence is not evidence that the client opened an agreement: a
  // practitioner may have uploaded or reviewed that file. A submission is
  // the reliable item-level engagement record.
  const opened = Boolean(submission);
  const completedAt = submission?.signed_at ?? submission?.submitted_at ?? (
    documentSigned
      ? [...(document?.versions ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.created_at
      : undefined
  );

  return {
    template,
    document,
    submission,
    state: complete ? "completed" : opened ? "opened" : "not_opened",
    complete,
    completed_at: completedAt,
  };
}

export function normalizeAgreementStatus({
  client,
  templates,
  documents,
  submissions,
}: {
  client?: Pick<Client, "portal_agreements_opened_at">;
  templates: FormTemplate[];
  documents: ClientDocument[];
  submissions: FormSubmission[];
}): NormalizedAgreementStatus {
  const items = requiredAgreementTemplates(templates).map((template) => {
    const document = documents.find((candidate) => candidate.document_type === template.document_type);
    const submission = document
      ? submissions.find((candidate) => candidate.document_id === document.id)
      : undefined;
    return normalizeAgreementItem(template, document, submission);
  });
  const completedItems = items.filter((item) => item.complete);
  const completedCount = completedItems.length;
  const totalCount = items.length;
  const complete = totalCount > 0 && completedCount === totalCount;
  const opened = Boolean(client?.portal_agreements_opened_at) || items.some((item) => item.state !== "not_opened");
  const timestamps = completedItems.flatMap((item) => item.completed_at ? [item.completed_at] : []);

  return {
    items,
    completed_count: completedCount,
    total_count: totalCount,
    outstanding_count: totalCount - completedCount,
    complete,
    engagement: complete ? "completed" : opened ? "opened" : "not_opened",
    completed_at: complete && timestamps.length > 0 ? timestamps.sort().at(-1) : undefined,
  };
}

export function agreementStateForDocument(
  document: ClientDocument,
  templates: FormTemplate[],
  submissions: FormSubmission[],
): AgreementItemState | undefined {
  if (!isAgreementDocumentType(document.document_type)) return undefined;
  const template = templates.find((candidate) => candidate.document_type === document.document_type);
  if (!template) return undefined;
  const submission = submissions.find((candidate) => candidate.document_id === document.id);
  return normalizeAgreementItem(template, document, submission).state;
}
