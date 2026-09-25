import { NextRequest, NextResponse } from "next/server";
import { runAiJson } from "@/lib/ai/generate";
import * as prompts from "@/lib/ai/prompts";
import * as mocks from "@/lib/ai/mocks";
import {
  addAiSummary,
  addMemoryItems,
  getMemory,
  getAiSummaries,
  getDocuments,
  getFormSubmissionsForClient,
  getFormTemplates,
  getMilestones,
  getPostIntegrationForms,
  getPreparationPlan,
  getSessionNotes,
  getSessions,
  setGrowthActionPlan,
  getGrowthActionPlan,
  getCheckIns,
  completeMilestone,
  syncJourneyProgressFromMilestones,
} from "@/lib/data";
import { AiSummary, AiSummaryType, ClientDocument, FormSubmission, FormTemplate, JourneyPhase, Session, SessionType } from "@/lib/types";
import { journeyCompletionIssue, type JourneyCompletionMilestoneKey } from "@/lib/utils";
import { authorizationResponse, requireClientAccess } from "@/lib/serverAuth";
import { formTemplateSessionTypes, submittedFormText } from "@/lib/requiredForms";

const PREPARE_ME_STAGE_ORDER: Record<SessionType, number> = {
  intake_assessment: 0,
  preparation: 1,
  harm_reduction_support: 2,
  check_in_12hr: 3,
  integration_1: 4,
  integration_2: 5,
  other: 6,
};

const PREPARE_ME_LABEL_STAGE_ORDER: Record<string, number> = {
  "Intake & Assessment": 0,
  Preparation: 1,
  "Journey Day": 2,
  "12-Hour Check-In": 3,
  "Integration Session 1": 4,
  "Integration Session One": 4,
  "Integration Session 2": 5,
  "Integration Session Two": 5,
  "Growth Plan": 6,
  "Growth Action Plan": 6,
};

function prepareMeStageOrder(sessionId: string | undefined, sessions: Session[], label: string | undefined): number {
  const session = sessionId ? sessions.find((item) => item.id === sessionId) : undefined;
  return session ? PREPARE_ME_STAGE_ORDER[session.session_type] : PREPARE_ME_LABEL_STAGE_ORDER[label ?? ""] ?? 6;
}

function summaryStageOrder(summary: AiSummary, sessions: Session[]): number | undefined {
  const session = summary.session_id ? sessions.find((item) => item.id === summary.session_id) : undefined;
  if (session) return PREPARE_ME_STAGE_ORDER[session.session_type];
  if (summary.stage_label) return PREPARE_ME_LABEL_STAGE_ORDER[summary.stage_label];
  switch (summary.summary_type) {
    case "client_assessment_summary": return 0;
    case "journey_brief": return 1;
    case "journey_summary":
    case "journey_manual_notes_summary": return 2;
    case "check_in_12hr_summary": return 3;
    case "integration_1_brief": return 4;
    case "growth_action_plan": return 6;
    case "integration_summary": return summary.title.includes("2") ? 5 : 4;
    default: return undefined;
  }
}

function formStageOrder(submission: FormSubmission, documents: ClientDocument[], templates: FormTemplate[]): number {
  const template = templates.find((item) => item.id === submission.template_id);
  const sessionType = template ? formTemplateSessionTypes(template)[0] : undefined;
  if (sessionType) return PREPARE_ME_STAGE_ORDER[sessionType];

  const documentType = documents.find((item) => item.id === submission.document_id)?.document_type;
  if (["participant_screening_form", "informed_consent", "harm_reduction_services_agreement", "client_services_agreement"].includes(documentType ?? "")) return 0;
  if (["preparation_navigation_plan", "preparation_education_session"].includes(documentType ?? "")) return 1;
  if (["integration_session_1", "post_integration_form"].includes(documentType ?? "")) return 4;
  if (["integration_session_2", "post_integration_form_updated"].includes(documentType ?? "")) return 5;
  return 6;
}

