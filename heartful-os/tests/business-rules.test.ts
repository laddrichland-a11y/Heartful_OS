import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAgreementStatus } from "@/lib/agreementStatus";
import { resolveRequiredForms } from "@/lib/requiredForms";
import { selectCurrentOrNextSession, selectSessionTimeline } from "@/lib/sessionSelectors";
import { canCompleteJourneyMilestone, canSetJourneyStatus, journeyCompletionIssue } from "@/lib/utils";
import type {
  ClientDocument,
  DocumentType,
  FormSubmission,
  FormTemplate,
  JourneyMilestone,
  Session,
} from "@/lib/types";

const milestoneKeys = [
  "intake_complete",
  "preparation_complete",
  "journey_complete",
  "check_in_12hr_complete",
  "integration_1_complete",
  "integration_2_complete",
  "growth_action_plan_complete",
] as const;

function milestones(completedThrough: number): JourneyMilestone[] {
  return milestoneKeys.map((milestone_key, index) => ({
    id: `m-${index}`,
    client_id: "client-1",
    milestone_key,
    label: milestone_key,
    sort_order: index + 1,
    completed: index < completedThrough,
  }));
}

function session(id: string, scheduled_at: string, status: Session["status"] = "scheduled"): Session {
  return {
    id,
    client_id: "client-1",
    practitioner_id: "practitioner-1",
    session_type: "integration_1",
    scheduled_at,
    duration_minutes: 60,
    status,
  };
}

function template(document_type: DocumentType): FormTemplate {
  return {
    id: `template-${document_type}`,
    document_type,
    title: document_type,
    required: true,
    active: true,
    sections: [],
  };
}

function document(document_type: DocumentType): ClientDocument {
  return {
    id: `document-${document_type}`,
    client_id: "client-1",
    document_type,
    title: document_type,
    required: true,
    status: "missing",
    versions: [],
  };
}

function submission(document_type: DocumentType, status: FormSubmission["status"]): FormSubmission {
  return {
    id: `submission-${document_type}`,
    client_id: "client-1",
    document_id: `document-${document_type}`,
    template_id: `template-${document_type}`,
    answers: { response: "Test response" },
    status,
    submitted_at: status === "submitted" || status === "signed" ? "2026-01-01T12:00:00.000Z" : undefined,
  };
}

test("journey stages can only complete in order", () => {
  const afterIntake = milestones(1);
  assert.equal(canCompleteJourneyMilestone(afterIntake, "preparation_complete"), true);
  assert.equal(canCompleteJourneyMilestone(afterIntake, "integration_2_complete"), false);
  assert.equal(journeyCompletionIssue(afterIntake, "integration_2_complete", true), "previous_stages_incomplete");
  assert.equal(canSetJourneyStatus(afterIntake, "preparation_complete"), true);
  assert.equal(canSetJourneyStatus(afterIntake, "integration_2"), false);
});

test("completion summaries require non-empty source content", () => {
  const readyForPreparation = milestones(1);
  assert.equal(journeyCompletionIssue(readyForPreparation, "preparation_complete", false), "missing_content");
  assert.equal(journeyCompletionIssue(readyForPreparation, "preparation_complete", true), undefined);
});

test("agreement normalization keeps opened and completed counts consistent", () => {
  const types: DocumentType[] = [
    "informed_consent",
    "harm_reduction_services_agreement",
    "client_services_agreement",
  ];
  const status = normalizeAgreementStatus({
    client: { portal_agreements_opened_at: "2026-01-01T10:00:00.000Z" },
    templates: types.map(template),
    documents: types.map(document),
    submissions: [submission(types[0], "signed"), submission(types[1], "in_progress")],
  });
  assert.equal(status.completed_count, 1);
  assert.equal(status.outstanding_count, 2);
  assert.equal(status.engagement, "opened");
  assert.equal(status.complete, false);
});

test("session selection prefers active, then nearest valid future session", () => {
  const now = "2026-01-01T12:00:00.000Z";
  const active = session("active", "2026-01-01T11:30:00.000Z");
  const near = session("near", "2026-01-01T13:00:00.000Z");
  const later = session("later", "2026-01-02T13:00:00.000Z");
  assert.equal(selectCurrentOrNextSession([later, near, active], now)?.id, "active");
  assert.equal(selectCurrentOrNextSession([later, near], now)?.id, "near");
  assert.equal(selectCurrentOrNextSession([session("past", "2025-12-30T12:00:00.000Z")], now), undefined);
  assert.equal(selectCurrentOrNextSession([
    session("cancelled", "2026-01-01T12:15:00.000Z", "cancelled"),
    session("completed", "2026-01-01T12:30:00.000Z", "completed"),
    near,
  ], now)?.id, "near");
  assert.deepEqual(selectSessionTimeline([], now).activeAndUpcoming, []);
});

test("required forms resolve one canonical outstanding count", () => {
  const types: DocumentType[] = [
    "participant_screening_form",
    "informed_consent",
    "harm_reduction_services_agreement",
    "client_services_agreement",
    "preparation_navigation_plan",
    "preparation_education_session",
  ];
  const forms = resolveRequiredForms({
    templates: types.map(template),
    documents: types.slice(0, 4).map(document),
    submissions: [
      submission(types[0], "submitted"),
      submission(types[1], "signed"),
      submission(types[2], "submitted"),
      submission(types[3], "in_progress"),
    ],
    currentPhase: "preparation",
  });
  assert.equal(forms.length, 6);
  assert.equal(forms.filter((form) => !form.complete).length, 3);
  assert.equal(forms.filter((form) => form.state === "in_progress").length, 1);
  assert.equal(forms.filter((form) => form.state === "missing_document").length, 2);
});
