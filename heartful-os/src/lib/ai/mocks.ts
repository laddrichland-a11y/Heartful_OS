// Deterministic mock generators used when OPENAI_API_KEY is not configured.
// These let every AI feature in the app remain fully demoable without
// credentials, while still producing plausible, on-theme content.

export function mockAssessmentSummary(transcript: string, clientName: string) {
  const hasContent = transcript.trim().length > 20;
  return {
    client_goals: hasContent
      ? `Based on the session, ${clientName} is seeking clarity, emotional processing, and a renewed sense of direction.`
      : `${clientName} has not yet provided detailed transcript content — goals to be refined after the intake session.`,
    personal_history: "Summary will reflect family background, key life events, and relationship context discussed in the session.",
    mental_health_history: "No diagnostic claims are made here — this reflects what the client self-reported about past mental health support, therapy, or medication.",
    previous_psychedelic_experience: "Summary of any prior psychedelic or altered-state experiences the client described, including setting and outcome.",
    current_challenges: "Current stressors, relational patterns, or life transitions the client named as present-day challenges.",
    potential_risk_factors: "Anything from the conversation worth monitoring through preparation — not a diagnosis, just practitioner awareness.",
    support_resources: "People, practices, or professionals the client can lean on during preparation and integration.",
    facilitator_concerns: "Areas the facilitator may want to gently explore further before the journey.",
    follow_up_recommendations: "Suggested next steps before moving into the Preparation phase.",
  };
}

export function mockJourneyBrief(clientName: string) {
  return {
    client_summary: `${clientName} is preparing for their journey with clear intentions and an active preparation practice.`,
    intentions: "Primary intentions as articulated during the preparation session.",
    themes: "Recurring emotional and relational themes surfaced during preparation.",
    potential_challenges: "Patterns that may arise during the journey based on preparation conversations.",
    navigation_reminders: "Concrete, in-the-moment reminders for the facilitator to use during the session.",
    support_recommendations: "Support systems and grounding objects/practices to have available.",
    integration_focus_areas: "Where integration energy should be focused afterward.",
  };
}

export function mockJourneySummary(clientName: string) {
  return {
    major_themes: `Key emotional and psychological themes that emerged for ${clientName} during the session.`,
    important_events: "Notable moments, shifts, or turning points observed during the session.",
    potential_breakthroughs: "Any insight or release that appeared to land as a felt experience, not just a thought.",
    suggested_integration_topics: "Topics to prioritize across the upcoming integration sessions.",
  };
}

export function mockJourneyManualNotesSummary(clientName: string) {
  return {
    key_observations: `Notable observations from the practitioner's manual notes for ${clientName}'s session.`,
    notable_moments: "Moments worth flagging that stood out while writing free-form during the session.",
    themes: "Threads or patterns visible across the manual notes.",
    follow_up_considerations: "Anything worth raising in the check-in or integration sessions that follow.",
  };
}

export function mockCheckInSummary(clientName: string) {
  return {
    summary: `${clientName} is reporting a generally stable 12-hour check-in with no acute safety concerns. Continue light-touch follow-up through the 48-hour window.`,
    flags: "None requiring immediate practitioner outreach.",
  };
}

export function mockIntegration1Brief(clientName: string) {
  return {
    original_intentions: "Recap of the intentions set before the journey.",
    key_themes: "Themes connecting the journey experience to the post-integration form responses.",
    emerging_insights: "New insights the client has named since the journey.",
    areas_for_exploration: "Areas worth opening up further in this session.",
    suggested_questions: `What feels different in your body since the journey, ${clientName}?\nWhat insight keeps returning to you?\nWhat would it look like to honor that insight this week?\nWhere are you noticing resistance?\nWhat's one small, concrete step that would make this real?`,
  };
}

export function mockIntegrationSummary(sessionNumber: 1 | 2, clientName: string) {
  return {
    summary: `Integration Session ${sessionNumber} with ${clientName} focused on translating journey insights into daily life. Continued movement toward stated intentions was noted.`,
    key_takeaways: "Insight is beginning to translate into behavior.\nClient is engaging actively with integration practices.\nWatch for old patterns resurfacing under stress.",
  };
}

