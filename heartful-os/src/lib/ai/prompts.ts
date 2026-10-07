// ---------------------------------------------------------------------------
// Centralized AI prompt library for Heartful OS.
// Every AI-generated artifact in the product is produced from a prompt
// defined here, so prompts can be reviewed, versioned, and tuned in one
// place. Each builder returns { system, user } messages ready to send to
// the OpenAI Chat Completions / Responses API.
//
// IMPORTANT FRAMING USED IN EVERY SYSTEM PROMPT:
// Heartful OS is NOT a medical record system and these summaries are NOT
// clinical or diagnostic documents. The AI is instructed accordingly.
// ---------------------------------------------------------------------------

const BASE_SYSTEM_FRAME = `You are an assistant supporting a psychedelic harm reduction specialist,
preparation coach, or integration coach inside "Heartful OS" — a client journey
management platform. This is explicitly NOT a medical record system and you are
NOT providing clinical diagnoses, medical advice, or treatment recommendations.
Your job is to help the practitioner understand their client's journey, intentions,
themes, and support needs so they can show up more present and prepared.

Write in clear, warm, grounded language — never clinical jargon, never diagnostic
labels. If something in the transcript suggests a genuine safety concern (suicidality,
risk of harm to self/others, medical emergency, signs of psychosis), flag it plainly
and recommend the practitioner follow their emergency protocol and/or refer to licensed
medical/mental health professionals — do not attempt to assess or resolve it yourself.

Always respond with valid JSON matching the requested schema exactly. No prose outside JSON.`;

export interface PromptPair {
  system: string;
  user: string;
}

export function buildAssessmentSummaryPrompt(transcript: string, clientName: string): PromptPair {
  return {
    system: BASE_SYSTEM_FRAME,
    user: `Below is a transcript (or notes) from an Intake & Assessment Session (90 minutes) with client "${clientName}".

Produce a Client Assessment Summary as JSON with exactly these keys (all strings):
{
  "client_goals": "",
  "personal_history": "",
  "mental_health_history": "",
  "previous_psychedelic_experience": "",
  "current_challenges": "",
  "potential_risk_factors": "",
  "support_resources": "",
  "facilitator_concerns": "",
  "follow_up_recommendations": ""
}

Transcript:
"""
${transcript}
"""`,
  };
}

export function buildJourneyBriefPrompt(
  transcript: string,
  clientName: string,
  preparationPlanSummary: string
): PromptPair {
  return {
    system: BASE_SYSTEM_FRAME,
    user: `Below is a transcript from a Preparation Session (90 minutes) with client "${clientName}", along with their current Preparation & Navigation Plan.

Produce a Journey Brief as JSON with exactly these keys (all strings):
{
  "client_summary": "",
  "intentions": "",
  "themes": "",
  "potential_challenges": "",
  "navigation_reminders": "",
  "support_recommendations": "",
  "integration_focus_areas": ""
}

This Journey Brief will be referenced by the facilitator on Journey Day, so make
"navigation_reminders" and "potential_challenges" concrete and actionable.

Preparation & Navigation Plan so far:
"""
${preparationPlanSummary}
"""

Preparation Session Transcript:
"""
${transcript}
"""`,
  };
}

export function buildJourneySummaryPrompt(structuredNotes: string, clientName: string): PromptPair {
  return {
    system: BASE_SYSTEM_FRAME,
    user: `Below are timestamped structured notes taken during an 8-hour Harm Reduction Support Session for client "${clientName}" (observations, significant moments, client requests, safety notes, potential integration themes).

Produce a Journey Summary as JSON with exactly these keys (all strings):
{
  "major_themes": "",
  "important_events": "",
  "potential_breakthroughs": "",
  "suggested_integration_topics": ""
}

Session Notes:
"""
${structuredNotes}
"""`,
  };
}

export function buildJourneyManualNotesSummaryPrompt(
  manualNotes: string,
  clientName: string,
  sessionTypeLabel: string = "Harm Reduction Support Session"
): PromptPair {
  return {
    system: BASE_SYSTEM_FRAME,
    user: `Below are the practitioner's notes and/or session transcript from a "${sessionTypeLabel}" session with client "${clientName}" — this is the practitioner's own reference material, not shown to the client, so write freely and include clinical impressions or concerns where relevant.

Produce a Practitioner Summary as JSON with exactly these keys (all strings):
{
  "key_observations": "",
  "notable_moments": "",
  "themes": "",
  "follow_up_considerations": ""
}

Notes:
"""
${manualNotes}
"""`,
  };
}

