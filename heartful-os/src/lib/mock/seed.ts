import {
  AiSummary,
  CheckIn,
  Client,
  ClientDocument,
  ClientMemoryItem,
  DocumentType,
  GrowthActionPlan,
  JourneyMilestone,
  Message,
  Payment,
  PortalAssignment,
  PostIntegrationForm,
  PreparationPlan,
  Profile,
  ReferralSource,
  Session,
  SessionNote,
  Task,
  Transcript,
  MILESTONE_TEMPLATE,
} from "@/lib/types";

// Use a global to survive Next.js dev-server hot reload of this module — the
// same trick store.ts uses for the store singleton. Without this, editing any
// file during dev resets this counter to 1 while the (persisted) store still
// has client_0001..client_0005 in it, so the very next "new" record collides
// with an existing one and you end up looking at someone else's record.
//
// Seed IDs must remain stable across server restarts. A random per-process salt
// made every bookmarked client/session URL turn into a 404 after each restart.
// The counter is already kept on globalThis for hot reload safety; a fixed demo
// namespace keeps the generated seed graph deterministic in every worker.
const DEMO_ID_NAMESPACE = "demo";
const globalForId = globalThis as unknown as { __heartfulIdCounter?: number };
if (globalForId.__heartfulIdCounter === undefined) {
  globalForId.__heartfulIdCounter = 1;
}
export function nextId(prefix: string) {
  const n = globalForId.__heartfulIdCounter!++;
  return `${prefix}_${DEMO_ID_NAMESPACE}${n.toString().padStart(4, "0")}`;
}

const now = new Date("2026-06-23T12:00:00Z");
function daysAgo(n: number) {
  return new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
}
function daysFromNow(n: number) {
  return new Date(now.getTime() + n * 24 * 60 * 60 * 1000).toISOString();
}
function hoursAgo(n: number) {
  return new Date(now.getTime() - n * 60 * 60 * 1000).toISOString();
}
function hoursFromNow(n: number) {
  return new Date(now.getTime() + n * 60 * 60 * 1000).toISOString();
}

export const PRACTITIONER: Profile = {
  id: "prac_001",
  role: "practitioner",
  full_name: "Ladd Richland",
  email: "ladd.richland@gmail.com",
  practice_name: "Stillwater Integration Studio",
  title: "Integration & Harm Reduction Specialist",
};

export const REFERRAL_SOURCES: ReferralSource[] = [
  { id: "ref_001", practitioner_id: PRACTITIONER.id, name: "Word of Mouth", category: "Returning / Referral" },
  { id: "ref_002", practitioner_id: PRACTITIONER.id, name: "Psychedelic.support directory", category: "Web" },
  { id: "ref_003", practitioner_id: PRACTITIONER.id, name: "Instagram / Content", category: "Web" },
  { id: "ref_004", practitioner_id: PRACTITIONER.id, name: "Local Integration Circle", category: "Community" },
];

function milestonesFor(clientId: string, completedKeys: string[]): JourneyMilestone[] {
  return MILESTONE_TEMPLATE.map((m) => ({
    id: nextId("ms"),
    client_id: clientId,
    milestone_key: m.key,
    label: m.label,
    sort_order: m.sort_order,
    completed: completedKeys.includes(m.key),
    completed_at: completedKeys.includes(m.key) ? daysAgo(MILESTONE_TEMPLATE.length - m.sort_order + 1) : undefined,
  }));
}

function docSet(
  clientId: string,
  overrides: Partial<Record<DocumentType, ClientDocument["status"]>>
): ClientDocument[] {
  const base: { type: DocumentType; required: boolean }[] = [
    { type: "participant_screening_form", required: true },
    { type: "informed_consent", required: true },
    { type: "harm_reduction_services_agreement", required: true },
    { type: "client_services_agreement", required: true },
    { type: "preparation_navigation_plan", required: true },
    { type: "preparation_education_session", required: true },
    { type: "post_integration_form", required: true },
    { type: "post_integration_form_updated", required: true },
    { type: "session_notes", required: false },
    { type: "journey_brief", required: false },
    { type: "integration_summary_1", required: false },
    { type: "integration_summary_2", required: false },
    { type: "growth_action_plan", required: false },
  ];
  return base.map(({ type, required }) => {
    const status = overrides[type] ?? "missing";
    const versions =
      status === "missing"
        ? []
        : [
            {
              id: nextId("docv"),
              document_id: "",
              version_number: 1,
              file_url: `/mock-files/${clientId}/${type}-v1.pdf`,
              file_name: `${type}-v1.pdf`,
              file_size_bytes: 245000,
              mime_type: "application/pdf",
              uploaded_by_role: "practitioner" as const,
              created_at: daysAgo(20),
            },
          ];
    const docId = nextId("doc");
    versions.forEach((v) => (v.document_id = docId));
    return {
      id: docId,
      client_id: clientId,
      document_type: type,
      title: type,
      required,
      status,
      versions,
      current_version_id: versions[0]?.id,
    };
  });
}

