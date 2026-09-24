import { NextRequest, NextResponse } from "next/server";
import { runAiJson } from "@/lib/ai/generate";
import * as prompts from "@/lib/ai/prompts";
import * as mocks from "@/lib/ai/mocks";
import {
  addAiSummary,
  addMemoryItems,
  getClient,
  getMemory,
  getAiSummaries,
  getDocuments,
  getMilestones,
  getPostIntegrationForms,
  getPreparationPlan,
  getSessionNotes,
  getSessions,
  setGrowthActionPlan,
  getGrowthActionPlan,
  getCheckIns,
  completeMilestone,
} from "@/lib/data";
import { AiSummaryType } from "@/lib/types";

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

export async function POST(req: NextRequest) {
  const body = (await req.json()) as GenerateRequest;
  const { clientId, summaryType } = body;
  const client = await getClient(clientId);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  switch (summaryType) {
    case "client_assessment_summary": {
      const transcript = body.transcript ?? "";
      const prompt = prompts.buildAssessmentSummaryPrompt(transcript, client.full_name);
      const { data, model } = await runAiJson(prompt, () => mocks.mockAssessmentSummary(transcript, client.full_name));
      const summary = await addAiSummary(clientId, summaryType, "Client Assessment Summary", data, model);
      await addMemoryItems(clientId, [
        { item_type: "challenge", content: String((data as Record<string, unknown>).potential_risk_factors ?? ""), phase: "intake" },
      ]);
      await completeMilestone(clientId, "intake_complete");
      return NextResponse.json({ summary });
    }
    case "journey_brief": {
      const transcript = body.transcript ?? "";
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
      await completeMilestone(clientId, "preparation_complete");
      return NextResponse.json({ summary });
    }
    case "journey_summary": {
      const notes = body.transcript ?? "";
      const prompt = prompts.buildJourneySummaryPrompt(notes, client.full_name);
      const { data, model } = await runAiJson(prompt, () => mocks.mockJourneySummary(client.full_name));
      const summary = await addAiSummary(clientId, summaryType, "Journey Summary", data, model);
      await completeMilestone(clientId, "journey_complete");
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
      const checkInData = latest
        ? `Emotional State: ${latest.emotional_state}\nPhysical State: ${latest.physical_state}\nImmediate Insights: ${latest.immediate_insights}\nSupport Needs: ${latest.support_needs}\nSafety Concerns: ${latest.safety_concerns}`
        : "No check-in data submitted.";
      const prompt = prompts.buildCheckInSummaryPrompt(checkInData, client.full_name);
      const { data, model } = await runAiJson(prompt, () => mocks.mockCheckInSummary(client.full_name));
      const summary = await addAiSummary(clientId, summaryType, "12-Hour Check-In Summary", data, model);
      await completeMilestone(clientId, "check_in_12hr_complete");
      return NextResponse.json({ summary });
    }
    case "integration_1_brief": {
      const transcript = body.transcript ?? "";
      const pifs = await getPostIntegrationForms(clientId);
      const pif1 = pifs.find((f) => f.integration_session === 1);
      const pifText = pif1 ? Object.entries(pif1.responses).map(([q, a]) => `${q} ${a}`).join("\n") : "No form submitted.";
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
      const prompt = prompts.buildIntegrationSummaryPrompt(sessionNumber, transcript, client.full_name);
      const { data, model } = await runAiJson(prompt, () => mocks.mockIntegrationSummary(sessionNumber, client.full_name));
      const summary = await addAiSummary(clientId, summaryType, `Integration Summary ${sessionNumber}`, data, model);
      await completeMilestone(clientId, sessionNumber === 1 ? "integration_1_complete" : "integration_2_complete");
      return NextResponse.json({ summary });
    }
    case "growth_action_plan": {
      const pifs = await getPostIntegrationForms(clientId);
      const pif2 = pifs.find((f) => f.integration_session === 2);
      const pifText = pif2 ? Object.entries(pif2.responses).map(([q, a]) => `${q} ${a}`).join("\n") : "No form submitted.";
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
      await completeMilestone(clientId, "growth_action_plan_complete");
      return NextResponse.json({ summary });
    }
    case "prepare_me_briefing": {
      const [milestones, documents, postIntegrationForms, allSessions, currentSessionNotes, memory, summaries, plan] =
        await Promise.all([
          getMilestones(clientId),
          getDocuments(clientId),
          getPostIntegrationForms(clientId),
          getSessions(clientId),
          getSessionNotes(body.sessionId ?? ""),
          getMemory(clientId),
          getAiSummaries(clientId),
          getPreparationPlan(clientId),
        ]);
      // Full history of every past session (type, timing, status, and any raw
      // manual notes/transcript) — this is what makes Prepare Me work even for
      // a phase that doesn't have a generated AI summary yet. Previously this
      // was never fetched at all; "sessions" incorrectly held only today's
      // own structured notes, and "milestones" incorrectly held a second copy
      // of client memory items (see git history for the bug this replaced).
      const sessionHistory = allSessions.map((s) => ({
        session_type: s.session_type,
        status: s.status,
        scheduled_at: s.scheduled_at,
        manual_notes: s.manual_notes,
        transcript: s.transcript,
      }));
      const dump = JSON.stringify({
        client,
        milestones,
        sessionHistory,
        currentSessionNotes,
        memory,
        summaries,
        plan,
        documents,
        postIntegrationForms,
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
      const label = body.sessionTypeLabel ?? "Session";
      const prompt = prompts.buildSessionCallSummaryPrompt(transcript, client.full_name, label);
      const { data, model } = await runAiJson(prompt, () => ({
        summary: `Session with ${client.full_name}. Transcript not available.`,
        action_items: "None mentioned.",
      }));
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
}
