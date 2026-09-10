import { NextRequest, NextResponse } from "next/server";
import { runAiJson } from "@/lib/ai/generate";
import { buildProspectIntroSummaryPrompt, buildProspectClientSummaryPrompt } from "@/lib/ai/prompts";
import { getProspect, updateProspect } from "@/lib/data";

interface ProspectSummaryRequest {
  prospectId: string;
  transcript: string;
}

// Mock fallback when AI is not configured
function mockProspectSummary(name: string) {
  return {
    what_they_are_seeking: `${name} is exploring psychedelic-assisted work to support personal growth and healing.`,
    background_context: "Shared relevant personal history during the intro call.",
    hesitations_or_concerns: "Expressed some uncertainty about the process and timeline.",
    readiness_signals: "Demonstrated openness, curiosity, and a willingness to do inner work.",
    questions_to_explore: "What does their support system look like? What's their experience with altered states? What would a successful outcome feel like?",
    practitioner_notes: "Warm and thoughtful. Responds well to a grounded, unhurried approach.",
  };
}

function mockClientSummary(name: string) {
  const first = name.split(" ")[0];
  return {
    what_we_talked_about: `Thanks for taking the time to talk today, ${first}. We covered what brought you to this work and what you're hoping to get out of it.`,
    your_next_steps: "Nothing needed from you right now.",
    what_happens_next: "I'll follow up with next steps and we'll find time to connect again soon.",
    questions_to_sit_with: "What would feel like a meaningful shift for you? What support do you already have in place?",
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ProspectSummaryRequest;
    const { prospectId, transcript } = body;

    const prospect = await getProspect(prospectId);
    if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

    const prompt = buildProspectIntroSummaryPrompt(transcript, prospect.full_name);
    const clientPrompt = buildProspectClientSummaryPrompt(transcript, prospect.full_name);

    const [practitionerResult, clientResult] = await Promise.all([
      runAiJson(prompt, () => mockProspectSummary(prospect.full_name)),
      runAiJson(clientPrompt, () => mockClientSummary(prospect.full_name)),
    ]);
    const { data, model } = practitionerResult;
    const { data: clientData, model: clientModel } = clientResult;

    const now = new Date().toISOString();

    // Save to Firestore — non-blocking so a Firestore hiccup doesn't prevent
    // the response from reaching the client.
    updateProspect(prospectId, {
      ai_summary_content: data as Record<string, unknown>,
      ai_summary_model: model,
      ai_summary_generated_at: now,
      client_summary_content: clientData as Record<string, unknown>,
      client_summary_model: clientModel,
      client_summary_generated_at: now,
      fathom_transcript: transcript,
      status: prospect.status === "new" || prospect.status === "intro_scheduled"
        ? "intro_complete"
        : prospect.status,
    }).catch((err) => console.error("Failed to save prospect summary to Firestore:", err));

    return NextResponse.json({
      content: data,
      model,
      client_content: clientData,
      client_model: clientModel,
      generated_at: now,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("prospect-summary route error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