function journeyPhaseStageOrder(phase: JourneyPhase): number {
  const phases: Record<JourneyPhase, number> = {
    intake: 0,
    preparation: 1,
    harm_reduction_session: 2,
    post_journey_check_in: 3,
    integration_1: 4,
    integration_2: 5,
    closed: 6,
  };
  return phases[phase];
}

interface GenerateRequest {
  clientId: string;
  summaryType: AiSummaryType;
  transcript?: string;
  sessionId?: string;
  sessionTypeLabel?: string;
  checkInId?: string;
  integrationSession?: 1 | 2;
  /** Requests a fresh alternative rather than reusing an existing briefing. */
  regenerate?: boolean;
}

async function stageCompletionError(
  clientId: string,
  milestoneKey: JourneyCompletionMilestoneKey,
  hasContent: boolean,
): Promise<NextResponse | undefined> {
  const milestones = await getMilestones(clientId);
  const issue = journeyCompletionIssue(milestones, milestoneKey, hasContent);
  if (issue === "missing_content") {
    return NextResponse.json(
      { error: "Add transcript or submitted stage content before generating a completion summary." },
      { status: 400 },
    );
  }
  if (issue === "previous_stages_incomplete") {
    return NextResponse.json(
      { error: "Complete all previous journey stages before completing this stage." },
      { status: 409 },
    );
  }
}