export function buildCheckInSummaryPrompt(checkInData: string, clientName: string): PromptPair {
  return {
    system: BASE_SYSTEM_FRAME,
    user: `Below is the 12-Hour Check-In information for client "${clientName}" — the check-in form answers (emotional state, physical state, immediate insights, support needs, safety concerns) and/or the practitioner's notes or transcript from the check-in call.

Produce a 12-Hour Check-In Summary as JSON with exactly these keys:
{
  "summary": "a short narrative summary of how the client is doing",
  "flags": "any items that may warrant practitioner outreach, or 'None requiring immediate practitioner outreach.' if none"
}

Check-In Data:
"""
${checkInData}
"""`,
  };
}

export function buildIntegration1BriefPrompt(
  postIntegrationForm: string,
  journeyBrief: string,
  journeySummary: string,
  transcript: string,
  clientName: string
): PromptPair {
  return {
    system: BASE_SYSTEM_FRAME,
    user: `You are preparing the facilitator for Integration Session One (must occur within 72 hours of the journey) with client "${clientName}".

Synthesize the Post Integration Form, the original Journey Brief, the Journey Summary, and the session transcript (if provided) into an Integration Session One Brief as JSON with exactly these keys:
{
  "original_intentions": "",
  "key_themes": "",
  "emerging_insights": "",
  "areas_for_exploration": "",
  "suggested_questions": ""
}

"suggested_questions" should be a string of 4-6 open-ended questions separated by newlines.

Post Integration Form:
"""
${postIntegrationForm}
"""

Original Journey Brief:
"""
${journeyBrief}
"""

Journey Summary:
"""
${journeySummary}
"""

Integration Session Transcript (if available):
"""
${transcript}
"""`,
  };
}

export function buildIntegrationSummaryPrompt(
  sessionNumber: 1 | 2,
  transcript: string,
  clientName: string
): PromptPair {
  return {
    system: BASE_SYSTEM_FRAME,
    user: `Summarize Integration Session ${sessionNumber} for client "${clientName}" as JSON with exactly these keys:
{
  "summary": "a concise narrative summary of what was discussed and what shifted",
  "key_takeaways": "a string of 3-5 bullet-style takeaways separated by newlines"
}

Transcript:
"""
${transcript}
"""`,
  };
}

export function buildGrowthActionPlanPrompt(
  updatedPostIntegrationForm: string,
  priorContext: string,
  clientName: string,
  options?: { additionalTranscript?: string; existingPlan?: Record<string, unknown> }
): PromptPair {
  const { additionalTranscript, existingPlan } = options ?? {};

  const enhanceInstruction = existingPlan
    ? `\n\nAn existing Growth Action Plan is provided below (Current Growth Action Plan). Your job is to ENHANCE it, not replace it wholesale: keep whatever is still accurate and relevant, and revise, sharpen, or add items using the additional information provided (especially the Additional Session Transcript, if present). Only drop an existing item if the new material makes it clearly outdated or contradicted. The result should read as an evolution of the same plan, not an unrelated fresh one. IMPORTANT: the constraints below apply to the Current Growth Action Plan too, not just new material — if any existing item violates them (references a third integration session, or frames a one-off remark as a chronic/recurring pattern), rewrite or remove that item as part of this enhancement. Don't preserve a violation just because it was already there.`
    : "";

  const transcriptSection = additionalTranscript
    ? `\n\nAdditional Session Transcript (new material to incorporate):\n"""\n${additionalTranscript}\n"""`
    : "";

  const existingPlanSection = existingPlan
    ? `\n\nCurrent Growth Action Plan (enhance this, don't discard it):\n"""\n${JSON.stringify(existingPlan)}\n"""`
    : "";

  return {
    system: BASE_SYSTEM_FRAME,
    user: `You are creating a Growth Action Plan for client "${clientName}" following Integration Session Two (must occur within 10 days of the journey). This plan should be practical, achievable, and rooted in what actually emerged in their journey and integration work — not generic advice.${enhanceInstruction}

Important constraints:
- This program has exactly two integration sessions — Integration Session One and Integration Session Two — and this plan follows the second and final one. Do not reference, recommend, or imply a third integration session or any further integration session; if follow-up touchpoints are relevant, describe them in terms of the client's own daily/weekly practices, not another formal integration session.
- The Prior Journey Context below may include a single, isolated remark from one session (e.g., a client explaining why they've decided not to repeat a substance because of how the after-effects felt). Do not characterize a one-time remark like that as a chronic, ongoing, or recurring pattern — avoid phrasing like "a pattern you're aware of" or "when that familiar dip arrives" for something that only happened once. Only describe something as recurring or chronic if it clearly appears across multiple distinct sessions or entries in the context — otherwise, either leave it out or reflect it as the single, time-bound moment it was. This applies to every item in the final output, including any carried over from an existing plan.

Produce JSON with exactly these keys, each an array of short strings:
{
  "thirty_day_commitments": [],
  "behavioral_experiments": [],
  "daily_practices": [],
  "reflection_questions": [],
  "accountability_commitments": []
}

Aim for 2-4 items per array.

Prior Journey Context (brief, summary, themes, memory items):
"""
${priorContext}
"""

Updated Post Integration Form:
"""
${updatedPostIntegrationForm}
"""${existingPlanSection}${transcriptSection}`,
  };
}