export function mockGrowthActionPlan(clientName: string) {
  return {
    thirty_day_commitments: [
      `${clientName} commits to one weekly practice that embodies their core journey insight.`,
      "Maintain a short daily reflection log tracking moments of alignment with intentions.",
    ],
    behavioral_experiments: [
      "Try responding differently in one recurring triggering situation this week.",
      "Notice and interrupt one old pattern in real time, without judgment.",
    ],
    daily_practices: ["5-minute morning grounding check-in.", "Brief evening reflection before sleep."],
    reflection_questions: [
      "Where did I act from old patterns today, and where did I act from new insight?",
      "What is one thing I'm proud of this week?",
    ],
    accountability_commitments: [
      "Weekly check-in with an integration buddy or support person.",
      "Scheduled 30-day follow-up with practitioner.",
    ],
  };
}

export function mockPrepareMeBriefing(clientName: string, sessionTypeLabel: string, revision = 1) {
  // The prototype runs without an AI key in many environments. Keep each
  // regenerated briefing meaningfully different so the interaction behaves
  // like a real alternate read, rather than returning the same mock forever.
  const alternatives = [
    {
      whyAreTheyHere: "Their stated goals and motivations for this work.",
      intentions: "Primary intentions carried from preparation through to today.",
      insights: "Key insights and themes that have emerged across the journey to date.",
      focus: `For this ${sessionTypeLabel}, focus on continuity — connect today's work back to ${clientName}'s stated intentions.`,
    },
    {
      whyAreTheyHere: "Revisit their stated goals and notice what now feels most relevant.",
      intentions: "Prioritize the intention that feels most alive in the client's current context.",
      insights: "Look for the newest themes alongside the established patterns in the record.",
      focus: `For this ${sessionTypeLabel}, take a fresh read of ${clientName}'s current needs before deciding what to carry forward.`,
    },
    {
      whyAreTheyHere: "Identify what may need care, clarity, or a slower pace at this point in the journey.",
      intentions: "Use the client's own language to choose one grounded intention for the conversation.",
      insights: "Notice any shifts since the last touchpoint, including what remains unresolved.",
      focus: `For this ${sessionTypeLabel}, begin by checking what feels unfinished or newly present for ${clientName}.`,
    },
    {
      whyAreTheyHere: "Connect the current session to the wider arc of support without assuming progress.",
      intentions: "Invite the client to name what would make this conversation useful today.",
      insights: "Hold both the client's strengths and the open questions that still need attention.",
      focus: `For this ${sessionTypeLabel}, make space for ${clientName} to set the pace and name the most useful next step.`,
    },
  ];
  const alternative = alternatives[(Math.max(1, revision) - 1) % alternatives.length];

  return {
    who_is_this_client: `${clientName} is a client currently in their journey process. Review their full record above for specifics.`,
    why_are_they_here: alternative.whyAreTheyHere,
    their_intentions: alternative.intentions,
    risks_to_hold: "Anything flagged from intake or prior sessions to hold gently in mind today.",
    insights_so_far: alternative.insights,
    commitments_made: "Any commitments or action items the client has made in prior sessions.",
    focus_for_today: alternative.focus,
  };
}

export function mockLivingJourneySummary(clientName: string) {
  return {
    narrative_summary: `${clientName} has moved through their journey with consistent engagement. Across intake, preparation, the journey itself, and integration, clear themes and intentions have remained traceable and are evolving naturally.`,
    core_intentions: "The throughline intentions that have persisted across phases.",
    recurring_themes: "Themes that show up repeatedly across sessions and forms.",
    growth_observed: "Concrete signs of movement or change noted by the practitioner or self-reported by the client.",
    open_threads: "What remains open or unresolved heading into the next phase.",
  };
}

export function mockAiConversationReply(clientName: string, practitionerMessage: string) {
  return {
    reply: `I’m looking at ${clientName}'s journey context. For “${practitionerMessage}”, I can help you connect the open threads, prepare for the relevant session, or turn what is already recorded into practical next steps. With the current record, I would start by checking the latest session notes, forms, and unresolved commitments before deciding what to carry forward.`,
  };
}
