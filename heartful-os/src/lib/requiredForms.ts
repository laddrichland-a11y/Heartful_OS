import { isAgreementDocumentType } from "@/lib/agreementStatus";
import {
  ClientDocument,
  DOCUMENT_LABELS,
  DocumentType,
  FormSubmission,
  FormTemplate,
  JourneyPhase,
  SessionType,
} from "@/lib/types";

export interface RequiredFormDefinition {
  documentType: DocumentType;
  phase: JourneyPhase;
  sessionTypes: SessionType[];
}

// One canonical map owns which digital form belongs to each journey stage.
// Legacy upload-only document types such as post_integration_form are not
// requirements: Integration Session 1/2 are the current editable templates.
export const REQUIRED_FORM_DEFINITIONS: readonly RequiredFormDefinition[] = [
  { documentType: "participant_screening_form", phase: "intake", sessionTypes: ["intake_assessment"] },
  { documentType: "informed_consent", phase: "intake", sessionTypes: ["intake_assessment"] },
  { documentType: "harm_reduction_services_agreement", phase: "intake", sessionTypes: ["intake_assessment"] },
  { documentType: "client_services_agreement", phase: "intake", sessionTypes: ["intake_assessment"] },
  { documentType: "preparation_navigation_plan", phase: "preparation", sessionTypes: ["preparation"] },
  { documentType: "preparation_education_session", phase: "preparation", sessionTypes: ["preparation"] },
  { documentType: "integration_session_1", phase: "integration_1", sessionTypes: ["integration_1"] },
  { documentType: "integration_session_2", phase: "integration_2", sessionTypes: ["integration_2"] },
];

const PHASE_ORDER: JourneyPhase[] = [
  "intake",
  "preparation",
  "harm_reduction_session",
  "post_journey_check_in",
  "integration_1",
  "integration_2",
  "closed",
];

const SESSION_PHASE: Record<SessionType, JourneyPhase> = {
  intake_assessment: "intake",
  preparation: "preparation",
  harm_reduction_support: "harm_reduction_session",
  check_in_12hr: "post_journey_check_in",
  integration_1: "integration_1",
  integration_2: "integration_2",
  other: "closed",
};

export type RequiredFormState =
  | "missing_template"
  | "missing_document"
  | "not_started"
  | "in_progress"
  | "complete";

export interface ResolvedRequiredForm {
  documentType: DocumentType;
  title: string;
  phase: JourneyPhase;
  sessionTypes: SessionType[];
  category: "form" | "agreement";
  template?: FormTemplate;
  document?: ClientDocument;
  submission?: FormSubmission;
  state: RequiredFormState;
  complete: boolean;
}

export function requiredFormDefinition(documentType: DocumentType) {
  return REQUIRED_FORM_DEFINITIONS.find((definition) => definition.documentType === documentType);
}

export function formTemplateSessionTypes(template: FormTemplate): SessionType[] {
  if (template.session_types?.length) return template.session_types;
  return requiredFormDefinition(template.document_type)?.sessionTypes ?? [];
}

export function formTemplateAppliesToSession(template: FormTemplate, sessionType: SessionType): boolean {
  return template.active && formTemplateSessionTypes(template).includes(sessionType);
}

function resolveState(document?: ClientDocument, submission?: FormSubmission): RequiredFormState {
  if (!document) return "missing_document";
  const submissionComplete = submission?.status === "submitted" || submission?.status === "signed";
  const legacyDocumentComplete = document.status === "signed" || document.status === "reviewed";
  if (submissionComplete || legacyDocumentComplete) return "complete";
  if (submission?.status === "draft" || submission?.status === "in_progress") return "in_progress";
  return "not_started";
}

function stateRank(state: RequiredFormState): number {
  return {
    missing_template: 0,
    missing_document: 0,
    not_started: 1,
    in_progress: 2,
    complete: 3,
  }[state];
}