export function buildPrepareMeBriefingPrompt(clientRecordDump: string, clientName: string, sessionTypeLabel: string): PromptPair {
  return {
    system: BASE_SYSTEM_FRAME,
    user: `The practitioner is about to start a "${sessionTypeLabel}" session with client "${clientName}" and has pressed "Prepare Me For This Session."

This briefing is for THIS stage of the journey specifically. The record below
covers the client's entire history to date — earlier sessions with their manual
notes and transcripts, every summary generated so far, milestones, memory items,
completed forms and the preparation plan. Read all of it and write a briefing
that BUILDS ON what has already happened rather than restating the intake:

- Weight the most recent sessions most heavily, but carry forward anything
  still unresolved from earlier ones.
- Say what has changed or moved since the last session, and what has not.
- Name concrete specifics — actual events, phrases the client used, named
  people, dates, doses, commitments. Never write a generic sentence that would
  be true of any client.
- Make "focus_for_today" specific to a "${sessionTypeLabel}" session and to the
  open threads this client is actually carrying into it.
- If the record genuinely contains nothing for a key (e.g. no prior sessions
  yet), say so plainly in one short sentence instead of inventing content.

Produce a Prepare Me Briefing as JSON with exactly these keys (all strings, conversational and practitioner-facing, second person ok):
{
  "who_is_this_client": "",
  "why_are_they_here": "",
  "their_intentions": "",
  "risks_to_hold": "",
  "insights_so_far": "",
  "commitments_made": "",
  "focus_for_today": ""
}

Full Client Record:
"""
${clientRecordDump}
"""`,
  };
}

export function buildProspectIntroSummaryPrompt(transcript: string, prospectName: string): PromptPair {
  return {
    system: BASE_SYSTEM_FRAME,
    user: `Below is a transcript from an introductory call with a prospective client named "${prospectName}". They are exploring psychedelic-assisted preparation and integration work but have not yet committed.

Your job is to extract and synthesize the SPECIFIC content from this transcript — names, situations, life events, exact concerns, direct quotes where useful. Do NOT produce generic, vague summaries. If the transcript contains specific details, include them. If something important was said verbatim, paraphrase it closely. Be concrete and precise.

Produce a Prospect Intro Call Summary as JSON with exactly these keys (all strings):
{
  "what_they_are_seeking": "Their specific stated goals and what drew them to this work — reference actual things they said, not generic descriptions. Include their core intention in their own words if possible.",
  "background_context": "Specific personal background they shared: relevant life history, mental health history, prior therapy or plant medicine experience, current life circumstances, relationships, work situation — whatever concrete details came up.",
  "hesitations_or_concerns": "Specific concerns or hesitations they voiced — fears about the process, logistical barriers, uncertainty about readiness, concerns about safety or legality, financial questions, anything concrete. Quote or closely paraphrase where useful.",
  "readiness_signals": "Concrete signs of readiness: specific prior inner work they've done, existing support systems, level of motivation they expressed, how much thought they'd already put into this, their timeline or urgency.",
  "questions_to_explore": "3-5 specific questions tailored to THIS person based on what came up in the call — gaps in understanding, areas to probe, topics to revisit. Make these specific to their situation, not generic.",
  "practitioner_notes": "How they communicated: their emotional tone, what seemed to resonate, what felt flat, how much they opened up, pace of the conversation, anything to keep in mind about how to work with them effectively."
}

Transcript:
"""
${transcript}
"""`,
  };
}

