import { buildDemoProspects, buildSeedData, PRACTITIONER, REFERRAL_SOURCES, SeedBundle } from "./seed";
import { buildFormTemplates } from "./formTemplates";
import {
  AiConversationMessage,
  AiSummary,
  CheckIn,
  Client,
  ClientDocument,
  ClientMemoryItem,
  EmailLog,
  FormSubmission,
  FormTemplate,
  GrowthActionPlan,
  Message,
  Payment,
  PortalAssignment,
  PostIntegrationForm,
  PreparationPlan,
  Prospect,
  ProspectCall,
  ProspectTranscript,
  Recording,
  Session,
  SessionNote,
  StageNotes,
  SmsLog,
  Task,
  Transcript,
  JourneyMilestone,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// In-memory mock database singleton. This stands in for Supabase Postgres +
// Storage during local/demo use. Every accessor below is written `async`
// and shaped like a thin repository so that swapping in a real
// `@supabase/supabase-js` client later only requires changing the
// implementation of these functions in lib/data.ts, not their call sites.
//
// NOTE: this resets when the Next.js server process restarts. That's
// expected and fine for an MVP demo build.
// ---------------------------------------------------------------------------

class MockStore {
  practitioner = PRACTITIONER;
  referralSources = REFERRAL_SOURCES;

  clients: Client[] = [];
  milestones: JourneyMilestone[] = [];
  documents: ClientDocument[] = [];
  sessions: Session[] = [];
  transcripts: Transcript[] = [];
  recordings: Recording[] = [];
  aiSummaries: AiSummary[] = [];
  aiConversationMessages: AiConversationMessage[] = [];
  memory: ClientMemoryItem[] = [];
  sessionNotes: SessionNote[] = [];
  stageNotes: StageNotes[] = [];
  preparationPlans: PreparationPlan[] = [];
  checkIns: CheckIn[] = [];
  postIntegrationForms: PostIntegrationForm[] = [];
  growthActionPlans: GrowthActionPlan[] = [];
  tasks: Task[] = [];
  messages: Message[] = [];
  portalAssignments: PortalAssignment[] = [];
  payments: Payment[] = [];
  formTemplates: FormTemplate[] = [];
  formSubmissions: FormSubmission[] = [];
  emailLogs: EmailLog[] = [];
  smsLogs: SmsLog[] = [];
  prospects: Prospect[] = [];
  prospectCalls: ProspectCall[] = [];
  prospectTranscripts: ProspectTranscript[] = [];

  constructor() {
    this.seed();
  }

  seed() {
    this.formTemplates = buildFormTemplates();
    const bundles: SeedBundle[] = buildSeedData();
    for (const b of bundles) {
      this.clients.push(b.client);
      this.milestones.push(...b.milestones);
      this.documents.push(...b.documents);
      this.sessions.push(...b.sessions);
      this.transcripts.push(...b.transcripts);
      this.aiSummaries.push(...b.aiSummaries);
      this.memory.push(...b.memory);
      this.sessionNotes.push(...b.sessionNotes);
      if (b.preparationPlan) this.preparationPlans.push(b.preparationPlan);
      this.checkIns.push(...b.checkIns);
      this.postIntegrationForms.push(...b.postIntegrationForms);
      if (b.growthActionPlan) this.growthActionPlans.push(b.growthActionPlan);
      this.tasks.push(...b.tasks);
      this.messages.push(...b.messages);
      this.portalAssignments.push(...b.portalAssignments);
      this.payments.push(...b.payments);
    }
    this.prospects.push(...buildDemoProspects());
  }

  reset() {
    this.clients = [];
    this.milestones = [];
    this.documents = [];
    this.sessions = [];
    this.transcripts = [];
    this.aiSummaries = [];
    this.aiConversationMessages = [];
    this.memory = [];
    this.sessionNotes = [];
    this.stageNotes = [];
    this.preparationPlans = [];
    this.checkIns = [];
    this.postIntegrationForms = [];
    this.growthActionPlans = [];
    this.tasks = [];
    this.messages = [];
    this.portalAssignments = [];
    this.payments = [];
    this.formTemplates = [];
    this.formSubmissions = [];
    this.emailLogs = [];
    this.prospects = [];
    this.prospectCalls = [];
    this.prospectTranscripts = [];
    this.seed();
  }
}

// Use a global to survive Next.js dev-server hot reload of this module.
const globalForStore = globalThis as unknown as { __heartfulStore?: MockStore };

export const store: MockStore =
  globalForStore.__heartfulStore ?? (globalForStore.__heartfulStore = new MockStore());

// Self-heal: if this file gets edited to add a new array field (like
// formTemplates/formSubmissions were) while the dev server is already
// running, the persisted globalThis singleton above is the OLD object and
// won't have that field yet — causing "Cannot read properties of undefined"
// crashes until a full process restart. Backfill anything missing instead of
// relying on everyone remembering to fully restart (not just hot-reload).
if (store.formTemplates === undefined) store.formTemplates = buildFormTemplates();
if (store.formSubmissions === undefined) store.formSubmissions = [];
if (store.aiConversationMessages === undefined) store.aiConversationMessages = [];
if (store.emailLogs === undefined) store.emailLogs = [];
if (store.prospects === undefined) store.prospects = [];
if (store.prospectCalls === undefined) store.prospectCalls = [];
if (store.prospectTranscripts === undefined) store.prospectTranscripts = [];
if (store.stageNotes === undefined) store.stageNotes = [];
// Built-in forms added to the code after this dev server started.
for (const template of buildFormTemplates()) {
  if (!store.formTemplates.some((t) => t.id === template.id)) store.formTemplates.push(template);
}