export interface SeedBundle {
  client: Client;
  milestones: JourneyMilestone[];
  documents: ClientDocument[];
  sessions: Session[];
  transcripts: Transcript[];
  aiSummaries: AiSummary[];
  memory: ClientMemoryItem[];
  sessionNotes: SessionNote[];
  preparationPlan?: PreparationPlan;
  checkIns: CheckIn[];
  postIntegrationForms: PostIntegrationForm[];
  growthActionPlan?: GrowthActionPlan;
  tasks: Task[];
  messages: Message[];
  portalAssignments: PortalAssignment[];
  payments: Payment[];
}

function client(
  partial: Pick<Client, "full_name" | "email" | "phone" | "status" | "current_phase"> &
    Partial<Client>
): Client {
  const id = partial.id ?? nextId("client");
  return {
    id,
    practitioner_id: PRACTITIONER.id,
    portal_user_id: `${id}_portal`,
    date_of_birth: "1988-04-12",
    address: "Portland, OR",
    emergency_contact_name: "Jordan " + partial.full_name.split(" ")[1],
    emergency_contact_phone: "(503) 555-0192",
    emergency_contact_relationship: "Partner",
    referral_source_id: REFERRAL_SOURCES[0].id,
    notes: "",
    package_name: "Full Journey Support Package",
    package_value: 2400,
    amount_paid: 1200,
    created_at: daysAgo(40),
    updated_at: daysAgo(1),
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// CLIENT 1 — Maya Chen — early, intake scheduled
// ---------------------------------------------------------------------------
function buildMaya(): SeedBundle {
  const c = client({
    full_name: "Maya Chen",
    email: "maya.chen@example.com",
    phone: "(415) 555-0102",
    status: "intake_scheduled",
    current_phase: "intake",
    referral_source_id: REFERRAL_SOURCES[1].id,
    amount_paid: 400,
    created_at: daysAgo(5),
  });
  return {
    client: c,
    milestones: milestonesFor(c.id, []),
    documents: docSet(c.id, {
      informed_consent: "signed",
      client_services_agreement: "signed",
    }),
    sessions: [
      {
        id: nextId("sess"),
        client_id: c.id,
        practitioner_id: PRACTITIONER.id,
        session_type: "intake_assessment",
        scheduled_at: daysFromNow(2),
        duration_minutes: 90,
        status: "scheduled",
        location: "Video Call",
      },
      { id: nextId("sess"), client_id: c.id, practitioner_id: PRACTITIONER.id, session_type: "intake_assessment", scheduled_at: daysFromNow(94), duration_minutes: 90, status: "scheduled", location: "Video Call" },
    ],
    transcripts: [],
    aiSummaries: [],
    memory: [],
    sessionNotes: [],
    checkIns: [],
    postIntegrationForms: [],
    tasks: [
      {
        id: nextId("task"),
        client_id: c.id,
        practitioner_id: PRACTITIONER.id,
        title: "Collect Health History Document",
        task_type: "form",
        due_at: daysFromNow(1),
        status: "pending",
        assigned_to: "client",
      },
      {
        id: nextId("task"),
        client_id: c.id,
        practitioner_id: PRACTITIONER.id,
        title: "Collect Harm Reduction Services Agreement",
        task_type: "form",
        due_at: daysFromNow(1),
        status: "pending",
        assigned_to: "client",
      },
    ],
    messages: [
      {
        id: nextId("msg"),
        client_id: c.id,
        sender: "client",
        body: "Hi! Just submitted my consent forms. Looking forward to our intake session Thursday.",
        created_at: daysAgo(1),
      },
      {
        id: nextId("msg"),
        client_id: c.id,
        sender: "practitioner",
        body: "Wonderful, Maya — got them. See you Thursday at 10am. Feel free to send any questions before then.",
        created_at: hoursAgo(20),
      },
    ],
    portalAssignments: [
      {
        id: nextId("pa"),
        client_id: c.id,
        assignment_type: "form",
        title: "Health History Document",
        status: "pending",
        due_at: daysFromNow(1),
      },
      {
        id: nextId("pa"),
        client_id: c.id,
        assignment_type: "form",
        title: "Harm Reduction Services Agreement",
        status: "pending",
        due_at: daysFromNow(1),
      },
    ],
    payments: [{ id: nextId("pay"), client_id: c.id, amount: 400, paid_at: daysAgo(5).slice(0, 10), method: "Card" }],
  };
}

// ---------------------------------------------------------------------------
// CLIENT 2 — Daniel Ortiz — in preparation phase
// ---------------------------------------------------------------------------
function buildDaniel(): SeedBundle {
  const c = client({
    full_name: "Daniel Ortiz",
    email: "daniel.ortiz@example.com",
    phone: "(312) 555-0188",
    status: "preparation",
    current_phase: "preparation",
    referral_source_id: REFERRAL_SOURCES[1].id,
    amount_paid: 1200,
    created_at: daysAgo(25),
  });

  const assessmentSummary: AiSummary = {
    id: nextId("ai"),
    client_id: c.id,
    summary_type: "client_assessment_summary",
    title: "Client Assessment Summary",
    content: {
      client_goals: "Process grief after losing his father two years ago; explore long-standing anxiety patterns; reconnect with a sense of purpose after a recent career change.",
      personal_history: "Raised in Chicago, second of three siblings. Describes a close but emotionally reserved family. Strong relationship with long-term partner.",
      mental_health_history: "Generalized anxiety, managed without medication via therapy (CBT, 2019-2022). No history of psychosis, mania, or hospitalization. Denies current SI/HI.",
      previous_psychedelic_experience: "Two prior psilocybin experiences in a ceremonial group setting (2021, 2023); reports both as positive but 'unintegrated.' No experience with other psychedelics.",
      current_challenges: "Difficulty sitting with grief without intellectualizing it; perfectionism at work; sleep disruption during high-stress periods.",
      potential_risk_factors: "Family history of bipolar disorder (maternal uncle) — no personal diagnosis but worth monitoring mood stability through preparation. No medication interactions reported.",
      support_resources: "Long-term partner (supportive, briefed on role), weekly therapist, a small men's integration group he attends monthly.",
      facilitator_concerns: "Tendency to intellectualize emotional material — preparation should include concrete embodiment practices, not just discussion. Watch for minimization of family mental health history.",
      follow_up_recommendations: "Confirm with his therapist that they're aware of and supportive of this work. Build at least one body-based grounding practice into preparation before the journey session.",
    },
    model: "gpt-4o (mock)",
    created_at: daysAgo(20),
  };

  const prepPlan: PreparationPlan = {
    id: nextId("prep"),
    client_id: c.id,
    intentions: "To meet my grief directly instead of thinking my way around it, and to find out what 'purpose' actually feels like in my body rather than as an idea.",
    desired_outcomes: "A felt sense of having grieved my father, even partially. More trust in my own emotional signals. Less reliance on intellectualizing as a coping strategy.",
    fears: "Losing control. Crying and not being able to stop. Being judged for being 'too much.'",
    support_systems: "Partner (Ren) will be on-call by phone during integration window. Therapist aware and supportive. Men's group meets the week after Integration Session 2.",
    preparation_practices: "Daily 10-minute body scan. Journaling on father's voicemail he kept. One embodiment session with a somatic practitioner before the journey.",
    mindset_considerations: "Practice 'no fixing' — let inquiry replace analysis. Working mantra: 'I don't have to understand it to feel it.'",
    environmental_considerations: "Bring father's old flannel shirt. Photo of dad in his 30s. Playlist curated with songs from his childhood home.",
    navigation_strategies: "If grief becomes overwhelming, supported breathing + hand-hold check-in rather than verbal processing. If intellectualizing resurfaces, gentle redirect to body sensation.",
    integration_priorities: "Grief processing continuity (not a one-time release). Translating insight about purpose into a concrete next career/creative step.",
    updated_at: daysAgo(6),
  };

  const journeyBrief: AiSummary = {
    id: nextId("ai"),
    client_id: c.id,
    summary_type: "journey_brief",
    title: "Journey Brief",
    content: {
      client_summary: "Daniel is preparing to process unresolved grief for his father (d. 2024) and explore a sense of post-career-change purpose. He intellectualizes readily and is actively practicing staying embodied.",
      intentions: "Meet grief directly; locate a felt (not conceptual) sense of purpose.",
      themes: "Grief, control vs. surrender, the gap between thinking and feeling, identity after loss.",
      potential_challenges: "May retreat into narration/analysis under emotional intensity. Family history of bipolar disorder warrants gentle mood monitoring, not alarm.",
      navigation_reminders: "Offer grounding touch/breath before verbal processing. Use his own language ('don't have to understand it to feel it') to redirect intellectualization.",
      support_recommendations: "Keep partner Ren reachable per his support plan. Have his flannel shirt and photo accessible in the space.",
      integration_focus_areas: "Continuity of grief work post-journey; concrete translation of any purpose-insight into a real next step, not just a feeling.",
    },
    model: "gpt-4o (mock)",
    created_at: daysAgo(6),
  };

  return {
    client: c,
    milestones: milestonesFor(c.id, ["intake_complete"]),
    documents: docSet(c.id, {

      informed_consent: "signed",
      harm_reduction_services_agreement: "signed",
      client_services_agreement: "signed",
      preparation_navigation_plan: "uploaded",
      journey_brief: "uploaded",
    }),
    sessions: [
      { id: nextId("sess"), client_id: c.id, practitioner_id: PRACTITIONER.id, session_type: "intake_assessment", scheduled_at: daysAgo(20), duration_minutes: 90, status: "completed" },
      { id: nextId("sess"), client_id: c.id, practitioner_id: PRACTITIONER.id, session_type: "preparation", scheduled_at: daysAgo(6), duration_minutes: 90, status: "completed" },
      { id: nextId("sess"), client_id: c.id, practitioner_id: PRACTITIONER.id, session_type: "harm_reduction_support", scheduled_at: daysFromNow(4), duration_minutes: 480, status: "scheduled", location: "Journey Space — Sunroom" },
      { id: nextId("sess"), client_id: c.id, practitioner_id: PRACTITIONER.id, session_type: "harm_reduction_support", scheduled_at: daysFromNow(98), duration_minutes: 480, status: "scheduled", location: "Journey Space — Sunroom" },
    ],
    transcripts: [
      { id: nextId("tr"), client_id: c.id, source: "paste", raw_text: "[Intake transcript excerpt — Daniel discusses his father's passing, work transition, and prior psilocybin experiences...]", created_at: daysAgo(20) },
    ],
    aiSummaries: [assessmentSummary, journeyBrief],
    memory: [
      { id: nextId("mem"), client_id: c.id, item_type: "intention", content: "Meet grief directly rather than intellectualizing it.", phase: "preparation", status: "carried_forward", created_at: daysAgo(6) },
      { id: nextId("mem"), client_id: c.id, item_type: "intention", content: "Locate a felt, embodied sense of purpose after career change.", phase: "preparation", status: "carried_forward", created_at: daysAgo(6) },
      { id: nextId("mem"), client_id: c.id, item_type: "theme", content: "Tendency toward intellectualization as an emotional defense.", phase: "intake", status: "open", created_at: daysAgo(20) },
      { id: nextId("mem"), client_id: c.id, item_type: "challenge", content: "Family history of bipolar disorder — monitor mood stability, not a diagnosis.", phase: "intake", status: "open", created_at: daysAgo(20) },
    ],
    sessionNotes: [],
    preparationPlan: prepPlan,
    checkIns: [],
    postIntegrationForms: [],
    tasks: [
      { id: nextId("task"), client_id: c.id, practitioner_id: PRACTITIONER.id, title: "Confirm Ren's phone availability for journey day", task_type: "follow_up", due_at: daysFromNow(2), status: "pending", assigned_to: "practitioner" },
      { id: nextId("task"), client_id: c.id, practitioner_id: PRACTITIONER.id, title: "Bring grounding objects (flannel shirt, photo) to journey space", task_type: "reminder", due_at: daysFromNow(4), status: "pending", assigned_to: "practitioner" },
    ],
    messages: [
      { id: nextId("msg"), client_id: c.id, sender: "client", body: "Did the body scan every day this week — noticed I clench my jaw a lot when I think about Dad.", created_at: daysAgo(2) },
      { id: nextId("msg"), client_id: c.id, sender: "practitioner", body: "That's a great catch, and exactly the kind of noticing we want more of. Bring that observation with you Saturday.", created_at: daysAgo(2) },
    ],
    portalAssignments: [
      { id: nextId("pa"), client_id: c.id, assignment_type: "journaling_prompt", title: "Write to your father as if he could read it", status: "completed", completed_at: daysAgo(3) },
      { id: nextId("pa"), client_id: c.id, assignment_type: "homework", title: "Daily 10-minute body scan", status: "in_progress" },
    ],
    payments: [
      { id: nextId("pay"), client_id: c.id, amount: 800, paid_at: daysAgo(25).slice(0, 10), method: "Bank Transfer" },
      { id: nextId("pay"), client_id: c.id, amount: 400, paid_at: daysAgo(6).slice(0, 10), method: "Card" },
    ],
  };
}

// ---------------------------------------------------------------------------
// CLIENT 3 — Priya Patel — journey complete, awaiting 12hr check-in
// ---------------------------------------------------------------------------
function buildPriya(): SeedBundle {
  const c = client({
    full_name: "Priya Patel",
    email: "priya.patel@example.com",
    phone: "(206) 555-0143",
    status: "journey_complete",
    current_phase: "post_journey_check_in",
    referral_source_id: REFERRAL_SOURCES[0].id,
    amount_paid: 2000,
    created_at: daysAgo(35),
  });

  const journeySummary: AiSummary = {
    id: nextId("ai"),
    client_id: c.id,
    summary_type: "journey_summary",
    title: "Journey Summary",
    content: {
      major_themes: "Self-worth independent of achievement; relationship to her mother; reconnecting with creativity she abandoned in her 20s.",
      important_events: "Extended period (~90 min) of nonverbal crying around hour 3, followed by a felt sense of relief. Spontaneously hummed a song her grandmother used to sing.",
      potential_breakthroughs: "Vivid recognition that 'I have been performing being okay since I was 11' — described as landing in her chest, not just as a thought.",
      suggested_integration_topics: "Differentiating self-worth from productivity; reopening a creative practice (she mentioned painting unprompted); exploring the grandmother memory further.",
    },
    model: "gpt-4o (mock)",
    created_at: hoursAgo(30),
  };

  return {
    client: c,
    milestones: milestonesFor(c.id, ["intake_complete", "preparation_complete", "journey_complete"]),
    documents: docSet(c.id, {

      informed_consent: "signed",
      harm_reduction_services_agreement: "signed",
      client_services_agreement: "signed",
      preparation_navigation_plan: "reviewed",
      journey_brief: "reviewed",
      session_notes: "uploaded",
    }),
    sessions: [
      { id: nextId("sess"), client_id: c.id, practitioner_id: PRACTITIONER.id, session_type: "intake_assessment", scheduled_at: daysAgo(34), duration_minutes: 90, status: "completed" },
      { id: nextId("sess"), client_id: c.id, practitioner_id: PRACTITIONER.id, session_type: "preparation", scheduled_at: daysAgo(20), duration_minutes: 90, status: "completed" },
      { id: nextId("sess"), client_id: c.id, practitioner_id: PRACTITIONER.id, session_type: "harm_reduction_support", scheduled_at: hoursAgo(30), duration_minutes: 480, status: "completed", location: "Journey Space — Garden Room" },
      { id: nextId("sess"), client_id: c.id, practitioner_id: PRACTITIONER.id, session_type: "integration_1", scheduled_at: daysFromNow(86), duration_minutes: 60, status: "scheduled" },
      { id: nextId("sess"), client_id: c.id, practitioner_id: PRACTITIONER.id, session_type: "integration_2", scheduled_at: daysFromNow(102), duration_minutes: 60, status: "scheduled" },
    ],
    transcripts: [],
    aiSummaries: [journeySummary],
    memory: [
      { id: nextId("mem"), client_id: c.id, item_type: "breakthrough", content: "'I have been performing being okay since I was 11' — felt, not just cognitive.", phase: "harm_reduction_session", status: "open", created_at: hoursAgo(30) },
      { id: nextId("mem"), client_id: c.id, item_type: "theme", content: "Self-worth entangled with achievement and performance.", phase: "harm_reduction_session", status: "open", created_at: hoursAgo(30) },
      { id: nextId("mem"), client_id: c.id, item_type: "insight", content: "Spontaneous reconnection to grandmother's memory and a long-dormant interest in painting.", phase: "harm_reduction_session", status: "open", created_at: hoursAgo(30) },
    ],
    sessionNotes: [
      { id: nextId("sn"), session_id: "sess_priya_journey", client_id: c.id, field_type: "significant_moment", note_timestamp: hoursAgo(33), elapsed_minutes: 165, content: "Extended nonverbal crying, approx 90 min, visible relief afterward." },
      { id: nextId("sn"), session_id: "sess_priya_journey", client_id: c.id, field_type: "observation", note_timestamp: hoursAgo(32), elapsed_minutes: 220, content: "Spontaneously humming — later identified as grandmother's lullaby." },
      { id: nextId("sn"), session_id: "sess_priya_journey", client_id: c.id, field_type: "safety_note", note_timestamp: hoursAgo(34), elapsed_minutes: 30, content: "Vitals/affect check at onset — stable, oriented, consented to continue." },
      { id: nextId("sn"), session_id: "sess_priya_journey", client_id: c.id, field_type: "integration_theme", note_timestamp: hoursAgo(29), elapsed_minutes: 260, content: "Mentioned wanting to paint again — flag strongly for integration." },
    ],
    checkIns: [],
    postIntegrationForms: [],
    tasks: [
      { id: nextId("task"), client_id: c.id, practitioner_id: PRACTITIONER.id, title: "12-Hour Check-In", task_type: "form", due_at: hoursFromNow(-6), status: "overdue", assigned_to: "client" },
      { id: nextId("task"), client_id: c.id, practitioner_id: PRACTITIONER.id, title: "48-Hour Reflection Reminder", task_type: "reflection", due_at: hoursFromNow(18), status: "pending", assigned_to: "client" },
      { id: nextId("task"), client_id: c.id, practitioner_id: PRACTITIONER.id, title: "Schedule Integration Session 1 (within 72 hrs)", task_type: "session_prep", due_at: hoursFromNow(42), status: "pending", assigned_to: "practitioner" },
    ],
    messages: [
      { id: nextId("msg"), client_id: c.id, sender: "practitioner", body: "Checking in — how are you feeling this morning? No rush to respond fully, just want to know you're safe and resting.", created_at: hoursAgo(10) },
    ],
    portalAssignments: [
      { id: nextId("pa"), client_id: c.id, assignment_type: "form", title: "12-Hour Check-In", status: "pending", due_at: hoursFromNow(-6) },
    ],
    payments: [
      { id: nextId("pay"), client_id: c.id, amount: 1000, paid_at: daysAgo(34).slice(0, 10), method: "Bank Transfer" },
      { id: nextId("pay"), client_id: c.id, amount: 1000, paid_at: daysAgo(5).slice(0, 10), method: "Bank Transfer" },
    ],
  };
}

// ---------------------------------------------------------------------------
// CLIENT 4 — Marcus Webb — Integration Session 1 in progress
// ---------------------------------------------------------------------------
function buildMarcus(): SeedBundle {
  const c = client({
    full_name: "Marcus Webb",
    email: "marcus.webb@example.com",
    phone: "(720) 555-0177",
    status: "integration_1",
    current_phase: "integration_1",
    referral_source_id: REFERRAL_SOURCES[2].id,
    amount_paid: 2000,
    created_at: daysAgo(20),
  });

  const checkIn: CheckIn = {
    id: nextId("ci"),
    client_id: c.id,
    check_in_type: "12_hour",
    emotional_state: "Calm, a little tender. Some waves of unexpected tearfulness, but not distressing.",
    physical_state: "Tired but not depleted. Mild headache, resolved with water and food.",
    immediate_insights: "Realized how much energy I spend anticipating other people's disappointment in me.",
    support_needs: "Just want quiet and my partner around today. No big plans.",
    safety_concerns: "None.",
    submitted_by: "client",
    submitted_at: daysAgo(4),
  };

  const checkInSummary: AiSummary = {
    id: nextId("ai"),
    client_id: c.id,
    summary_type: "check_in_12hr_summary",
    title: "12-Hour Check-In Summary",
    content: {
      summary: "Marcus reports a stable, integrating nervous system 12 hours post-journey — appropriate fatigue, no safety concerns, and an early insight about anticipatory people-pleasing that aligns with his pre-journey intentions around authenticity. Recommend light-touch follow-up; no escalation needed.",
      flags: "None requiring immediate practitioner outreach.",
    },
    model: "gpt-4o (mock)",
    created_at: daysAgo(4),
  };

  return {
    client: c,
    milestones: milestonesFor(c.id, ["intake_complete", "preparation_complete", "journey_complete", "check_in_12hr_complete"]),
    documents: docSet(c.id, {

      informed_consent: "signed",
      harm_reduction_services_agreement: "signed",
      client_services_agreement: "signed",
      preparation_navigation_plan: "reviewed",
      journey_brief: "reviewed",
      session_notes: "uploaded",
      post_integration_form: "uploaded",
    }),
    sessions: [
      { id: nextId("sess"), client_id: c.id, practitioner_id: PRACTITIONER.id, session_type: "intake_assessment", scheduled_at: daysAgo(19), duration_minutes: 90, status: "completed" },
      { id: nextId("sess"), client_id: c.id, practitioner_id: PRACTITIONER.id, session_type: "preparation", scheduled_at: daysAgo(10), duration_minutes: 90, status: "completed" },
      { id: nextId("sess"), client_id: c.id, practitioner_id: PRACTITIONER.id, session_type: "harm_reduction_support", scheduled_at: daysAgo(5), duration_minutes: 480, status: "completed" },
      { id: nextId("sess"), client_id: c.id, practitioner_id: PRACTITIONER.id, session_type: "integration_1", scheduled_at: daysFromNow(1), duration_minutes: 60, status: "scheduled" },
      { id: nextId("sess"), client_id: c.id, practitioner_id: PRACTITIONER.id, session_type: "integration_2", scheduled_at: daysFromNow(90), duration_minutes: 60, status: "scheduled" },
    ],
    transcripts: [],
    aiSummaries: [checkInSummary],
    memory: [
      { id: nextId("mem"), client_id: c.id, item_type: "insight", content: "Spends significant energy anticipating others' disappointment — pattern of people-pleasing.", phase: "post_journey_check_in", status: "open", created_at: daysAgo(4) },
      { id: nextId("mem"), client_id: c.id, item_type: "intention", content: "Live more authentically, even when it risks others' approval.", phase: "preparation", status: "carried_forward", created_at: daysAgo(10) },
    ],
    sessionNotes: [],
    checkIns: [checkIn],
    postIntegrationForms: [
      {
        id: nextId("pif"),
        client_id: c.id,
        integration_session: 1,
        responses: {
          "What feels most alive right now?": "A strange lightness — like I put down a bag I didn't know I was carrying.",
          "What are you noticing in your body?": "Shoulders looser. Sleeping deeper than usual.",
          "What's coming up that you want to explore?": "The people-pleasing pattern. Also curiosity about why I avoid conflict with my brother specifically.",
        },
        submitted_at: daysAgo(3),
      },
    ],
    tasks: [
      { id: nextId("task"), client_id: c.id, practitioner_id: PRACTITIONER.id, title: "Integration Session 1 (within 72 hrs)", task_type: "session_prep", due_at: daysFromNow(1), status: "pending", assigned_to: "practitioner" },
    ],
    messages: [
      { id: nextId("msg"), client_id: c.id, sender: "client", body: "Submitted the post-integration form. The people-pleasing thing keeps coming up everywhere I look this week.", created_at: daysAgo(3) },
      { id: nextId("msg"), client_id: c.id, sender: "practitioner", body: "That's really common right after — the insight wants to get tested in real life. Let's dig into it tomorrow.", created_at: daysAgo(3) },
    ],
    portalAssignments: [
      { id: nextId("pa"), client_id: c.id, assignment_type: "form", title: "Post Integration Form", status: "completed", completed_at: daysAgo(3) },
      { id: nextId("pa"), client_id: c.id, assignment_type: "journaling_prompt", title: "Notice one moment today you people-pleased — what did it cost you?", status: "in_progress" },
    ],
    payments: [
      { id: nextId("pay"), client_id: c.id, amount: 2000, paid_at: daysAgo(19).slice(0, 10), method: "Bank Transfer" },
    ],
  };
}

// ---------------------------------------------------------------------------
// CLIENT 5 — Sarah Klein — full journey complete, journey closed
// ---------------------------------------------------------------------------
function buildSarah(): SeedBundle {
  const c = client({
    full_name: "Sarah Klein",
    email: "sarah.klein@example.com",
    phone: "(512) 555-0166",
    status: "journey_closed",
    current_phase: "closed",
    referral_source_id: REFERRAL_SOURCES[3].id,
    amount_paid: 2400,
    package_value: 2400,
    created_at: daysAgo(60),
  });

  const gap: GrowthActionPlan = {
    id: nextId("gap"),
    client_id: c.id,
    thirty_day_commitments: [
      "Hold one weekly 'undefended conversation' with my sister — no deflecting with humor.",
      "Keep a 3-line nightly journal tracking moments I chose honesty over comfort.",
      "Resume pottery class on Thursdays — non-negotiable calendar block.",
    ],
    behavioral_experiments: [
      "Say 'I need a minute to think' instead of immediately agreeing to requests, for one week.",
      "Sit with one uncomfortable email for 24 hours before responding, instead of firing back same-day.",
    ],
    daily_practices: [
      "5-minute morning check-in: 'What am I actually feeling right now?'",
      "Evening body scan before bed.",
    ],
    reflection_questions: [
      "Where did I shrink myself today to keep the peace?",
      "What would it look like to take up the right amount of space, not too little or too much?",
    ],
    accountability_commitments: [
      "Weekly text check-in with integration buddy from men's/women's circle.",
      "30-day follow-up call with practitioner scheduled.",
    ],
    created_at: daysAgo(8),
  };

  const growthPlanSummary: AiSummary = {
    id: nextId("ai"),
    client_id: c.id,
    summary_type: "growth_action_plan",
    title: "Growth Action Plan",
    content: gap as unknown as Record<string, unknown>,
    model: "gpt-4o (mock)",
    created_at: daysAgo(8),
  };

  return {
    client: c,
    milestones: milestonesFor(c.id, [
      "intake_complete",
      "preparation_complete",
      "journey_complete",
      "check_in_12hr_complete",
      "integration_1_complete",
      "integration_2_complete",
      "growth_action_plan_complete",
      "journey_closed",
    ]),
    documents: docSet(c.id, {

      informed_consent: "signed",
      harm_reduction_services_agreement: "signed",
      client_services_agreement: "signed",
      preparation_navigation_plan: "reviewed",
      journey_brief: "reviewed",
      session_notes: "uploaded",
      post_integration_form: "reviewed",
      post_integration_form_updated: "reviewed",
      integration_summary_1: "uploaded",
      integration_summary_2: "uploaded",
      growth_action_plan: "uploaded",
    }),
    sessions: [
      { id: nextId("sess"), client_id: c.id, practitioner_id: PRACTITIONER.id, session_type: "intake_assessment", scheduled_at: daysAgo(58), duration_minutes: 90, status: "completed" },
      { id: nextId("sess"), client_id: c.id, practitioner_id: PRACTITIONER.id, session_type: "preparation", scheduled_at: daysAgo(45), duration_minutes: 90, status: "completed" },
      { id: nextId("sess"), client_id: c.id, practitioner_id: PRACTITIONER.id, session_type: "harm_reduction_support", scheduled_at: daysAgo(35), duration_minutes: 480, status: "completed" },
      { id: nextId("sess"), client_id: c.id, practitioner_id: PRACTITIONER.id, session_type: "integration_1", scheduled_at: daysAgo(33), duration_minutes: 60, status: "completed" },
      { id: nextId("sess"), client_id: c.id, practitioner_id: PRACTITIONER.id, session_type: "integration_2", scheduled_at: daysAgo(25), duration_minutes: 60, status: "completed" },
      { id: nextId("sess"), client_id: c.id, practitioner_id: PRACTITIONER.id, session_type: "other", scheduled_at: daysFromNow(105), duration_minutes: 45, status: "scheduled" },
    ],
    transcripts: [
      { id: nextId("transcript"), client_id: c.id, source: "upload", raw_text: "Follow-up integration transcript uploaded for practitioner review.", created_at: daysAgo(24) },
    ],
    aiSummaries: [growthPlanSummary],
    memory: [
      { id: nextId("mem"), client_id: c.id, item_type: "theme", content: "Pattern of self-shrinking to maintain harmony, especially with family.", phase: "harm_reduction_session", status: "resolved", created_at: daysAgo(35) },
      { id: nextId("mem"), client_id: c.id, item_type: "commitment", content: "Resume pottery practice as an act of self-expression.", phase: "integration_2", status: "in_progress", created_at: daysAgo(8) },
      { id: nextId("mem"), client_id: c.id, item_type: "integration_outcome", content: "Reported having her first 'undefended conversation' with her sister 12 days post-journey.", phase: "integration_2", status: "resolved", created_at: daysAgo(8) },
    ],
    sessionNotes: [],
    checkIns: [
      { id: nextId("ci"), client_id: c.id, check_in_type: "12_hour", emotional_state: "Open, soft, occasionally overwhelmed by gratitude.", physical_state: "Good — well rested.", immediate_insights: "I don't have to earn rest.", support_needs: "Just check-ins, nothing more.", safety_concerns: "None.", submitted_by: "client", submitted_at: daysAgo(34) },
    ],
    postIntegrationForms: [
      { id: nextId("pif"), client_id: c.id, integration_session: 1, responses: { "What feels most alive right now?": "A new tenderness toward myself.", "What's coming up?": "Old story that I have to earn rest and love." }, submitted_at: daysAgo(33) },
      { id: nextId("pif"), client_id: c.id, integration_session: 2, responses: { "What's shifted in the last week?": "I told my sister something true instead of deflecting with a joke — first time ever.", "What feels unresolved?": "Still nervous about how my mother will react if I keep being this honest." }, submitted_at: daysAgo(25) },
    ],
    growthActionPlan: gap,
    tasks: [
      { id: nextId("task"), client_id: c.id, practitioner_id: PRACTITIONER.id, title: "30-Day Follow-Up Call", task_type: "follow_up", due_at: daysFromNow(105), status: "pending", assigned_to: "practitioner" },
    ],
    messages: [
      { id: nextId("msg"), client_id: c.id, sender: "client", body: "Wanted to say thank you — the pottery class restart has been such a small, good thing. Feels symbolic.", created_at: daysAgo(3) },
      { id: nextId("msg"), client_id: c.id, sender: "practitioner", body: "I love hearing that. Small, chosen things add up. See you on the 30-day call!", created_at: daysAgo(3) },
    ],
    portalAssignments: [
      { id: nextId("pa"), client_id: c.id, assignment_type: "integration_exercise", title: "Weekly undefended conversation practice", status: "in_progress" },
      { id: nextId("pa"), client_id: c.id, assignment_type: "homework", title: "Resume pottery class on Thursdays", status: "completed", completed_at: daysAgo(10) },
    ],
    payments: [
      { id: nextId("pay"), client_id: c.id, amount: 1200, paid_at: daysAgo(58).slice(0, 10), method: "Bank Transfer" },
      { id: nextId("pay"), client_id: c.id, amount: 1200, paid_at: daysAgo(35).slice(0, 10), method: "Bank Transfer" },
    ],
  };
}

export function buildSeedData(): SeedBundle[] {
  return [buildMaya(), buildDaniel(), buildPriya(), buildMarcus(), buildSarah()];
}