async function completeJourneyStage(clientId: string, milestoneKey: JourneyCompletionMilestoneKey) {
  await completeMilestone(clientId, milestoneKey);
  await syncJourneyProgressFromMilestones(clientId);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateRequest;
    const { clientId, summaryType } = body;
    if (!clientId || !summaryType) {
      return NextResponse.json({ error: "clientId and summaryType are required" }, { status: 400 });
    }
    const { client } = await requireClientAccess(clientId);
    if (body.sessionId && !(await getSessions(clientId)).some((session) => session.id === body.sessionId)) {
      return NextResponse.json({ error: "Session does not belong to this client." }, { status: 403 });
    }

    switch (summaryType) {
    case "client_assessment_summary": {
      const transcript = body.transcript ?? "";
      const completionError = await stageCompletionError(clientId, "intake_complete", Boolean(transcript.trim()));
      if (completionError) return completionError;
      const prompt = prompts.buildAssessmentSummaryPrompt(transcript, client.full_name);
      const { data, model } = await runAiJson(prompt, () => mocks.mockAssessmentSummary(transcript, client.full_name));
      const summary = await addAiSummary(clientId, summaryType, "Client Assessment Summary", data, model);
      await addMemoryItems(clientId, [
        { item_type: "challenge", content: String((data as Record<string, unknown>).potential_risk_factors ?? ""), phase: "intake" },
      ]);
      await completeJourneyStage(clientId, "intake_complete");
      return NextResponse.json({ summary });
    }
    case "journey_brief": {
      const transcript = body.transcript ?? "";
      const completionError = await stageCompletionError(clientId, "preparation_complete", Boolean(transcript.trim()));
      if (completionError) return completionError;
      const plan = await getPreparationPlan(clientId);
      const planSummary = plan
        ? Object.entries(plan)
            .filter(([k]) => !["id", "client_id", "updated_at"].includes(k))
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n")
        : "No preparation plan recorded yet.";
      const prompt = prompts.buildJourneyBriefPrompt(transcript, client.full_name, planSummary);
      const { data, model } = await runAiJson(prompt, () => mocks.mockJourneyBrief(client.full_name));
      const summary = await addAiSummary(clientId, summaryType, "Journey Brief", data, model);
      await completeJourneyStage(clientId, "preparation_complete");
      return NextResponse.json({ summary });
    }
    case "journey_summary": {
      const notes = body.transcript ?? "";
      const completionError = await stageCompletionError(clientId, "journey_complete", Boolean(notes.trim()));
      if (completionError) return completionError;
      const prompt = prompts.buildJourneySummaryPrompt(notes, client.full_name);
      const { data, model } = await runAiJson(prompt, () => mocks.mockJourneySummary(client.full_name));
      const summary = await addAiSummary(clientId, summaryType, "Journey Summary", data, model);
      await completeJourneyStage(clientId, "journey_complete");
      return NextResponse.json({ summary });
    }
    case "journey_manual_notes_summary": {
      const manualNotes = body.transcript ?? "";
      const sessionTypeLabel = body.sessionTypeLabel ?? "Session";
      const prompt = prompts.buildJourneyManualNotesSummaryPrompt(manualNotes, client.full_name, sessionTypeLabel);
      const { data, model } = await runAiJson(prompt, () => mocks.mockJourneyManualNotesSummary(client.full_name));
      const summary = await addAiSummary(
        clientId,
        summaryType,
        `${sessionTypeLabel} Summary - Practitioner`,
        data,
        model,
        body.sessionId
      );
      return NextResponse.json({ summary });
    }
    case "check_in_12hr_summary": {
      const checkIns = await getCheckIns(clientId);
      const latest = checkIns[checkIns.length - 1];
      const hasSubmittedContent = Boolean(
        latest?.submitted_at && [
          latest.emotional_state,
          latest.physical_state,
          latest.immediate_insights,
          latest.support_needs,
          latest.safety_concerns,
        ].some((value) => value?.trim()),
      );
      const completionError = await stageCompletionError(clientId, "check_in_12hr_complete", hasSubmittedContent);
      if (completionError) return completionError;
      const checkInData = latest
        ? `Emotional State: ${latest.emotional_state}\nPhysical State: ${latest.physical_state}\nImmediate Insights: ${latest.immediate_insights}\nSupport Needs: ${latest.support_needs}\nSafety Concerns: ${latest.safety_concerns}`
        : "No check-in data submitted.";
      const prompt = prompts.buildCheckInSummaryPrompt(checkInData, client.full_name);
      const { data, model } = await runAiJson(prompt, () => mocks.mockCheckInSummary(client.full_name));
      const summary = await addAiSummary(clientId, summaryType, "12-Hour Check-In Summary", data, model);
      await completeJourneyStage(clientId, "check_in_12hr_complete");
      return NextResponse.json({ summary });
    }
    case "integration_1_brief": {
      const transcript = body.transcript ?? "";
      const [pifs, documents, formTemplates, formSubmissions] = await Promise.all([
        getPostIntegrationForms(clientId),
        getDocuments(clientId),
        getFormTemplates(),
        getFormSubmissionsForClient(clientId),
      ]);
      const pif1 = pifs.find((f) => f.integration_session === 1);
      const pifText = submittedFormText("integration_session_1", formTemplates, documents, formSubmissions)
        ?? (pif1 ? Object.entries(pif1.responses).map(([q, a]) => `${q} ${a}`).join("\n") : "No form submitted.");
      const briefs = await getAiSummaries(clientId, "journey_brief");
      const summaries = await getAiSummaries(clientId, "journey_summary");
      const prompt = prompts.buildIntegration1BriefPrompt(
        pifText,
        JSON.stringify(briefs[0]?.content ?? {}),
        JSON.stringify(summaries[0]?.content ?? {}),
        transcript,
        client.full_name
      );
      const { data, model } = await runAiJson(prompt, () => mocks.mockIntegration1Brief(client.full_name));
      const summary = await addAiSummary(clientId, summaryType, "Integration Session One Brief", data, model);
      return NextResponse.json({ summary });
    }
    case "integration_summary": {
      const transcript = body.transcript ?? "";
      const sessionNumber = body.integrationSession ?? 1;
      const milestoneKey = sessionNumber === 1 ? "integration_1_complete" : "integration_2_complete";
      const completionError = await stageCompletionError(clientId, milestoneKey, Boolean(transcript.trim()));
      if (completionError) return completionError;
      const prompt = prompts.buildIntegrationSummaryPrompt(sessionNumber, transcript, client.full_name);
      const { data, model } = await runAiJson(prompt, () => mocks.mockIntegrationSummary(sessionNumber, client.full_name));
      const summary = await addAiSummary(clientId, summaryType, `Integration Summary ${sessionNumber}`, data, model);
      await completeJourneyStage(clientId, milestoneKey);
      return NextResponse.json({ summary });
    }
    case "growth_action_plan": {
      const completionError = await stageCompletionError(
        clientId,
        "growth_action_plan_complete",
        Boolean(body.transcript?.trim()),
      );
      if (completionError) return completionError;
      const [pifs, documents, formTemplates, formSubmissions] = await Promise.all([
        getPostIntegrationForms(clientId),
        getDocuments(clientId),
        getFormTemplates(),
        getFormSubmissionsForClient(clientId),
      ]);
      const pif2 = pifs.find((f) => f.integration_session === 2);
      const pifText = submittedFormText("integration_session_2", formTemplates, documents, formSubmissions)
        ?? (pif2 ? Object.entries(pif2.responses).map(([q, a]) => `${q} ${a}`).join("\n") : "No form submitted.");
      const memory = await getMemory(clientId);
      const summaries = await getAiSummaries(clientId);
      const priorContext = [
        ...memory.map((m) => `${m.item_type}: ${m.content}`),
        ...summaries.map((s) => `${s.title}: ${JSON.stringify(s.content)}`),
      ].join("\n");
      // If a plan already exists, this is an enhance pass — the new transcript
      // (if any) gets folded into the existing plan rather than starting over.
      const existingPlan = await getGrowthActionPlan(clientId);
      const additionalTranscript = body.transcript || undefined;
      const prompt = prompts.buildGrowthActionPlanPrompt(pifText, priorContext, client.full_name, {
        additionalTranscript,
        existingPlan: existingPlan
          ? {
              thirty_day_commitments: existingPlan.thirty_day_commitments,
              behavioral_experiments: existingPlan.behavioral_experiments,
              daily_practices: existingPlan.daily_practices,
              reflection_questions: existingPlan.reflection_questions,
              accountability_commitments: existingPlan.accountability_commitments,
            }
          : undefined,
      });
      const { data, model } = await runAiJson<{
        thirty_day_commitments: string[];
        behavioral_experiments: string[];
        daily_practices: string[];
        reflection_questions: string[];
        accountability_commitments: string[];
      }>(prompt, () => mocks.mockGrowthActionPlan(client.full_name));
      const summary = await addAiSummary(clientId, summaryType, "Growth Action Plan", data, model);
      await setGrowthActionPlan(clientId, data);
      await completeJourneyStage(clientId, "growth_action_plan_complete");
      return NextResponse.json({ summary });
    }
    case "prepare_me_briefing": {
      const [milestones, documents, formTemplates, formSubmissions, postIntegrationForms, checkIns, allSessions, memory, summaries, plan] =
        await Promise.all([
          getMilestones(clientId),
          getDocuments(clientId),
          getFormTemplates(),
          getFormSubmissionsForClient(clientId),
          getPostIntegrationForms(clientId),
          getCheckIns(clientId),
          getSessions(clientId),
          getMemory(clientId),
          getAiSummaries(clientId),
          getPreparationPlan(clientId),
        ]);
      // Prepare Me must accumulate context stage-by-stage. Do not let a future
      // session's notes or a later form leak backwards into an earlier briefing.
      // The active stage itself is intentionally excluded: this button prepares
      // the practitioner for the session; it does not summarize it afterward.
      const stageOrder = prepareMeStageOrder(body.sessionId, allSessions, body.sessionTypeLabel);
      const priorSessions = allSessions.filter((session) => PREPARE_ME_STAGE_ORDER[session.session_type] < stageOrder);
      const sessionHistory = priorSessions.map((s) => ({
        session_type: s.session_type,
        status: s.status,
        scheduled_at: s.scheduled_at,
        manual_notes: s.manual_notes,
        transcript: s.transcript,
      }));
      const priorSessionNotes = await Promise.all(
        priorSessions.map(async (session) => ({
          session_id: session.id,
          session_type: session.session_type,
          notes: await getSessionNotes(session.id),
        }))
      );
      const completedForms = formSubmissions
        // A completed form for the current stage is preparatory input (for
        // example, the post-journey reflection before Integration 1), so it
        // belongs in the briefing too.
        .filter((submission) => (submission.status === "submitted" || submission.status === "signed") && formStageOrder(submission, documents, formTemplates) <= stageOrder)
        .map((submission) => ({
          document: documents.find((document) => document.id === submission.document_id)?.title,
          answers: submission.answers,
          completed_at: submission.signed_at ?? submission.submitted_at,
        }));
      const priorSummaries = summaries.filter((summary) => {
        const order = summaryStageOrder(summary, allSessions);
        return order === undefined || order < stageOrder;
      });
      const priorMemory = memory.filter((item) => !item.phase || journeyPhaseStageOrder(item.phase) < stageOrder);
      const priorCheckIns = stageOrder > PREPARE_ME_STAGE_ORDER.check_in_12hr ? checkIns : [];
      const relevantPostIntegrationForms = postIntegrationForms.filter((form) => form.integration_session <= (stageOrder >= 5 ? 2 : stageOrder >= 4 ? 1 : 0));
      const dump = JSON.stringify({
        client,
        preparation_stage: body.sessionTypeLabel ?? "session",
        milestones,
        sessionHistory,
        sessionNotes: priorSessionNotes,
        completedForms,
        checkIns: priorCheckIns,
        memory: priorMemory,
        summaries: priorSummaries,
        plan,
        postIntegrationForms: relevantPostIntegrationForms,
      });
      const basePrompt = prompts.buildPrepareMeBriefingPrompt(dump, client.full_name, body.sessionTypeLabel ?? "session");
      const prompt = body.regenerate
        ? {
            ...basePrompt,
            system: `${basePrompt.system}\n\nThis is a regeneration request. Previous Prepare Me briefings are included in the client record. Produce a genuinely different, equally evidence-grounded briefing: take a distinct focus, change the phrasing and emphasis across the focus, intentions, insights, and commitments fields, and do not repeat a prior briefing's wording.`,
          }
        : basePrompt;
      const stageLabel = body.sessionTypeLabel ?? "session";
      const priorBriefings = summaries.filter(
        (summary) => summary.summary_type === "prepare_me_briefing" && summary.stage_label === stageLabel
      ).length;
      const { data, model } = await runAiJson(
        prompt,
        () => mocks.mockPrepareMeBriefing(client.full_name, stageLabel, priorBriefings + 1),
      );
      const summary = await addAiSummary(
        clientId,
        summaryType,
        `Prepare Me Briefing — ${stageLabel}`,
        data,
        model,
        body.sessionId,
        stageLabel
      );
      return NextResponse.json({ summary });
    }
    case "living_journey_summary": {
      const [memory, summaries] = await Promise.all([getMemory(clientId), getAiSummaries(clientId)]);
      const dump = JSON.stringify({ client, memory, summaries });
      const prompt = prompts.buildLivingJourneySummaryPrompt(dump, client.full_name);
      const { data, model } = await runAiJson(prompt, () => mocks.mockLivingJourneySummary(client.full_name));
      const summary = await addAiSummary(clientId, summaryType, "Living Journey Summary", data, model);
      return NextResponse.json({ summary });
    }
    case "session_call_summary": {
      const transcript = body.transcript ?? "";
      if (!transcript.trim()) {
        return NextResponse.json({ error: "Add a transcript before generating a session summary." }, { status: 400 });
      }
      const label = body.sessionTypeLabel ?? "Session";
      const prompt = prompts.buildSessionCallSummaryPrompt(transcript, client.full_name, label);
      const { data, model } = await runAiJson(prompt, () => mocks.mockSessionCallSummary(transcript, client.full_name));
      // Titled from the session, not hardcoded to Journey Day — this is now
      // the one summary of record for EVERY session type, shown to the
      // practitioner and to the client, so a Preparation session's summary
      // should not be labelled "Journey Day".
      const summary = await addAiSummary(clientId, summaryType, `${label} Summary`, data, model, body.sessionId);
      return NextResponse.json({ summary });
    }
      default:
        return NextResponse.json({ error: "Unknown summary type" }, { status: 400 });
    }
  } catch (error) {
    const authResponse = authorizationResponse(error);
    if (authResponse) return authResponse;
    console.error("AI generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI generation failed." },
      { status: 500 },
    );
  }
}