export function resolveFormByDocumentType({
  documentType,
  templates,
  documents,
  submissions,
}: {
  documentType: DocumentType;
  templates: FormTemplate[];
  documents: ClientDocument[];
  submissions: FormSubmission[];
}): ResolvedRequiredForm {
  const definition = requiredFormDefinition(documentType);
  const template = templates
    .filter((candidate) => candidate.document_type === documentType && candidate.active)
    .sort((a, b) => Number(b.required) - Number(a.required))[0];
  const candidates = documents
    .filter((candidate) => candidate.document_type === documentType)
    .map((document) => {
      const matchingSubmissions = submissions.filter((candidate) => candidate.document_id === document.id);
      const submission = matchingSubmissions
        .sort((a, b) => stateRank(resolveState(document, b)) - stateRank(resolveState(document, a)))[0];
      return { document, submission, state: resolveState(document, submission) };
    })
    .sort((a, b) => stateRank(b.state) - stateRank(a.state));
  const document = candidates[0]?.document;
  const submission = candidates[0]?.submission;
  const state = template ? resolveState(document, submission) : "missing_template";
  const sessionTypes = template ? formTemplateSessionTypes(template) : definition?.sessionTypes ?? [];
  return {
    documentType,
    title: template?.title ?? DOCUMENT_LABELS[documentType] ?? documentType.replace(/_/g, " "),
    phase: definition?.phase ?? (sessionTypes[0] ? SESSION_PHASE[sessionTypes[0]] : "intake"),
    sessionTypes,
    category: isAgreementDocumentType(documentType) ? "agreement" : "form",
    template,
    document,
    submission,
    state,
    complete: state === "complete",
  };
}

export function resolveRequiredForms({
  templates,
  documents,
  submissions,
  currentPhase,
}: {
  templates: FormTemplate[];
  documents: ClientDocument[];
  submissions: FormSubmission[];
  currentPhase?: JourneyPhase;
}): ResolvedRequiredForm[] {
  const canonicalTypes = new Set(REQUIRED_FORM_DEFINITIONS.map((definition) => definition.documentType));
  const requiredTypes = [
    ...REQUIRED_FORM_DEFINITIONS
      .filter((definition) => {
        const matchingTemplates = templates.filter((candidate) => candidate.document_type === definition.documentType);
        return matchingTemplates.length === 0 || matchingTemplates.some((template) => template.active && template.required);
      })
      .map((definition) => definition.documentType),
    ...templates
      .filter((template) => template.active && template.required && !canonicalTypes.has(template.document_type))
      .map((template) => template.document_type),
  ];

  const currentPhaseIndex = currentPhase ? PHASE_ORDER.indexOf(currentPhase) : Number.POSITIVE_INFINITY;
  return [...new Set(requiredTypes)]
    .map((documentType) => resolveFormByDocumentType({ documentType, templates, documents, submissions }))
    .filter((item) => PHASE_ORDER.indexOf(item.phase) <= currentPhaseIndex);
}

export function requiredFormsForSession({
  sessionType,
  templates,
  documents,
  submissions,
}: {
  sessionType: SessionType;
  templates: FormTemplate[];
  documents: ClientDocument[];
  submissions: FormSubmission[];
}) {
  return resolveRequiredForms({ templates, documents, submissions })
    .filter((item) => item.sessionTypes.includes(sessionType));
}

export function submittedFormText(
  documentType: DocumentType,
  templates: FormTemplate[],
  documents: ClientDocument[],
  submissions: FormSubmission[],
): string | undefined {
  const form = resolveFormByDocumentType({ documentType, templates, documents, submissions });
  if (!form.submission || (form.submission.status !== "submitted" && form.submission.status !== "signed")) {
    return undefined;
  }
  return Object.entries(form.submission.answers)
    .map(([question, answer]) => `${question} ${Array.isArray(answer) ? answer.join(", ") : String(answer)}`)
    .join("\n");
}