export function buildProspectClientSummaryPrompt(transcript: string, prospectName: string): PromptPair {
  return {
    system: `You are an assistant supporting a psychedelic harm reduction specialist,
preparation coach, or integration coach inside "Heartful OS" — a client journey
management platform. This is explicitly NOT a medical record system and you are
NOT providing clinical diagnoses, medical advice, or treatment recommendations.

You are writing a summary that will be sent DIRECTLY TO THE PROSPECTIVE CLIENT
themselves, in second person ("you"), as a warm, human recap of their own intro
call — not a clinical or practitioner-facing document. Never use practitioner
jargon, never assess or characterize the person (no "readiness signals," no
commentary on their tone or psychology). Only reflect back what THEY said and
what was agreed on, in a friendly, grounded voice.

If something in the transcript suggests a genuine safety concern (suicidality,
risk of harm to self/others, medical emergency, signs of psychosis), do not
include it in this client-facing summary — omit it entirely; that is handled
separately with the practitioner.

Always respond with valid JSON matching the requested schema exactly. No prose outside JSON.`,
    user: `Below is a transcript from an introductory call between a practitioner and a prospective client named "${prospectName}". Write a short, warm recap addressed directly to ${prospectName.split(" ")[0]} that they could read themselves after the call — the kind of note a thoughtful practitioner sends as a follow-up.

Produce a Client-Facing Recap as JSON with exactly these keys (all strings, second person, warm and plain-language — no clinical or practitioner terminology):
{
  "what_we_talked_about": "A short, warm recap in second person of the main things you discussed and what you shared — grounded in specifics from the call, not generic.",
  "your_next_steps": "Concrete action items FOR THE CLIENT — anything they agreed to do, decide, or send over. Written as a simple list-in-prose or short lines. If none, write 'Nothing needed from you right now.'",
  "what_happens_next": "What the practitioner will do next and/or what the client can expect going forward (e.g. follow-up call, materials to expect, next milestone).",
  "questions_to_sit_with": "2-4 gentle, reflective questions the client might sit with before your next conversation, phrased warmly and directly to them."
}

Transcript:
"""
${transcript}
"""`,
  };
}

export function buildSessionCallSummaryPrompt(transcript: string, clientName: string, sessionTypeLabel: string): PromptPair {
  return {
    system: BASE_SYSTEM_FRAME,
    user: `Below is a transcript from a "${sessionTypeLabel}" session with client "${clientName}".

Your ONLY job is to produce a factual record of what was said and what action items were mentioned. This is NOT an analysis or interpretation. Follow these rules strictly:
- Do NOT draw conclusions about the client's psychology, progress, or internal state
- Do NOT make inferences or judgments beyond what was explicitly said
- Do NOT interpret meaning, patterns, or themes unless the client or practitioner stated them directly
- Do NOT speculate about what something "suggests" or "indicates"
- DO capture what was actually said, discussed, asked, and decided, using the speaker's own words as closely as possible
- DO list action items exactly as they were stated in the call, by whoever stated them

Produce JSON with exactly these keys (all strings):
{
  "summary": "A factual, chronological account of what was discussed in the session. Quote or closely paraphrase what was actually said. No interpretation.",
  "action_items": "A bulleted list of specific next steps, commitments, or follow-ups that were mentioned during the call — by either the client or practitioner. Include who is responsible if stated. If none were mentioned, write 'None mentioned.'"
}

Transcript:
"""
${transcript}
"""`,
  };
}

export function buildLivingJourneySummaryPrompt(clientRecordDump: string, clientName: string): PromptPair {
  return {
    system: BASE_SYSTEM_FRAME,
    user: `Maintain a living "Client Journey Summary" for "${clientName}" that synthesizes everything known about them across their entire journey to date — this gets regenerated as new information comes in and should read as a coherent narrative a practitioner could skim before any touchpoint.

Produce JSON with exactly these keys (all strings):
{
  "narrative_summary": "a 4-6 sentence narrative of their journey so far",
  "core_intentions": "",
  "recurring_themes": "",
  "growth_observed": "",
  "open_threads": ""
}

Full Client Record:
"""
${clientRecordDump}
"""`,
  };
}

export function buildAiConversationPrompt(
  clientName: string,
  clientRecordDump: string,
  conversationHistory: string,
  practitionerMessage: string
): PromptPair {
  return {
    system: BASE_SYSTEM_FRAME,
    user: `You are in an ongoing conversation with a practitioner about their client, "${clientName}".

Answer the practitioner's latest message directly and helpfully. Use the client context below when it is relevant, name uncertainty when the record does not contain an answer, and never invent client details. This is a working conversation, not a formal summary, so keep the response focused and practical. The practitioner may ask about preparation, session planning, progress, open threads, forms, or next steps.

Return JSON with exactly one key:
{
  "reply": ""
}

Client context:
"""
${clientRecordDump}
"""

Conversation so far:
"""
${conversationHistory || "No previous conversation."}
"""

Latest practitioner message:
"""
${practitionerMessage}
"""`,
  };
}
