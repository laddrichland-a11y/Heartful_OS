import { createHash } from "crypto";
import { store } from "@/lib/mock/store";
import { nextId } from "@/lib/mock/seed";
import { isFirebaseConfigured, getBucket } from "@/lib/firebaseAdmin";
import { isGeneralPaperwork, isPastDue } from "@/lib/utils";
import {
  allDocs,
  deleteDoc,
  deleteDocsWhere,
  getDocById,
  insertDoc,
  insertDocs,
  clearDocFields,
  queryEq,
  setSingleton,
  updateDocById,
} from "@/lib/firestoreRepo";
import {
  AiConversationMessage,
  AiSummary,
  AiSummaryType,
  CheckIn,
  Client,
  ClientDocument,
  ClientMemoryItem,
  ClientStatus,
  DEFAULT_HOLD_DAYS,
  DocumentType,
  EmailLog,
  ExternalCalendarEvent,
  FormSubmission,
  FormTemplate,
  GoogleCalendarSettings,
  GrowthActionPlan,
  JourneyMilestone,
  JourneyPhase,
  Message,
  MILESTONE_TEMPLATE,
  Payment,
  PortalAssignment,
  PostIntegrationForm,
  PreparationPlan,
  Profile,
  Prospect,
  ProspectCall,
  ProspectTranscript,
  Recording,
  ReferralSource,
  Session,
  SessionNote,
  SessionNoteField,
  SessionType,
  SmsLog,
  Task,
  Transcript,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Real, persistent data layer (Firestore), with the original in-memory mock
// store kept as an automatic fallback when no FIREBASE_* env vars are
// configured (e.g. a fresh local checkout with no credentials yet, or CI).
//
// Every exported function below has the exact same signature/behavior it
// always had — only the storage backend changed. The small generic helpers
// just below (listAll/listWhere/findById/create/createMany/patchById) pick
// Firestore or the mock array at call time based on `isFirebaseConfigured`,
// so the bulk of this file reads the same either way.
// ---------------------------------------------------------------------------

// A tiny process-local read-through cache keeps route-to-route navigation from
// repeating the same Firestore reads. It is deliberately brief: mutations
// below clear it immediately, while a natural expiry protects live data even
// across another server instance.
const FIRESTORE_READ_CACHE_MS = 3_000;
const firestoreReadCache = new Map<string, { expiresAt: number; value: Promise<unknown> }>();

function cachedFirestoreRead<T>(key: string, read: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const cached = firestoreReadCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value as Promise<T>;

  const value = read();
  firestoreReadCache.set(key, { expiresAt: now + FIRESTORE_READ_CACHE_MS, value });
  void value.catch(() => firestoreReadCache.delete(key));
  return value;
}

function invalidateFirestoreReadCache() {
  firestoreReadCache.clear();
}

async function listAll<T>(mockArr: T[], collection: string): Promise<T[]> {
  return isFirebaseConfigured
    ? cachedFirestoreRead(`all:${collection}`, () => allDocs<T>(collection))
    : [...mockArr];
}

async function listWhere<T>(
  mockArr: T[],
  collection: string,
  field: string,
  value: unknown
): Promise<T[]> {
  if (isFirebaseConfigured) {
    return cachedFirestoreRead(`where:${collection}:${field}:${JSON.stringify(value)}`, () => queryEq<T>(collection, field, value));
  }
  return mockArr.filter((x) => (x as unknown as Record<string, unknown>)[field] === value);
}

async function findById<T extends { id: string }>(
  mockArr: T[],
  collection: string,
  id: string
): Promise<T | undefined> {
  if (isFirebaseConfigured) return cachedFirestoreRead(`id:${collection}:${id}`, () => getDocById<T>(collection, id));
  return mockArr.find((x) => x.id === id);
}

async function create<T extends { id: string }>(mockArr: T[], collection: string, doc: T): Promise<T> {
  if (isFirebaseConfigured) {
    const created = await insertDoc(collection, doc);
    invalidateFirestoreReadCache();
    return created;
  }
  mockArr.push(doc);
  return doc;
}

async function createMany<T extends { id: string }>(
  mockArr: T[],
  collection: string,
  docs: T[]
): Promise<T[]> {
  if (docs.length === 0) return docs;
  if (isFirebaseConfigured) {
    const created = await insertDocs(collection, docs);
    invalidateFirestoreReadCache();
    return created;
  }
  mockArr.push(...docs);
  return docs;
}

async function removeById<T extends { id: string }>(
  mockArr: T[],
  collection: string,
  id: string
): Promise<void> {
  if (isFirebaseConfigured) {
    await deleteDoc(collection, id);
    invalidateFirestoreReadCache();
    return;
  }
  const idx = mockArr.findIndex((x) => x.id === id);
  if (idx !== -1) mockArr.splice(idx, 1);
}

async function removeWhere<T>(
  mockArr: T[],
  collection: string,
  field: string,
  value: unknown
): Promise<void> {
  if (isFirebaseConfigured) {
    await deleteDocsWhere(collection, field, value);
    invalidateFirestoreReadCache();
    return;
  }
  for (let i = mockArr.length - 1; i >= 0; i--) {
    if ((mockArr[i] as unknown as Record<string, unknown>)[field] === value) mockArr.splice(i, 1);
  }
}

async function patchById<T extends { id: string }>(
  mockArr: T[],
  collection: string,
  id: string,
  patch: Partial<T>
): Promise<T | undefined> {
  // A blank id means the caller is acting on a record that doesn't exist
  // (see getDocById's note) — "nothing to patch", not an error.
  if (!id) return undefined;
  if (isFirebaseConfigured) {
    const updated = await updateDocById<T>(collection, id, patch);
    invalidateFirestoreReadCache();
    return updated;
  }
  const item = mockArr.find((x) => x.id === id);
  if (!item) return undefined;
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (v !== undefined) (item as unknown as Record<string, unknown>)[k] = v;
  }
  return item;
}

// Removes fields outright, rather than patching them.
//
// patchById can't express this: both backends skip undefined values (the
// Firestore write is merge-based, the mock loop checks `v !== undefined`),
// because callers routinely pass optional fields as undefined meaning "leave
// this alone". Clearing therefore needs its own primitive — see
// clearSessionGoogleEvent for the case that made this necessary.
async function clearFields<T extends { id: string }>(
  mockArr: T[],
  collection: string,
  id: string,
  fields: (keyof T & string)[]
): Promise<void> {
  if (!id) return;
  if (isFirebaseConfigured) {
    await clearDocFields(collection, id, fields);
    invalidateFirestoreReadCache();
    return;
  }
  const item = mockArr.find((x) => x.id === id);
  if (!item) return;
  for (const f of fields) delete (item as Record<string, unknown>)[f];
}

// ---------------------------------------------------------------------------
// Session <-> journey progress wiring.
//
// Scheduling or completing a session moves the client's status/phase
// forward automatically — but only forward. We never downgrade a client
// (e.g. completing an old "preparation" session after they're already in
// Integration 2 shouldn't roll them back), and we never touch clients who
// are inactive or already closed out.
// ---------------------------------------------------------------------------

const STATUS_ORDER: ClientStatus[] = [
  "inquiry",
  "intake_scheduled",
  "intake_complete",
  "preparation",
  "preparation_complete",
  "journey_scheduled",
  "journey_complete",
  "check_in_complete",
  "integration_1",
  "integration_1_complete",
  "integration_2",
  "integration_2_complete",
  "journey_closed",
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

interface SessionProgressRule {
  status: ClientStatus;
  phase: JourneyPhase;
  milestoneKey?: string;
}

// What scheduling a (not-yet-happened) session of this type implies about
// where the client is in their journey.
const SESSION_SCHEDULED_PROGRESS: Partial<Record<SessionType, SessionProgressRule>> = {
  intake_assessment: { status: "intake_scheduled", phase: "intake" },
  harm_reduction_support: { status: "journey_scheduled", phase: "harm_reduction_session" },
  integration_1: { status: "integration_1", phase: "integration_1" },
  integration_2: { status: "integration_2", phase: "integration_2" },
};

// What completing a session of this type implies — also flips the matching
// milestone so the journey progress bar stays in sync.
const SESSION_COMPLETED_PROGRESS: Partial<Record<SessionType, SessionProgressRule>> = {
  intake_assessment: { status: "intake_complete", phase: "preparation", milestoneKey: "intake_complete" },
  preparation: { status: "preparation_complete", phase: "harm_reduction_session", milestoneKey: "preparation_complete" },
  harm_reduction_support: { status: "journey_complete", phase: "post_journey_check_in", milestoneKey: "journey_complete" },
  check_in_12hr: { status: "check_in_complete", phase: "integration_1", milestoneKey: "check_in_12hr_complete" },
  integration_1: { status: "integration_1_complete", phase: "integration_2", milestoneKey: "integration_1_complete" },
  integration_2: { status: "integration_2_complete", phase: "closed", milestoneKey: "integration_2_complete" },
};

// Where a client returns when the practitioner undoes a session completion.
// This is applied only while the client is still exactly at the state caused
// by that completion, so reopening an older session never erases later work.
const SESSION_REOPEN_PROGRESS: Partial<Record<SessionType, SessionProgressRule>> = {
  intake_assessment: { status: "intake_scheduled", phase: "intake" },
  preparation: { status: "preparation", phase: "preparation" },
  harm_reduction_support: { status: "journey_scheduled", phase: "harm_reduction_session" },
  check_in_12hr: { status: "journey_complete", phase: "post_journey_check_in" },
  integration_1: { status: "integration_1", phase: "integration_1" },
  integration_2: { status: "integration_2", phase: "integration_2" },
};

async function applyJourneyProgress(clientId: string, rule?: SessionProgressRule) {
  if (!rule) return;
  const c = await getClient(clientId);
  if (!c || c.status === "inactive" || c.status === "journey_closed") return;

  const patch: Partial<Client> = {};
  if (STATUS_ORDER.indexOf(rule.status) > STATUS_ORDER.indexOf(c.status)) {
    patch.status = rule.status;
  }
  if (PHASE_ORDER.indexOf(rule.phase) > PHASE_ORDER.indexOf(c.current_phase)) {
    patch.current_phase = rule.phase;
  }
  if (Object.keys(patch).length > 0) await updateClient(clientId, patch);
  if (rule.milestoneKey) await completeMilestone(clientId, rule.milestoneKey);
}

async function revertJourneyProgressForSession(session: Session) {
  const completedRule = SESSION_COMPLETED_PROGRESS[session.session_type];
  const reopenRule = SESSION_REOPEN_PROGRESS[session.session_type];
  if (!completedRule || !reopenRule) return;

  const sessions = await listWhere(store.sessions, "sessions", "client_id", session.client_id);
  const hasAnotherCompletedSession = sessions.some(
    (candidate) =>
      candidate.id !== session.id &&
      candidate.session_type === session.session_type &&
      candidate.status === "completed"
  );
  if (hasAnotherCompletedSession) return;

  const client = await getClient(session.client_id);
  if (!client) return;
  const completionIsCurrent =
    client.status === completedRule.status && client.current_phase === completedRule.phase;
  if (!completionIsCurrent) return;

  await updateClient(session.client_id, {
    status: reopenRule.status,
    current_phase: reopenRule.phase,
  });
  if (completedRule.milestoneKey) {
    await uncompleteMilestone(session.client_id, completedRule.milestoneKey);
  }
}

// Document types that are NOT (yet) backed by a Form Library template —
// these stay as plain upload slots. Anything backed by a template in
// lib/mock/formTemplates.ts is sourced from the template instead (see
// createClient below), so the client fills it out + signs it in the portal
// rather than uploading a file.
const UPLOAD_ONLY_DOCUMENT_TYPES: { type: DocumentType; required: boolean }[] = [
  { type: "post_integration_form", required: true },
  { type: "post_integration_form_updated", required: true },
  { type: "session_notes", required: false },
  { type: "journey_brief", required: false },
  { type: "integration_summary_1", required: false },
  { type: "integration_summary_2", required: false },
  { type: "growth_action_plan", required: false },
];

// ---------------------------------------------------------------------------
// PRACTITIONER PROFILE + REFERRAL SOURCES
// ---------------------------------------------------------------------------

const PRACTICE_NAME = "Stillwater Integration Studio";

export async function getPractitioner(): Promise<Profile> {
  if (isFirebaseConfigured) {
    const existing = await getDocById<Profile>("meta", "practitioner");
    if (existing) {
      if (existing.practice_name !== "Heartful Labs") return existing;
      return setSingleton<Profile & Record<string, unknown>>(
        "meta",
        "practitioner",
        { ...existing, practice_name: PRACTICE_NAME } as Profile & Record<string, unknown>
      );
    }
    // First run against a brand-new Firestore project: seed from the mock
    // practitioner profile so the app has something sensible to show.
    return setSingleton<Profile & Record<string, unknown>>(
      "meta",
      "practitioner",
      store.practitioner as unknown as Profile & Record<string, unknown>
    );
  }
  if (store.practitioner.practice_name === "Heartful Labs") {
    store.practitioner.practice_name = PRACTICE_NAME;
  }
  return store.practitioner;
}

export async function updatePractitioner(patch: Partial<Profile>): Promise<Profile> {
  if (isFirebaseConfigured) {
    const current = await getPractitioner();
    const updated = { ...current, ...patch };
    return setSingleton<Profile & Record<string, unknown>>(
      "meta",
      "practitioner",
      updated as Profile & Record<string, unknown>
    );
  }
  Object.assign(store.practitioner, patch);
  return store.practitioner;
}

export async function getReferralSources(): Promise<ReferralSource[]> {
  if (isFirebaseConfigured) {
    const existing = await allDocs<ReferralSource>("referralSources");
    if (existing.length > 0) return existing;
    // Seed once from the mock constants so the new-client form has options.
    return insertDocs("referralSources", store.referralSources);
  }
  return store.referralSources;
}

export async function createReferralSource(name: string, category?: string): Promise<ReferralSource> {
  const practitioner = await getPractitioner();
  const src: ReferralSource = { id: nextId("ref"), practitioner_id: practitioner.id, name, category };
  return create(store.referralSources, "referralSources", src);
}

export async function deleteReferralSource(id: string): Promise<void> {
  if (isFirebaseConfigured) {
    const { getDb } = await import("@/lib/firebaseAdmin");
    await getDb()!.collection("referralSources").doc(id).delete();
    return;
  }
  const idx = store.referralSources.findIndex((r) => r.id === id);
  if (idx !== -1) store.referralSources.splice(idx, 1);
}

// ---------------------------------------------------------------------------
// CLIENTS
// ---------------------------------------------------------------------------

// One-way hash for client-chosen portal passwords. Not bcrypt/scrypt — this
// app has no other PII-grade secrets at rest and is deliberately simple
// (see practitioner password handling in actions.ts) — but we still never
// store the plaintext password itself.
export function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

/** A record is on hold if it carries an on_hold_at timestamp. */
export function isOnHold(record: { on_hold_at?: string } | undefined | null): boolean {
  return Boolean(record?.on_hold_at);
}

async function allClients(): Promise<Client[]> {
  const clients = await listAll(store.clients, "clients");
  // Defensive de-dupe: guards against any stale duplicate-id records (e.g.
  // left over in a long-running dev server's in-memory store).
  const byId = new Map<string, Client>();
  for (const c of clients) byId.set(c.id, c);
  return [...byId.values()].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

/**
 * Default client read — EXCLUDES anyone on hold. This is deliberately the
 * default so a new view can't accidentally leak held clients into the
 * practitioner's working surfaces. Reach for getClientsIncludingOnHold only
 * where completeness matters more than focus (financial totals, exports).
 */
export async function getClients(): Promise<Client[]> {
  return (await allClients()).filter((c) => !isOnHold(c));
}

/** Every client regardless of hold state. */
export async function getClientsIncludingOnHold(): Promise<Client[]> {
  return allClients();
}

/** Only clients currently on hold, soonest follow-up first. */
export async function getOnHoldClients(): Promise<Client[]> {
  return (await allClients())
    .filter(isOnHold)
    .sort((a, b) => ((a.hold_follow_up_at ?? "") < (b.hold_follow_up_at ?? "") ? -1 : 1));
}

export async function getClient(id: string): Promise<Client | undefined> {
  return findById(store.clients, "clients", id);
}

// Client sets their own email + password the first time they open their
// private portal link (see actions.ts createPortalAccountAction).
export async function createPortalAccount(clientId: string, email: string, password: string): Promise<void> {
  await patchById(store.clients, "clients", clientId, {
    portal_email: email.trim().toLowerCase(),
    portal_password_hash: hashPassword(password),
  } as Partial<Client>);
}

// Practitioner-triggered reset for a client who forgot their password —
// clears the stored hash so the client sees the "create your account" form
// again next time they open their portal link, and can set a new password.
export async function resetPortalPassword(clientId: string): Promise<void> {
  // patchById (mock store) skips `undefined` values, so clear with an empty
  // string instead — every check below treats a falsy hash as "no account".
  await patchById(store.clients, "clients", clientId, {
    portal_password_hash: "",
  } as Partial<Client>);
}

export async function verifyPortalLogin(
  clientId: string,
  email: string,
  password: string
): Promise<{ ok: boolean; passwordHash?: string }> {
  const client = await findById(store.clients, "clients", clientId);
  if (!client?.portal_password_hash || !client.portal_email) return { ok: false };
  const emailMatches = client.portal_email === email.trim().toLowerCase();
  const passwordMatches = client.portal_password_hash === hashPassword(password);
  if (!emailMatches || !passwordMatches) return { ok: false };
  return { ok: true, passwordHash: client.portal_password_hash };
}

export async function updateClient(id: string, patch: Partial<Client>): Promise<Client | undefined> {
  return patchById(store.clients, "clients", id, { ...patch, updated_at: new Date().toISOString() });
}

export async function createClient(input: {
  full_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  referral_source_id?: string;
  notes?: string;
  package_name?: string;
  package_value?: number;
}): Promise<Client> {
  const id = nextId("client");
  const now = new Date().toISOString();
  const practitioner = await getPractitioner();
  const newClient: Client = {
    id,
    practitioner_id: practitioner.id,
    portal_user_id: `${id}_portal`,
    full_name: input.full_name,
    email: input.email,
    phone: input.phone,
    date_of_birth: input.date_of_birth,
    address: input.address,
    emergency_contact_name: input.emergency_contact_name,
    emergency_contact_phone: input.emergency_contact_phone,
    emergency_contact_relationship: input.emergency_contact_relationship,
    referral_source_id: input.referral_source_id,
    status: "inquiry",
    current_phase: "intake",
    notes: input.notes ?? "",
    package_name: input.package_name,
    package_value: input.package_value,
    amount_paid: 0,
    created_at: now,
    updated_at: now,
  };
  await create(store.clients, "clients", newClient);

  const milestones: JourneyMilestone[] = MILESTONE_TEMPLATE.map((m) => ({
    id: nextId("ms"),
    client_id: id,
    milestone_key: m.key,
    label: m.label,
    sort_order: m.sort_order,
    completed: false,
  }));
  await createMany(store.milestones, "milestones", milestones);

  // Every active+required template in the Form Library auto-attaches to
  // the new client as a form-backed document slot.
  const templates = await getFormTemplates();
  const templateDocuments: ClientDocument[] = templates
    .filter((t) => t.required && t.active)
    .map((t) => ({
      id: nextId("doc"),
      client_id: id,
      document_type: t.document_type,
      title: t.title,
      required: t.required,
      status: "missing",
      versions: [],
    }));
  const templateCoveredTypes = new Set(templateDocuments.map((d) => d.document_type));

  const uploadOnlyDocuments: ClientDocument[] = UPLOAD_ONLY_DOCUMENT_TYPES.filter(
    ({ type }) => !templateCoveredTypes.has(type)
  ).map(({ type, required }) => ({
    id: nextId("doc"),
    client_id: id,
    document_type: type,
    title: type,
    required,
    status: "missing",
    versions: [],
  }));

  await createMany(store.documents, "documents", [...templateDocuments, ...uploadOnlyDocuments]);

  return newClient;
}

// Permanently deletes a client and every record tied to them. There's no
// undo — the caller (the delete confirmation in the UI) is responsible for
// making sure the practitioner really means it. sessionNotes are keyed by
// session_id rather than client_id, so we look up that client's session ids
// first and sweep notes for each of them.
export async function deleteClient(clientId: string): Promise<void> {
  const sessions = await listWhere(store.sessions, "sessions", "client_id", clientId);
  for (const session of sessions) {
    await removeWhere(store.sessionNotes, "sessionNotes", "session_id", session.id);
  }

  await Promise.all([
    removeWhere(store.milestones, "milestones", "client_id", clientId),
    removeWhere(store.documents, "documents", "client_id", clientId),
    removeWhere(store.sessions, "sessions", "client_id", clientId),
    removeWhere(store.transcripts, "transcripts", "client_id", clientId),
    removeWhere(store.aiSummaries, "aiSummaries", "client_id", clientId),
    removeWhere(store.memory, "memory", "client_id", clientId),
    removeWhere(store.preparationPlans, "preparationPlans", "client_id", clientId),
    removeWhere(store.checkIns, "checkIns", "client_id", clientId),
    removeWhere(store.postIntegrationForms, "postIntegrationForms", "client_id", clientId),
    removeWhere(store.growthActionPlans, "growthActionPlans", "client_id", clientId),
    removeWhere(store.tasks, "tasks", "client_id", clientId),
    removeWhere(store.messages, "messages", "client_id", clientId),
    removeWhere(store.portalAssignments, "portalAssignments", "client_id", clientId),
    removeWhere(store.payments, "payments", "client_id", clientId),
    removeWhere(store.formSubmissions, "formSubmissions", "client_id", clientId),
    removeWhere(store.emailLogs, "emailLogs", "client_id", clientId),
  ]);

  await removeById(store.clients, "clients", clientId);
}

// Self-heal: a client created before MILESTONE_TEMPLATE grew a new entry
// (e.g. Growth Action Plan Complete was added after some clients already
// existed) won't have that milestone's record at all. Creating whatever's
// missing on read means every client always has the full current template,
// with no one-time migration script to remember to run.
async function ensureMilestones(clientId: string): Promise<JourneyMilestone[]> {
  const existing = await listWhere(store.milestones, "milestones", "client_id", clientId);
  const missing = MILESTONE_TEMPLATE.filter((t) => !existing.some((m) => m.milestone_key === t.key));
  if (missing.length === 0) return existing;
  const created: JourneyMilestone[] = missing.map((m) => ({
    id: nextId("ms"),
    client_id: clientId,
    milestone_key: m.key,
    label: m.label,
    sort_order: m.sort_order,
    completed: false,
  }));
  await createMany(store.milestones, "milestones", created);
  return [...existing, ...created];
}

export async function getMilestones(clientId: string): Promise<JourneyMilestone[]> {
  const milestones = await ensureMilestones(clientId);
  // Self-heal: a client whose status was set to "Journey Closed" via the
  // status dropdown before that action also completed this milestone (or a
  // client closed out any other way that didn't go through it) can end up
  // with the last progress dot stuck gray even though the file really is
  // closed. Sync it here on every read so the dot always reflects the
  // client's actual current status, not just changes made after this fix.
  const client = await findById(store.clients, "clients", clientId);
  const shouldBeClosed = client?.status === "journey_closed";
  const closedMilestone = milestones.find((m) => m.milestone_key === "journey_closed");
  if (closedMilestone && closedMilestone.completed !== shouldBeClosed) {
    await patchById(store.milestones, "milestones", closedMilestone.id, {
      completed: shouldBeClosed,
      completed_at: shouldBeClosed ? new Date().toISOString() : "",
    });
    closedMilestone.completed = shouldBeClosed;
  }
  return milestones.sort((a, b) => a.sort_order - b.sort_order);
}

export async function completeMilestone(clientId: string, milestoneKey: string) {
  const milestones = await ensureMilestones(clientId);
  const m = milestones.find((x) => x.milestone_key === milestoneKey);
  if (!m) return undefined;
  return patchById(store.milestones, "milestones", m.id, {
    completed: true,
    completed_at: new Date().toISOString(),
  });
}

export async function uncompleteMilestone(clientId: string, milestoneKey: string) {
  const milestones = await ensureMilestones(clientId);
  const m = milestones.find((x) => x.milestone_key === milestoneKey);
  if (!m) return undefined;
  return patchById(store.milestones, "milestones", m.id, {
    completed: false,
    completed_at: "",
  });
}

export function milestoneTemplate() {
  return MILESTONE_TEMPLATE;
}

export async function getDocuments(clientId: string): Promise<ClientDocument[]> {
  return listWhere(store.documents, "documents", "client_id", clientId);
}

export async function getDocument(documentId: string): Promise<ClientDocument | undefined> {
  return findById(store.documents, "documents", documentId);
}

export async function addClientDocument(
  clientId: string,
  documentType: DocumentType,
  title?: string,
  required = false
): Promise<ClientDocument> {
  const doc: ClientDocument = {
    id: nextId("doc"),
    client_id: clientId,
    document_type: documentType,
    title: title ?? documentType,
    required,
    status: "missing",
    versions: [],
  };
  return create(store.documents, "documents", doc);
}

// ---------------------------------------------------------------------------
// FORM LIBRARY — templates + per-client submissions
// ---------------------------------------------------------------------------

export async function getFormTemplates(): Promise<FormTemplate[]> {
  if (isFirebaseConfigured) {
    const existing = await allDocs<FormTemplate>("formTemplates");
    if (existing.length > 0) return existing;
    // Seed once from the mock library so a brand-new Firestore project has
    // the practitioner's real intake/consent forms available immediately.
    return insertDocs("formTemplates", store.formTemplates);
  }
  return store.formTemplates;
}

export async function getFormTemplateById(templateId: string): Promise<FormTemplate | undefined> {
  return findById(store.formTemplates, "formTemplates", templateId);
}

// Firestore is only seeded from lib/mock/formTemplates.ts ONCE, the first
// time getFormTemplates() runs on a brand-new project (see above) — after
// that, Firestore is the source of truth and code edits to the template
// file (fixing a typo, changing a field type, tweaking wording) never reach
// production on their own. This re-syncs every template's content (title,
// description, sections/fields) from the current code, while preserving
// each template's existing required/active flags so a practitioner's
// Form Library toggles aren't reset.
export async function resyncFormTemplates(): Promise<FormTemplate[]> {
  if (!isFirebaseConfigured) return store.formTemplates;

  // 1. Update template content (preserve practitioner's required/active flags)
  const existing = await allDocs<FormTemplate>("formTemplates");
  const existingById = new Map(existing.map((t) => [t.id, t]));
  const merged = store.formTemplates.map((tpl) => {
    const prev = existingById.get(tpl.id);
    return prev ? { ...tpl, required: prev.required, active: prev.active } : tpl;
  });
  const updatedTemplates = await insertDocs("formTemplates", merged);

  // 2. Backfill missing document slots on existing clients for any templates
  //    that are required+active but don't yet have a document slot for that client.
  const clients = await getClients();
  const activeRequired = updatedTemplates.filter((t) => t.required && t.active);
  for (const client of clients) {
    const clientDocs = await getDocuments(client.id);
    const existingTypes = new Set(clientDocs.map((d) => d.document_type));
    const missing: ClientDocument[] = activeRequired
      .filter((t) => !existingTypes.has(t.document_type))
      .map((t) => ({
        id: nextId("doc"),
        client_id: client.id,
        document_type: t.document_type,
        title: t.title,
        required: t.required,
        status: "missing" as const,
        versions: [],
      }));
    if (missing.length > 0) {
      await createMany(store.documents, "documents", missing);
    }
  }

  return updatedTemplates;
}

export async function getFormTemplateForDocumentType(
  documentType: DocumentType
): Promise<FormTemplate | undefined> {
  const templates = await listWhere(store.formTemplates, "formTemplates", "document_type", documentType);
  return templates.find((t) => t.active);
}

export async function setFormTemplateFlags(
  templateId: string,
  patch: { required?: boolean; active?: boolean }
): Promise<FormTemplate | undefined> {
  return patchById(store.formTemplates, "formTemplates", templateId, patch);
}

export async function getFormSubmission(documentId: string): Promise<FormSubmission | undefined> {
  const subs = await listWhere(store.formSubmissions, "formSubmissions", "document_id", documentId);
  return subs[0];
}

export async function getFormSubmissionsForClient(clientId: string): Promise<FormSubmission[]> {
  return listWhere(store.formSubmissions, "formSubmissions", "client_id", clientId);
}

export async function saveFormSubmission(params: {
  clientId: string;
  documentId: string;
  templateId: string;
  answers: Record<string, string | string[] | boolean>;
  status: "draft" | "in_progress" | "submitted" | "signed";
}): Promise<FormSubmission> {
  const now = new Date().toISOString();
  let submission = await getFormSubmission(params.documentId);
  if (!submission) {
    submission = {
      id: nextId("sub"),
      client_id: params.clientId,
      document_id: params.documentId,
      template_id: params.templateId,
      answers: params.answers,
      status: params.status,
    };
    await create(store.formSubmissions, "formSubmissions", submission);
  } else {
    const patch: Partial<FormSubmission> = {
      answers: { ...submission.answers, ...params.answers },
      status: params.status,
    };
    if (params.status === "submitted") patch.submitted_at = now;
    if (params.status === "signed") patch.signed_at = now;
    submission = (await patchById(store.formSubmissions, "formSubmissions", submission.id, patch)) ?? submission;
  }

  const doc = await getDocument(params.documentId);
  if (doc) {
    if (params.status === "signed") await patchById(store.documents, "documents", doc.id, { status: "signed" });
    else if (params.status === "submitted") await patchById(store.documents, "documents", doc.id, { status: "uploaded" });
  }

  return submission;
}

export async function markDocumentReviewed(documentId: string) {
  return patchById(store.documents, "documents", documentId, { status: "reviewed" });
}

export async function uploadDocumentVersion(
  documentId: string,
  fileName: string,
  notes?: string
) {
  const doc = await getDocument(documentId);
  if (!doc) return undefined;
  const versionNumber = doc.versions.length + 1;
  const version = {
    id: nextId("docv"),
    document_id: documentId,
    version_number: versionNumber,
    file_url: `/mock-files/${doc.client_id}/${doc.document_type}-v${versionNumber}.pdf`,
    file_name: fileName,
    file_size_bytes: Math.floor(Math.random() * 500000) + 50000,
    mime_type: fileName.endsWith(".pdf") ? "application/pdf" : "application/octet-stream",
    uploaded_by_role: "practitioner" as const,
    notes,
    created_at: new Date().toISOString(),
  };
  const versions = [version, ...doc.versions];
  return patchById(store.documents, "documents", documentId, {
    versions,
    current_version_id: version.id,
    status: "uploaded",
  });
}

export async function getSessions(clientId: string): Promise<Session[]> {
  const sessions = await listWhere(store.sessions, "sessions", "client_id", clientId);
  return sessions.sort((a, b) => ((a.scheduled_at ?? "") < (b.scheduled_at ?? "") ? -1 : 1));
}

export async function getSession(sessionId: string): Promise<Session | undefined> {
  return findById(store.sessions, "sessions", sessionId);
}

// The one session a phase page is "about". Prefer a still-scheduled session
// of that type; otherwise fall back to the most recent one by date, so a
// completed or cancelled session still anchors the page. A plain .find()
// here picks whichever record happens to sit first in the array, which can
// be a stale cancelled one even when a newer session is on the calendar.
export function pickPhaseSession(sessions: Session[], sessionType: SessionType): Session | undefined {
  return (
    sessions.find((s) => s.session_type === sessionType && s.status === "scheduled") ??
    sessions
      .filter((s) => s.session_type === sessionType)
      .sort((a, b) => ((b.scheduled_at ?? "") > (a.scheduled_at ?? "") ? 1 : -1))[0]
  );
}

/**
 * Attach client names to practice-wide lists (upcoming sessions, calendar,
 * outstanding tasks, copilot outlook).
 *
 * Also DROPS items belonging to a client on hold — parking someone has to
 * take their sessions and tasks off these surfaces too, otherwise the client
 * disappears from the list but their work keeps nagging from the dashboard.
 * Per-client reads (getSessions, getTasks) deliberately don't route through
 * here, so a held client's own record still shows everything.
 */
async function withClientNames<T extends { client_id: string }>(
  items: T[]
): Promise<(T & { client_name: string })[]> {
  const clients = await getClients();
  const byId = new Map(clients.map((c) => [c.id, c.full_name]));
  const heldIds = new Set((await getOnHoldClients()).map((c) => c.id));
  return items
    .filter((item) => !heldIds.has(item.client_id))
    .map((item) => ({ ...item, client_name: byId.get(item.client_id) ?? "Unknown Client" }));
}

export async function getUpcomingSessions(limit = 10): Promise<(Session & { client_name: string })[]> {
  const all = await listAll(store.sessions, "sessions");
  const now = Date.now();
  const upcoming = all
    .filter((s) => s.status === "scheduled" && s.scheduled_at && new Date(s.scheduled_at).getTime() >= now)
    .sort((a, b) => (a.scheduled_at! < b.scheduled_at! ? -1 : 1))
    .slice(0, limit);
  return withClientNames(upcoming);
}

// Every scheduled session across the whole practice falling within the next
// `days` days — used for the AI Copilot's planning-ahead outlook, which
// (unlike getUpcomingSessions' top-8 cutoff) needs to show everything coming
// up in a fixed window regardless of how many clients that touches.
export async function getUpcomingSessionsWithinDays(days: number): Promise<(Session & { client_name: string })[]> {
  const now = Date.now();
  const cutoff = now + days * 24 * 60 * 60 * 1000;
  const all = await listAll(store.sessions, "sessions");
  const upcoming = all
    .filter((s) => {
      if (s.status !== "scheduled" || !s.scheduled_at) return false;
      const t = new Date(s.scheduled_at).getTime();
      return t >= now && t <= cutoff;
    })
    .sort((a, b) => (a.scheduled_at! < b.scheduled_at! ? -1 : 1));
  return withClientNames(upcoming);
}

// Every session across every client, for the practice-wide Calendar view.
export async function getAllSessions(): Promise<(Session & { client_name: string })[]> {
  const all = await listAll(store.sessions, "sessions");
  const withNames = await withClientNames(all);
  return withNames.sort((a, b) => ((a.scheduled_at ?? "") < (b.scheduled_at ?? "") ? -1 : 1));
}

export async function addSession(input: {
  client_id: string;
  session_type: Session["session_type"];
  scheduled_at: string;
  duration_minutes?: number;
  location?: string;
}) {
  const practitioner = await getPractitioner();
  const s: Session = {
    id: nextId("sess"),
    practitioner_id: practitioner.id,
    status: "scheduled",
    ...input,
  };
  await create(store.sessions, "sessions", s);
  await applyJourneyProgress(s.client_id, SESSION_SCHEDULED_PROGRESS[s.session_type]);
  return s;
}

// Milestone → session type mapping used when auto-creating a session record
// from the milestone toggle (so Sessions tab is never empty after marking
// an activity complete).
const MILESTONE_SESSION_TYPE: Partial<Record<string, SessionType>> = {
  intake_complete: "intake_assessment",
  preparation_complete: "preparation",
  journey_complete: "harm_reduction_support",
  check_in_12hr_complete: "check_in_12hr",
  integration_1_complete: "integration_1",
  integration_2_complete: "integration_2",
};

// Ensures a session record of the given type exists for this client.
// If one already exists (scheduled or completed), returns it as-is.
// Otherwise creates a completed session dated now so it shows up in the
// Sessions tab and can receive AI summaries.
export async function ensureSessionRecord(clientId: string, milestoneKey: string): Promise<Session | undefined> {
  const sessionType = MILESTONE_SESSION_TYPE[milestoneKey];
  if (!sessionType) return undefined;

  const existing = await listWhere(store.sessions, "sessions", "client_id", clientId);
  const match = existing.find((s) => s.session_type === sessionType);
  if (match) return match;

  const practitioner = await getPractitioner();
  const s: Session = {
    id: nextId("sess"),
    client_id: clientId,
    practitioner_id: practitioner.id,
    session_type: sessionType,
    scheduled_at: new Date().toISOString(),
    status: "completed",
  };
  await create(store.sessions, "sessions", s);
  return s;
}

export async function updateSession(
  sessionId: string,
  patch: Partial<
    Pick<
      Session,
      "session_type" | "scheduled_at" | "duration_minutes" | "location" | "status" | "google_event_id" | "google_synced_at"
    >
  >
) {
  const existing = await findById(store.sessions, "sessions", sessionId);
  if (!existing) return undefined;
  const wasAlreadyCompleted = existing.status === "completed";
  const s = await patchById<Session>(store.sessions, "sessions", sessionId, patch);
  if (s && s.status === "completed" && !wasAlreadyCompleted) {
    await applyJourneyProgress(s.client_id, SESSION_COMPLETED_PROGRESS[s.session_type]);
  }
  return s;
}

export async function cancelSession(sessionId: string) {
  return updateSession(sessionId, { status: "cancelled" });
}

// Forget the Google Calendar event a session used to mirror to, after that
// event has been deleted on Google. Must go through clearFields, not
// updateSession — a patch of `{ google_event_id: undefined }` is stripped and
// silently leaves the stale id in place, which then makes the *next* push for
// this session try events.update against an event that no longer exists.
export async function clearSessionGoogleEvent(sessionId: string): Promise<void> {
  await clearFields(store.sessions, "sessions", sessionId, ["google_event_id"]);
  await patchById<Session>(store.sessions, "sessions", sessionId, {
    google_synced_at: new Date().toISOString(),
  });
}

export async function completeSession(sessionId: string) {
  return updateSession(sessionId, { status: "completed" });
}

export async function reopenCompletedSession(sessionId: string) {
  const existing = await findById(store.sessions, "sessions", sessionId);
  if (!existing || existing.status !== "completed") return existing;
  const reopened = await patchById<Session>(store.sessions, "sessions", sessionId, { status: "scheduled" });
  await revertJourneyProgressForSession(existing);
  return reopened;
}

// Practitioner-only UI state on the per-client AI Copilot list — kept as a
// direct patch (not routed through updateSession) since it should never
// trigger the journey-progress side effects tied to a real status change.
export async function setSessionCopilotState(sessionId: string, patch: { hidden?: boolean; finished?: boolean }) {
  const dbPatch: Partial<Pick<Session, "copilot_hidden" | "copilot_finished">> = {};
  if (patch.hidden !== undefined) dbPatch.copilot_hidden = patch.hidden;
  if (patch.finished !== undefined) dbPatch.copilot_finished = patch.finished;
  return patchById<Session>(store.sessions, "sessions", sessionId, dbPatch);
}

// Free-form "Manual Notes" on a session (Journey Day, etc.) — kept as a
// direct patch for the same reason as setSessionCopilotState: it should
// never trigger the journey-progress side effects tied to a real status
// change on updateSession.
export async function setSessionManualNotes(sessionId: string, manualNotes: string) {
  return patchById<Session>(store.sessions, "sessions", sessionId, { manual_notes: manualNotes });
}

// Pasted transcript text — separate field from manual_notes (see the
// Session.transcript doc comment in types.ts). Both the practitioner-facing
// and client-facing AI summaries read from this single persisted source.
export async function setSessionTranscript(sessionId: string, transcript: string) {
  return patchById<Session>(store.sessions, "sessions", sessionId, { transcript });
}

// ---------------------------------------------------------------------------
// RECORDINGS — uploaded audio files (Plaud, iPhone Voice Memos, etc.)
// attached to a session. Actual bytes live in Cloud Storage, never in
// Firestore/the mock store — only metadata + the storage path are recorded
// here. Uploads go browser → signed URL → Cloud Storage directly, bypassing
// the Netlify function entirely (large audio files would blow past a
// serverless function's payload limit if routed through one).
// ---------------------------------------------------------------------------

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// Returns null if Cloud Storage isn't configured (no bucket set up yet) —
// callers should show a clear "storage isn't set up" message rather than a
// generic error in that case.
export async function createRecordingUploadUrl(
  clientId: string,
  sessionId: string,
  fileName: string,
  contentType: string
): Promise<{ uploadUrl: string; storagePath: string } | null> {
  const bucket = getBucket();
  if (!bucket) return null;
  const storagePath = `recordings/${clientId}/${sessionId}/${Date.now()}-${sanitizeFileName(fileName)}`;
  const [uploadUrl] = await bucket.file(storagePath).getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes to complete the upload
    contentType,
  });
  return { uploadUrl, storagePath };
}

// A fresh, short-lived signed READ url — generated on demand rather than
// stored, since signed URLs expire and files aren't public.
export async function getRecordingDownloadUrl(storagePath: string): Promise<string | null> {
  const bucket = getBucket();
  if (!bucket) return null;
  const [url] = await bucket.file(storagePath).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 60 * 60 * 1000, // 1 hour
  });
  return url;
}

export async function getRecordings(clientId: string, sessionId?: string): Promise<Recording[]> {
  const recordings = await listWhere(store.recordings, "recordings", "client_id", clientId);
  return recordings
    .filter((r) => !sessionId || r.session_id === sessionId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function addRecording(
  clientId: string,
  sessionId: string,
  fileName: string,
  storagePath: string,
  sizeBytes?: number
): Promise<Recording> {
  const recording: Recording = {
    id: nextId("rec"),
    client_id: clientId,
    session_id: sessionId,
    storage_path: storagePath,
    file_name: fileName,
    size_bytes: sizeBytes,
    created_at: new Date().toISOString(),
  };
  return create(store.recordings, "recordings", recording);
}

export async function deleteRecording(recordingId: string): Promise<void> {
  const existing = await findById<Recording>(store.recordings, "recordings", recordingId);
  await removeById(store.recordings, "recordings", recordingId);
  // Best-effort cleanup of the actual file — a Firestore-only delete
  // (leaving an orphaned Storage object) is far less harmful than failing
  // the whole delete over a Storage hiccup, so this is deliberately
  // fire-and-forget with its own try/catch.
  if (existing) {
    const bucket = getBucket();
    if (bucket) {
      try {
        await bucket.file(existing.storage_path).delete();
      } catch {
        // Ignore — the metadata record is already gone, which is what the
        // practitioner sees; a stray orphaned file isn't user-visible.
      }
    }
  }
}

type JourneyMarker = "started" | "ended" | "booster";

const JOURNEY_MARKER_FIELD: Record<JourneyMarker, "journey_started_at" | "journey_ended_at" | "booster_dose_at"> = {
  started: "journey_started_at",
  ended: "journey_ended_at",
  booster: "booster_dose_at",
};

const JOURNEY_MARKER_LABEL: Record<JourneyMarker, string> = {
  started: "Journey Begin",
  ended: "Journey End",
  booster: "Booster Dose",
};

// This runs server-side (inside the Netlify function), which defaults to
// UTC regardless of the practitioner's actual location — without an
// explicit IANA timeZone, the stamp written into Manual Notes would be off
// by however many hours the practitioner is from UTC. `timeZone` is the
// browser's zone (Intl.DateTimeFormat().resolvedOptions().timeZone),
// passed up from the client so this always renders in local time.
function formatMilestoneStamp(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

// Journey Begin / Journey End / Booster Dose toggles on a Journey Day
// session. Recording (clear = false) stamps the session record itself
// (which is what drives the History tab entry via activity.ts, no separate
// log needed) AND appends a matching timestamped line to Manual Notes, so
// the moment shows up both places without the practitioner having to type
// anything. Un-toggling (clear = true) just clears the session field — it
// does not try to remove the already-written notes line, since editing text
// the practitioner may have since added to would be more surprising than
// helpful; the notes remain as a plain record of what happened.
//
// `currentManualNotes`, if passed, is what's actually in the practitioner's
// browser right now — which may include text they've typed but not yet
// saved. We append onto THAT rather than the last-saved database copy, and
// persist the result, so toggling a marker can never silently discard
// unsaved typing (this was a real bug: toggling used to overwrite whatever
// was in the textarea with the stale saved copy plus the marker line).
export async function setJourneyMarker(
  sessionId: string,
  marker: JourneyMarker,
  clear = false,
  currentManualNotes?: string,
  timeZone?: string
) {
  const now = new Date().toISOString();
  const field = JOURNEY_MARKER_FIELD[marker];
  const patch: Partial<Pick<Session, "journey_started_at" | "journey_ended_at" | "booster_dose_at">> = {
    [field]: clear ? null : now,
  };
  const updated = await patchById<Session>(store.sessions, "sessions", sessionId, patch);
  if (!updated || clear) return updated;

  const line = `[${formatMilestoneStamp(now, timeZone)}] — ${JOURNEY_MARKER_LABEL[marker]}`;
  const base = currentManualNotes ?? updated.manual_notes ?? "";
  const nextNotes = base ? `${base}\n${line}\n` : `${line}\n`;
  return patchById<Session>(store.sessions, "sessions", sessionId, { manual_notes: nextNotes });
}

// Lets the practitioner correct a marker's recorded time after the fact
// (e.g. they forgot to toggle Journey Begin until a few minutes in) without
// re-triggering the notes-append or touching any other field.
export async function setJourneyMarkerTime(sessionId: string, marker: JourneyMarker, isoTimestamp: string) {
  const field = JOURNEY_MARKER_FIELD[marker];
  const patch: Partial<Pick<Session, "journey_started_at" | "journey_ended_at" | "booster_dose_at">> = {
    [field]: isoTimestamp,
  };
  return patchById<Session>(store.sessions, "sessions", sessionId, patch);
}

export async function setInitialDoseAmount(sessionId: string, amount: string) {
  return patchById<Session>(store.sessions, "sessions", sessionId, { initial_dose_amount: amount });
}

export async function setBoosterDoseAmount(sessionId: string, amount: string) {
  return patchById<Session>(store.sessions, "sessions", sessionId, { booster_dose_amount: amount });
}

export async function getTranscripts(clientId: string): Promise<Transcript[]> {
  return listWhere(store.transcripts, "transcripts", "client_id", clientId);
}

export async function addTranscript(clientId: string, rawText: string, sessionId?: string) {
  const t: Transcript = {
    id: nextId("tr"),
    client_id: clientId,
    session_id: sessionId,
    source: "paste",
    raw_text: rawText,
    created_at: new Date().toISOString(),
  };
  return create(store.transcripts, "transcripts", t);
}

export async function getAiSummaries(clientId: string, type?: AiSummaryType): Promise<AiSummary[]> {
  const summaries = await listWhere(store.aiSummaries, "aiSummaries", "client_id", clientId);
  return summaries
    .filter((s) => !type || s.summary_type === type)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function deleteAiSummary(summaryId: string): Promise<void> {
  await removeById(store.aiSummaries, "aiSummaries", summaryId);
}

// Lets a practitioner hand-correct a generated summary (e.g. the AI
// misheard something in the transcript) without having to delete and
// regenerate the whole thing.
export async function updateAiSummary(
  summaryId: string,
  content: Record<string, unknown>
): Promise<AiSummary | undefined> {
  return patchById<AiSummary>(store.aiSummaries, "aiSummaries", summaryId, { content });
}

export async function addAiSummary(
  clientId: string,
  type: AiSummaryType,
  title: string,
  content: Record<string, unknown>,
  model = "gpt-4o",
  sessionId?: string,
  stageLabel?: string
): Promise<AiSummary> {
  const summary: AiSummary = {
    id: nextId("ai"),
    client_id: clientId,
    ...(sessionId ? { session_id: sessionId } : {}),
    ...(stageLabel ? { stage_label: stageLabel } : {}),
    summary_type: type,
    title,
    content,
    model,
    created_at: new Date().toISOString(),
  };
  return create(store.aiSummaries, "aiSummaries", summary);
}

export async function getAiConversationMessages(clientId: string): Promise<AiConversationMessage[]> {
  const messages = await listWhere(store.aiConversationMessages, "aiConversationMessages", "client_id", clientId);
  return messages.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
}

export async function addAiConversationMessage(
  clientId: string,
  role: AiConversationMessage["role"],
  body: string,
  model?: string
): Promise<AiConversationMessage> {
  const message: AiConversationMessage = {
    id: nextId("aichat"),
    client_id: clientId,
    role,
    body,
    ...(model ? { model } : {}),
    created_at: new Date().toISOString(),
  };
  return create(store.aiConversationMessages, "aiConversationMessages", message);
}

export async function getMemory(clientId: string): Promise<ClientMemoryItem[]> {
  const items = await listWhere(store.memory, "memory", "client_id", clientId);
  return items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function addMemoryItems(
  clientId: string,
  items: { item_type: ClientMemoryItem["item_type"]; content: string; phase?: ClientMemoryItem["phase"] }[]
) {
  const created = items.map((i) => ({
    id: nextId("mem"),
    client_id: clientId,
    item_type: i.item_type,
    content: i.content,
    phase: i.phase,
    status: "open" as const,
    created_at: new Date().toISOString(),
  }));
  return createMany(store.memory, "memory", created);
}

export async function getSessionNotes(sessionId: string): Promise<SessionNote[]> {
  const notes = await listWhere(store.sessionNotes, "sessionNotes", "session_id", sessionId);
  return notes.sort((a, b) => (a.note_timestamp < b.note_timestamp ? -1 : 1));
}

export async function addSessionNote(
  sessionId: string,
  clientId: string,
  fieldType: SessionNoteField,
  content: string,
  elapsedMinutes?: number
) {
  const note: SessionNote = {
    id: nextId("sn"),
    session_id: sessionId,
    client_id: clientId,
    field_type: fieldType,
    note_timestamp: new Date().toISOString(),
    elapsed_minutes: elapsedMinutes,
    content,
  };
  return create(store.sessionNotes, "sessionNotes", note);
}

export async function getPreparationPlan(clientId: string): Promise<PreparationPlan | undefined> {
  const plans = await listWhere(store.preparationPlans, "preparationPlans", "client_id", clientId);
  return plans[0];
}

export async function upsertPreparationPlan(clientId: string, patch: Partial<PreparationPlan>) {
  const existing = await getPreparationPlan(clientId);
  const now = new Date().toISOString();
  if (!existing) {
    const plan: PreparationPlan = { id: nextId("prep"), client_id: clientId, updated_at: now, ...patch };
    return create(store.preparationPlans, "preparationPlans", plan);
  }
  return patchById(store.preparationPlans, "preparationPlans", existing.id, { ...patch, updated_at: now });
}

export async function getCheckIns(clientId: string): Promise<CheckIn[]> {
  return listWhere(store.checkIns, "checkIns", "client_id", clientId);
}

export async function addCheckIn(clientId: string, data: Omit<CheckIn, "id" | "client_id">) {
  const checkIn: CheckIn = { id: nextId("ci"), client_id: clientId, ...data };
  return create(store.checkIns, "checkIns", checkIn);
}

export async function getPostIntegrationForms(clientId: string): Promise<PostIntegrationForm[]> {
  return listWhere(store.postIntegrationForms, "postIntegrationForms", "client_id", clientId);
}

export async function addPostIntegrationForm(
  clientId: string,
  session: 1 | 2,
  responses: Record<string, string>
) {
  const form: PostIntegrationForm = {
    id: nextId("pif"),
    client_id: clientId,
    integration_session: session,
    responses,
    submitted_at: new Date().toISOString(),
  };
  return create(store.postIntegrationForms, "postIntegrationForms", form);
}

export async function getGrowthActionPlan(clientId: string): Promise<GrowthActionPlan | undefined> {
  const plans = await listWhere(store.growthActionPlans, "growthActionPlans", "client_id", clientId);
  return plans[0];
}

export async function setGrowthActionPlan(clientId: string, plan: Omit<GrowthActionPlan, "id" | "client_id" | "created_at">) {
  const existing = await getGrowthActionPlan(clientId);
  if (existing) {
    return patchById(store.growthActionPlans, "growthActionPlans", existing.id, plan);
  }
  const created: GrowthActionPlan = {
    id: nextId("gap"),
    client_id: clientId,
    created_at: new Date().toISOString(),
    ...plan,
  };
  return create(store.growthActionPlans, "growthActionPlans", created);
}

// Clears a client's Growth Action Plan (both the dedicated record and its
// backing AiSummary entry) so the practitioner can regenerate a fresh one
// from scratch rather than being stuck patching whatever was first generated.
export async function deleteGrowthActionPlan(clientId: string): Promise<void> {
  const existing = await getGrowthActionPlan(clientId);
  if (existing) {
    await removeById(store.growthActionPlans, "growthActionPlans", existing.id);
  }
  const summaries = await getAiSummaries(clientId, "growth_action_plan");
  for (const s of summaries) {
    await removeById(store.aiSummaries, "aiSummaries", s.id);
  }
  await uncompleteMilestone(clientId, "growth_action_plan_complete");
}

export async function getTasks(clientId?: string): Promise<Task[]> {
  const all = clientId
    ? await listWhere(store.tasks, "tasks", "client_id", clientId)
    : await listAll(store.tasks, "tasks");
  return [...all].sort((a, b) => ((a.due_at ?? "") < (b.due_at ?? "") ? -1 : 1));
}

export async function getOutstandingTasks(): Promise<(Task & { client_name: string })[]> {
  const all = await listAll(store.tasks, "tasks");
  const outstanding = all
    .filter((t) => t.status === "pending" || t.status === "overdue")
    .sort((a, b) => ((a.due_at ?? "") < (b.due_at ?? "") ? -1 : 1));
  return withClientNames(outstanding);
}

export interface OutstandingFormItem {
  id: string;
  title: string;
  client_id: string;
  client_name: string;
  status: "missing" | "in_progress";
  due_at?: undefined;
  kind: "form";
}

// Form-backed documents (intake/consent forms, etc.) aren't Task records —
// they live in `documents` + `formSubmissions` instead — so the practice-wide
// "Outstanding Forms / Tasks" stat on the dashboard has to pull them in
// explicitly, the same way the client portal's own Action Items list already
// does. Without this, a client with zero Task records but several unfilled
// forms incorrectly reads as having nothing outstanding.
export async function getOutstandingForms(): Promise<OutstandingFormItem[]> {
  const [clients, templates] = await Promise.all([getClients(), getFormTemplates()]);
  const items: OutstandingFormItem[] = [];
  for (const client of clients) {
    const [docs, submissions] = await Promise.all([
      getDocuments(client.id),
      getFormSubmissionsForClient(client.id),
    ]);
    for (const doc of docs) {
      const template = templates.find((t) => t.document_type === doc.document_type);
      if (!template) continue; // upload-only document types aren't in-app forms
      const submission = submissions.find((s) => s.document_id === doc.id);
      const status = submission?.status ?? "missing";
      if (status === "submitted" || status === "signed") continue;
      items.push({
        id: doc.id,
        title: template.title,
        client_id: client.id,
        client_name: client.full_name,
        status: (status === "in_progress" || status === "draft") ? "in_progress" : "missing",
        kind: "form",
      });
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// AGREEMENT PAPERWORK STATUS
//
// The three practice-wide agreements (see GENERAL_PAPERWORK_DOCUMENT_TYPES)
// are what a new client is asked to sign the moment their portal opens — the
// portal blocks on them. This rolls the state up per client so the dashboard
// can answer "who still owes me signed paperwork, and who just finished?"
// without the practitioner opening each record.
// ---------------------------------------------------------------------------
export interface ClientAgreementStatus {
  client_id: string;
  client_name: string;
  portal_account_created: boolean;
  signed_count: number;
  total_count: number;
  complete: boolean;
  outstanding_titles: string[];
  /** When the last of the agreements was signed — only set once complete. */
  completed_at?: string;
}

export async function getAgreementStatusByClient(clientRecords?: Client[]): Promise<ClientAgreementStatus[]> {
  const [clients, templates] = await Promise.all([
    clientRecords ? Promise.resolve(clientRecords) : getClients(),
    getFormTemplates(),
  ]);
  const agreementTemplates = templates.filter(
    (t) => isGeneralPaperwork(t.document_type) && t.active
  );
  if (agreementTemplates.length === 0) return [];

  const rows = await Promise.all(
    clients.map(async (client): Promise<ClientAgreementStatus> => {
      const [docs, submissions] = await Promise.all([
        getDocuments(client.id),
        getFormSubmissionsForClient(client.id),
      ]);

      let signed = 0;
      const outstanding: string[] = [];
      const timestamps: string[] = [];

      for (const template of agreementTemplates) {
        const doc = docs.find((d) => d.document_type === template.document_type);
        // No document slot yet means the client was created before this
        // template existed. Treat it as outstanding rather than silently
        // counting them complete — a re-sync will backfill the slot.
        if (!doc) {
          outstanding.push(template.title);
          continue;
        }
        const submission = submissions.find((sub) => sub.document_id === doc.id);
        const status = submission?.status ?? "missing";
        if (status === "signed" || status === "submitted") {
          signed += 1;
          const at = submission?.signed_at ?? submission?.submitted_at;
          if (at) timestamps.push(at);
        } else {
          outstanding.push(template.title);
        }
      }

      const total = agreementTemplates.length;
      const complete = signed === total;
      return {
        client_id: client.id,
        client_name: client.full_name,
        portal_account_created: Boolean(client.portal_password_hash),
        signed_count: signed,
        total_count: total,
        complete,
        outstanding_titles: outstanding,
        completed_at: complete && timestamps.length > 0 ? timestamps.sort().at(-1) : undefined,
      };
    })
  );

  // Incomplete first (most paperwork owed at the top), then recently finished.
  return rows.sort((a, b) => {
    if (a.complete !== b.complete) return a.complete ? 1 : -1;
    if (a.complete) return (b.completed_at ?? "").localeCompare(a.completed_at ?? "");
    return a.signed_count - b.signed_count;
  });
}

export async function getTask(taskId: string): Promise<Task | undefined> {
  return findById(store.tasks, "tasks", taskId);
}

export async function addTask(task: Omit<Task, "id">) {
  const t: Task = { id: nextId("task"), ...task };
  return create(store.tasks, "tasks", t);
}

export async function completeTask(taskId: string) {
  return patchById(store.tasks, "tasks", taskId, {
    status: "completed",
    completed_at: new Date().toISOString(),
  });
}

export async function getMessages(clientId: string): Promise<Message[]> {
  const messages = await listWhere(store.messages, "messages", "client_id", clientId);
  return messages.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
}

export async function addMessage(clientId: string, sender: Message["sender"], body: string) {
  const m: Message = {
    id: nextId("msg"),
    client_id: clientId,
    sender,
    body,
    created_at: new Date().toISOString(),
  };
  return create(store.messages, "messages", m);
}

export interface UnreadMessageThread {
  client_id: string;
  client_name: string;
  count: number;
  latest_body: string;
  latest_at: string;
}

// Practitioner-facing inbox summary — every client-sent message that hasn't
// been marked read yet, grouped by client. Read state is per-message
// (read_at), flipped to "now" by markMessagesRead once the practitioner
// actually opens that client's Messages tab.
export async function getUnreadMessagesSummary(): Promise<{ totalUnread: number; threads: UnreadMessageThread[] }> {
  const clients = await getClients();
  const threads: UnreadMessageThread[] = [];
  let totalUnread = 0;
  for (const client of clients) {
    const messages = await getMessages(client.id);
    const unread = messages.filter((m) => m.sender === "client" && !m.read_at);
    if (unread.length === 0) continue;
    totalUnread += unread.length;
    const latest = unread[unread.length - 1];
    threads.push({
      client_id: client.id,
      client_name: client.full_name,
      count: unread.length,
      latest_body: latest.body,
      latest_at: latest.created_at,
    });
  }
  threads.sort((a, b) => (a.latest_at < b.latest_at ? 1 : -1));
  return { totalUnread, threads };
}

export async function markMessagesRead(clientId: string): Promise<void> {
  const messages = await getMessages(clientId);
  const now = new Date().toISOString();
  await Promise.all(
    messages
      .filter((m) => m.sender === "client" && !m.read_at)
      .map((m) => patchById(store.messages, "messages", m.id, { read_at: now }))
  );
}

export async function getEmailLogs(clientId: string): Promise<EmailLog[]> {
  const logs = await listWhere(store.emailLogs, "emailLogs", "client_id", clientId);
  return logs.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
}

export async function addEmailLog(clientId: string, emailType: EmailLog["email_type"], channel: EmailLog["channel"]) {
  const log: EmailLog = {
    id: nextId("email"),
    client_id: clientId,
    email_type: emailType,
    channel,
    created_at: new Date().toISOString(),
  };
  return create(store.emailLogs, "emailLogs", log);
}

export async function getSmsLogs(clientId: string): Promise<SmsLog[]> {
  const logs = await listWhere(store.smsLogs, "smsLogs", "client_id", clientId);
  return logs.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
}

export async function addSmsLog(clientId: string, smsType: SmsLog["sms_type"], channel: SmsLog["channel"]) {
  const log: SmsLog = {
    id: nextId("sms"),
    client_id: clientId,
    sms_type: smsType,
    channel,
    created_at: new Date().toISOString(),
  };
  return create(store.smsLogs, "smsLogs", log);
}

export async function getPortalAssignments(clientId: string): Promise<PortalAssignment[]> {
  return listWhere(store.portalAssignments, "portalAssignments", "client_id", clientId);
}

export async function addPortalAssignment(assignment: Omit<PortalAssignment, "id">) {
  const a: PortalAssignment = { id: nextId("pa"), ...assignment };
  return create(store.portalAssignments, "portalAssignments", a);
}

export async function completePortalAssignment(id: string) {
  return patchById(store.portalAssignments, "portalAssignments", id, {
    status: "completed",
    completed_at: new Date().toISOString(),
  });
}

export async function getPayments(clientId?: string) {
  return clientId
    ? listWhere(store.payments, "payments", "client_id", clientId)
    : listAll(store.payments, "payments");
}

export async function addPayment(
  clientId: string,
  amount: number,
  method?: string,
  notes?: string
) {
  const p: Payment = {
    id: nextId("pay"),
    client_id: clientId,
    amount,
    paid_at: new Date().toISOString(),
    method,
    notes,
  };
  return create(store.payments, "payments", p);
}

export async function updatePayment(
  paymentId: string,
  patch: Partial<Pick<Payment, "amount" | "paid_at" | "method" | "notes">>
) {
  return patchById<Payment>(store.payments, "payments", paymentId, patch);
}

// ---------------------------------------------------------------------------
// AGGREGATES — dashboard, reporting, search
// ---------------------------------------------------------------------------

const ACTIVE_STATUSES: ClientStatus[] = [
  "inquiry",
  "intake_scheduled",
  "intake_complete",
  "preparation",
  "preparation_complete",
  "journey_scheduled",
  "check_in_complete",
  "integration_1",
  "integration_1_complete",
  "integration_2",
  "integration_2_complete", // still active until journey is formally closed
];

export async function getActiveClientCount(): Promise<number> {
  const clients = await getClients();
  return clients.filter((client) => ACTIVE_STATUSES.includes(client.status)).length;
}

export async function getDashboardSummary() {
  // These reads are independent. Parallelizing them removes several server
  // round trips from every dashboard navigation.
  const [clients, clientsForRevenue, outstandingTasks, outstandingForms, unreadMessages, upcomingSessions, payments, referralSources] = await Promise.all([
    getClients(),
    getClientsIncludingOnHold(),
    getOutstandingTasks(),
    getOutstandingForms(),
    getUnreadMessagesSummary(),
    getUpcomingSessions(6),
    getPayments(),
    getReferralSources(),
  ]);
  const activeClients = clients.filter((c) => ACTIVE_STATUSES.includes(c.status));
  const awaitingIntegration = clients.filter(
    (c) => c.status === "journey_complete" || c.status === "check_in_complete" || c.status === "integration_1_complete"
  );
  const urgencyReference = Date.now();
  const urgencyRank = (item: (typeof outstandingTasks)[number] | (typeof outstandingForms)[number]) => {
    if (item.status === "overdue") return 0;
    if (!item.due_at) return 3;
    const dueTime = new Date(item.due_at).getTime();
    if (dueTime < urgencyReference) return 0;
    if (dueTime <= urgencyReference + 3 * 24 * 60 * 60 * 1000) return 1;
    return 2;
  };
  const outstandingItems = [...outstandingTasks, ...outstandingForms].sort((a, b) => {
    const rankDifference = urgencyRank(a) - urgencyRank(b);
    if (rankDifference !== 0) return rankDifference;
    const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
    return aDue - bDue;
  });
  const now = new Date();
  const currentYear = now.getFullYear().toString();
  const currentYearMonth = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  // Total collected = authoritative source (includes pre-date-tracking amounts).
  const revenueTotal = clientsForRevenue.reduce((sum, c) => sum + (c.amount_paid ?? 0), 0);
  // Amounts in the dated payments collection (recorded after date-tracking was added).
  const datedTotal = payments.reduce((sum, p) => sum + p.amount, 0);
  // Payments recorded before date-tracking existed — we treat them as this-year
  // since the practice is new and all prior collections happened in the current year.
  const legacyRevenue = Math.max(0, revenueTotal - datedTotal);
  const revenueMTD = payments
    .filter((p) => (p.paid_at ?? "").startsWith(currentYearMonth))
    .reduce((sum, p) => sum + p.amount, 0);
  const revenueYTD =
    legacyRevenue +
    payments
      .filter((p) => (p.paid_at ?? "").startsWith(currentYear))
      .reduce((sum, p) => sum + p.amount, 0);
  const expectedTotal = clientsForRevenue.reduce((sum, c) => sum + (c.package_value ?? 0), 0);
  const outstandingBalance = clientsForRevenue.reduce(
    (sum, c) => sum + Math.max(0, (c.package_value ?? 0) - (c.amount_paid ?? 0)),
    0
  );

  const referralCounts = new Map<string, number>();
  for (const c of clients) {
    const src = referralSources.find((r) => r.id === c.referral_source_id);
    const name = src?.name ?? "Unknown";
    referralCounts.set(name, (referralCounts.get(name) ?? 0) + 1);
  }

  return {
    totalClients: clients.length,
    activeClients: activeClients.length,
    activeClientRecords: activeClients,
    awaitingIntegration: awaitingIntegration.length,
    outstandingTasksCount: outstandingItems.length,
    outstandingFormsCount: outstandingForms.length,
    openTasksCount: outstandingTasks.length,
    overdueTasksCount: outstandingTasks.filter((task) => task.status === "overdue" || isPastDue(task)).length,
    pendingCheckInsCount: outstandingTasks.filter((task) => /check[ -]?in/i.test(task.title)).length,
    outstandingTasks: outstandingItems.slice(0, 8),
    unreadMessageCount: unreadMessages.totalUnread,
    unreadMessageThreads: unreadMessages.threads,
    upcomingSessions,
    revenueTotal,
    revenueMTD,
    revenueYTD,
    expectedTotal,
    outstandingBalance,
    referralBreakdown: Array.from(referralCounts.entries()).map(([name, count]) => ({ name, count })),
    clients,
  };
}

export async function getJourneyCompletionRate() {
  const clients = await getClients();
  const closed = clients.filter((c) => c.status === "journey_closed").length;
  const total = clients.length || 1;
  return Math.round((closed / total) * 100);
}

export async function getReportsSummary() {
  const [clients, clientsForRevenue, payments] = await Promise.all([
    getClients(), getClientsIncludingOnHold(), getPayments(),
  ]);
  const [milestonesByClient, sessionsByClient] = await Promise.all([
    Promise.all(clients.map((client) => getMilestones(client.id))),
    Promise.all(clients.map((client) => getSessions(client.id))),
  ]);
  const now = new Date();
  const currentYear = now.getFullYear().toString();
  const currentYearMonth = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const revenueTotal = clientsForRevenue.reduce((sum, client) => sum + (client.amount_paid ?? 0), 0);
  const datedTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const averagePayment = payments.length ? datedTotal / payments.length : 0;
  const legacyRevenue = Math.max(0, revenueTotal - datedTotal);
  const revenueMTD = payments.filter((payment) => payment.paid_at.startsWith(currentYearMonth)).reduce((sum, payment) => sum + payment.amount, 0);
  const revenueYTD = legacyRevenue + payments.filter((payment) => payment.paid_at.startsWith(currentYear)).reduce((sum, payment) => sum + payment.amount, 0);
  const expectedTotal = clientsForRevenue.reduce((sum, client) => sum + (client.package_value ?? 0), 0);
  const outstandingBalance = clientsForRevenue.reduce((sum, client) => sum + Math.max(0, (client.package_value ?? 0) - (client.amount_paid ?? 0)), 0);
  const monthKeys = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      name: date.toLocaleDateString("en-US", { month: "short" }),
      endAt: nextMonth.getTime(),
    };
  });
  const closedAtByClient = new Map(clients.map((client, index) => [
    client.id,
    milestonesByClient[index].find((milestone) => milestone.milestone_key === "journey_closed")?.completed_at,
  ]));
  const revenueByMonth = monthKeys.map((month) => ({
    key: month.key,
    name: month.name,
    value: payments.filter((payment) => payment.paid_at.startsWith(month.key)).reduce((sum, payment) => sum + payment.amount, 0),
    activeClients: clients.filter((client) => {
      const isCurrentlyActive = ACTIVE_STATUSES.includes(client.status);
      const hasHistoricalClosedJourney = client.status === "journey_closed";
      if ((!isCurrentlyActive && !hasHistoricalClosedJourney) || new Date(client.created_at).getTime() >= month.endAt) return false;
      const closedAt = closedAtByClient.get(client.id);
      return !closedAt || new Date(closedAt).getTime() >= month.endAt;
    }).length,
  }));
  const clientGrowth = monthKeys.map((month) => ({ name: month.name, value: clients.filter((client) => client.created_at.startsWith(month.key)).length }));
  const referralSources = await getReferralSources();
  const referralCounts = new Map<string, number>();
  for (const client of clients) {
    const source = referralSources.find((item) => item.id === client.referral_source_id);
    const name = source?.name ?? "Direct / unknown";
    referralCounts.set(name, (referralCounts.get(name) ?? 0) + 1);
  }
  const completedJourneys = clients.filter((client) => client.status === "journey_closed").length;
  const activeClients = clients.filter((client) => ACTIVE_STATUSES.includes(client.status)).length;
  const averageCompletionRate = milestonesByClient.length
    ? Math.round(milestonesByClient.reduce((total, milestones) => total + (milestones.length ? milestones.filter((milestone) => milestone.completed).length / milestones.length : 0), 0) / milestonesByClient.length * 100)
    : 0;
  const completionDurations = clients.flatMap((client, index) => {
    const closedAt = milestonesByClient[index].find((milestone) => milestone.milestone_key === "journey_closed")?.completed_at;
    if (!closedAt) return [];
    const duration = Math.floor((new Date(closedAt).getTime() - new Date(client.created_at).getTime()) / 86_400_000);
    return duration > 0 ? [duration] : [];
  });
  const completedJourneySessionCounts = clients.flatMap((client, index) => {
    if (client.status !== "journey_closed") return [];
    const closedAt = milestonesByClient[index].find((milestone) => milestone.milestone_key === "journey_closed")?.completed_at;
    const completedSessions = sessionsByClient[index].filter((session) => {
      if (session.status !== "completed") return false;
      return !closedAt || !session.scheduled_at || new Date(session.scheduled_at).getTime() <= new Date(closedAt).getTime();
    });
    return [completedSessions.length];
  });
  const sessionIntervalsInDays = sessionsByClient.flatMap((sessions) => {
    const datedSessions = sessions
      .filter((session) => session.status === "completed" && session.scheduled_at)
      .sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!));
    return datedSessions.slice(1).flatMap((session, index) => {
      const previous = datedSessions[index];
      const interval = (new Date(session.scheduled_at!).getTime() - new Date(previous.scheduled_at!).getTime()) / 86_400_000;
      return interval >= 0 ? [interval] : [];
    });
  });
  const clientNames = new Map(clientsForRevenue.map((client) => [client.id, client.full_name]));
  const outstandingPayments = clientsForRevenue.map((client) => ({
    clientId: client.id, client: client.full_name,
    amount: Math.max(0, (client.package_value ?? 0) - (client.amount_paid ?? 0)),
    dueDate: client.payment_due_date ?? null, status: "Outstanding" as const,
  })).filter((payment) => payment.amount > 0).sort((a, b) => b.amount - a.amount);
  const recentPayments = [...payments].sort((a, b) => b.paid_at.localeCompare(a.paid_at)).slice(0, 8).map((payment) => ({
    id: payment.id, clientId: payment.client_id, client: clientNames.get(payment.client_id) ?? "Unknown client",
    amount: payment.amount, date: payment.paid_at, method: payment.method, notes: payment.notes, status: "Paid" as const,
  }));
  return {
    totalClients: clients.length, activeClients,
    journeyCompletionRate: clients.length ? Math.round((completedJourneys / clients.length) * 100) : 0,
    revenueTotal, revenueMTD, revenueYTD, expectedTotal, outstandingBalance, averagePayment, revenueByMonth,
    revenuePayments: payments.map((payment) => ({ date: payment.paid_at, amount: payment.amount })), clientGrowth,
    referralBreakdown: Array.from(referralCounts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    journeyPerformance: {
      completed: completedJourneys, inProgress: activeClients, averageCompletionRate,
      averageDaysToCompletion: completionDurations.length ? Math.round(completionDurations.reduce((sum, days) => sum + days, 0) / completionDurations.length) : null,
      averageDaysBetweenSessions: sessionIntervalsInDays.length
        ? Math.round(sessionIntervalsInDays.reduce((sum, days) => sum + days, 0) / sessionIntervalsInDays.length)
        : null,
      averageSessionsPerJourney: completedJourneySessionCounts.length
        ? completedJourneySessionCounts.reduce((sum, count) => sum + count, 0) / completedJourneySessionCounts.length
        : null,
    },
    outstandingPayments, recentPayments, clients,
  };
}

export interface SearchResult {
  type: "client" | "transcript" | "session_note" | "theme" | "intention" | "action_item" | "insight";
  clientId: string;
  clientName: string;
  snippet: string;
  href: string;
}

// ---------------------------------------------------------------------------
// PROSPECTS — pre-client CRM records for introductory calls
// ---------------------------------------------------------------------------

// Keep prospect data on the shared mock-store singleton. Server actions and
// dynamic route modules can be evaluated by separate dev bundles; module-local
// arrays made a newly created prospect disappear before its detail page loaded.
const mockProspects = store.prospects;
const mockProspectCalls = store.prospectCalls;

async function allProspects(): Promise<Prospect[]> {
  const prospects = await listAll(mockProspects, "prospects");
  return prospects.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

/** Default prospect read — EXCLUDES anyone on hold. See getClients. */
export async function getProspects(): Promise<Prospect[]> {
  return (await allProspects()).filter((p) => !isOnHold(p));
}

/** Every prospect regardless of hold state. */
export async function getProspectsIncludingOnHold(): Promise<Prospect[]> {
  return allProspects();
}

/** Only prospects currently on hold, soonest follow-up first. */
export async function getOnHoldProspects(): Promise<Prospect[]> {
  return (await allProspects())
    .filter(isOnHold)
    .sort((a, b) => ((a.hold_follow_up_at ?? "") < (b.hold_follow_up_at ?? "") ? -1 : 1));
}

export async function getProspect(id: string): Promise<Prospect | undefined> {
  return findById(mockProspects, "prospects", id);
}

export async function addProspect(input: {
  full_name: string;
  email?: string;
  phone?: string;
  referral_source?: string;
}): Promise<Prospect> {
  const practitioner = await getPractitioner();
  const now = new Date().toISOString();
  const prospect: Prospect = {
    id: nextId("pro"),
    practitioner_id: practitioner.id,
    status: "new",
    created_at: now,
    updated_at: now,
    ...input,
  };
  return create(mockProspects, "prospects", prospect);
}

export async function updateProspect(
  id: string,
  patch: Partial<Omit<Prospect, "id" | "practitioner_id" | "created_at">>
): Promise<Prospect | undefined> {
  return patchById(mockProspects, "prospects", id, {
    ...patch,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteProspect(id: string): Promise<void> {
  await removeById(mockProspects, "prospects", id);
  await removeWhere(mockProspectCalls, "prospectCalls", "prospect_id", id);
}

export async function getProspectCalls(prospectId: string): Promise<ProspectCall[]> {
  const calls = await listWhere(mockProspectCalls, "prospectCalls", "prospect_id", prospectId);
  return calls.sort((a, b) => (a.scheduled_at < b.scheduled_at ? -1 : 1));
}

export async function getProspectCall(callId: string): Promise<ProspectCall | undefined> {
  return findById(mockProspectCalls, "prospectCalls", callId);
}

export async function getAllProspectCalls(): Promise<ProspectCall[]> {
  const all = await listAll(mockProspectCalls, "prospectCalls");
  return all.sort((a, b) => (a.scheduled_at < b.scheduled_at ? -1 : 1));
}

export async function addProspectCall(input: {
  prospect_id: string;
  client_id?: string;
  prospect_name: string;
  call_type: ProspectCall["call_type"];
  scheduled_at: string;
  duration_minutes?: number;
  notes?: string;
}): Promise<ProspectCall> {
  const call: ProspectCall = {
    id: nextId("pcall"),
    status: "scheduled",
    created_at: new Date().toISOString(),
    ...input,
  };
  await create(mockProspectCalls, "prospectCalls", call);
  // Update prospect status to reflect a scheduled call. Skipped for hold
  // reminders — putting someone on hold shouldn't advance their status, and
  // client holds have no prospect record at all.
  if (input.call_type !== "hold_follow_up" && input.prospect_id) {
    const prospect = await getProspect(input.prospect_id);
    if (prospect && prospect.status === "new") {
      await updateProspect(input.prospect_id, { status: "intro_scheduled" });
    }
  }
  return call;
}

// ---------------------------------------------------------------------------
// HOLDS
// ---------------------------------------------------------------------------

function holdFollowUpDefault(days = DEFAULT_HOLD_DAYS): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  // Land the reminder at 9am local rather than the current time of day.
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

/**
 * Park a client. Creates the follow-up reminder that will surface on the
 * calendar, and records its id so releasing the hold can clean it up.
 * The client's journey status and phase are left untouched.
 */
export async function putClientOnHold(
  clientId: string,
  opts: { followUpAt?: string; reason?: string } = {}
): Promise<Client | undefined> {
  const client = await getClient(clientId);
  if (!client) return undefined;
  if (isOnHold(client)) return client;

  const followUpAt = opts.followUpAt ?? holdFollowUpDefault();
  const reminder = await addProspectCall({
    prospect_id: "",
    client_id: clientId,
    prospect_name: client.full_name,
    call_type: "hold_follow_up",
    scheduled_at: followUpAt,
    duration_minutes: 30,
    notes: opts.reason ? `On hold — ${opts.reason}` : "Follow up on hold",
  });

  return updateClient(clientId, {
    on_hold_at: new Date().toISOString(),
    hold_follow_up_at: followUpAt,
    hold_reason: opts.reason,
    hold_reminder_call_id: reminder.id,
  });
}

/** Bring a client back into active views and drop the follow-up reminder. */
export async function releaseClientHold(clientId: string): Promise<Client | undefined> {
  const client = await getClient(clientId);
  if (!client) return undefined;
  if (client.hold_reminder_call_id) {
    await deleteProspectCall(client.hold_reminder_call_id);
  }
  // Mock patch helpers skip undefined, so clear with empty strings — every
  // hold check treats a falsy on_hold_at as "not on hold".
  return updateClient(clientId, {
    on_hold_at: "",
    hold_follow_up_at: "",
    hold_reason: "",
    hold_reminder_call_id: "",
  });
}

/** Park a prospect. Mirror of putClientOnHold. */
export async function putProspectOnHold(
  prospectId: string,
  opts: { followUpAt?: string; reason?: string } = {}
): Promise<Prospect | undefined> {
  const prospect = await getProspect(prospectId);
  if (!prospect) return undefined;
  if (isOnHold(prospect)) return prospect;

  const followUpAt = opts.followUpAt ?? holdFollowUpDefault();
  const reminder = await addProspectCall({
    prospect_id: prospectId,
    prospect_name: prospect.full_name,
    call_type: "hold_follow_up",
    scheduled_at: followUpAt,
    duration_minutes: 30,
    notes: opts.reason ? `On hold — ${opts.reason}` : "Follow up on hold",
  });

  return updateProspect(prospectId, {
    on_hold_at: new Date().toISOString(),
    hold_follow_up_at: followUpAt,
    hold_reason: opts.reason,
    hold_reminder_call_id: reminder.id,
  });
}

/** Bring a prospect back into active views and drop the follow-up reminder. */
export async function releaseProspectHold(prospectId: string): Promise<Prospect | undefined> {
  const prospect = await getProspect(prospectId);
  if (!prospect) return undefined;
  if (prospect.hold_reminder_call_id) {
    await deleteProspectCall(prospect.hold_reminder_call_id);
  }
  return updateProspect(prospectId, {
    on_hold_at: "",
    hold_follow_up_at: "",
    hold_reason: "",
    hold_reminder_call_id: "",
  });
}

export async function updateProspectCall(
  callId: string,
  patch: Partial<
    Pick<
      ProspectCall,
      "status" | "notes" | "scheduled_at" | "duration_minutes" | "google_event_id" | "google_synced_at"
    >
  >
): Promise<ProspectCall | undefined> {
  return patchById<ProspectCall>(mockProspectCalls, "prospectCalls", callId, patch as Partial<ProspectCall>);
}

// See clearSessionGoogleEvent — same rule for prospect calls / hold reminders.
export async function clearProspectCallGoogleEvent(callId: string): Promise<void> {
  await clearFields(mockProspectCalls, "prospectCalls", callId, ["google_event_id"]);
  await patchById<ProspectCall>(mockProspectCalls, "prospectCalls", callId, {
    google_synced_at: new Date().toISOString(),
  });
}

export async function deleteProspectCall(callId: string): Promise<void> {
  await removeById(mockProspectCalls, "prospectCalls", callId);
}

// ---------------------------------------------------------------------------
// PROSPECT TRANSCRIPTS — additional call transcripts beyond the original
// intro-call transcript stored inline on Prospect.fathom_transcript. Lets a
// practitioner record a second (or third) call before converting.
// ---------------------------------------------------------------------------

const mockProspectTranscripts = store.prospectTranscripts;

export async function getProspectTranscripts(prospectId: string): Promise<ProspectTranscript[]> {
  const list = await listWhere(mockProspectTranscripts, "prospectTranscripts", "prospect_id", prospectId);
  return list.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
}

export async function addProspectTranscript(input: {
  prospect_id: string;
  label: string;
  raw_text: string;
}): Promise<ProspectTranscript> {
  const now = new Date().toISOString();
  const t: ProspectTranscript = {
    id: nextId("ptx"),
    created_at: now,
    updated_at: now,
    ...input,
  };
  return create(mockProspectTranscripts, "prospectTranscripts", t);
}

export async function updateProspectTranscript(
  id: string,
  patch: Partial<Pick<ProspectTranscript, "label" | "raw_text" | "ai_summary_content" | "ai_summary_model" | "ai_summary_generated_at">>
): Promise<ProspectTranscript | undefined> {
  return patchById<ProspectTranscript>(mockProspectTranscripts, "prospectTranscripts", id, {
    ...patch,
    updated_at: new Date().toISOString(),
  } as Partial<ProspectTranscript>);
}

export async function deleteProspectTranscript(id: string): Promise<void> {
  await removeById(mockProspectTranscripts, "prospectTranscripts", id);
}

export async function search(query: string): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: SearchResult[] = [];

  // Search intentionally spans held clients too — hiding someone from the
  // working views shouldn't make them unfindable when you go looking by name.
  // Held results are labelled so it's obvious why they aren't in the list.
  const [clients, transcripts, sessionNotes, memory] = await Promise.all([
    getClientsIncludingOnHold(),
    listAll(store.transcripts, "transcripts"),
    listAll(store.sessionNotes, "sessionNotes"),
    listAll(store.memory, "memory"),
  ]);
  const clientName = (id: string) => clients.find((c) => c.id === id)?.full_name ?? "Unknown";

  for (const c of clients) {
    if (c.full_name.toLowerCase().includes(q) || (c.notes ?? "").toLowerCase().includes(q)) {
      results.push({
        type: "client",
        clientId: c.id,
        clientName: c.full_name,
        snippet: isOnHold(c) ? `${c.full_name} · On hold` : c.full_name,
        href: `/clients/${c.id}`,
      });
    }
  }
  for (const t of transcripts) {
    if ((t.raw_text ?? "").toLowerCase().includes(q)) {
      results.push({
        type: "transcript",
        clientId: t.client_id,
        clientName: clientName(t.client_id),
        snippet: (t.raw_text ?? "").slice(0, 140) + "...",
        href: `/clients/${t.client_id}?tab=sessions`,
      });
    }
  }
  for (const n of sessionNotes) {
    if (n.content.toLowerCase().includes(q)) {
      results.push({
        type: "session_note",
        clientId: n.client_id,
        clientName: clientName(n.client_id),
        snippet: n.content,
        href: `/clients/${n.client_id}?tab=sessions`,
      });
    }
  }
  for (const m of memory) {
    if (m.content.toLowerCase().includes(q)) {
      const typeMap: Record<string, SearchResult["type"]> = {
        theme: "theme",
        intention: "intention",
        action_item: "action_item",
        insight: "insight",
      };
      results.push({
        type: typeMap[m.item_type] ?? "insight",
        clientId: m.client_id,
        clientName: clientName(m.client_id),
        snippet: m.content,
        href: `/clients/${m.client_id}?tab=journey`,
      });
    }
  }
  return results.slice(0, 50);
}

// ---------------------------------------------------------------------------
// GOOGLE CALENDAR SYNC — settings/token singleton, plus mirrored "busy"
// events pulled from the practitioner's primary calendar (see
// lib/googleCalendarSync.ts for the actual sync logic; this is just storage).
// ---------------------------------------------------------------------------

const mockGoogleCalendarSettings: GoogleCalendarSettings = { connected: false };

export async function getGoogleCalendarSettings(): Promise<GoogleCalendarSettings> {
  if (isFirebaseConfigured) {
    const existing = await getDocById<GoogleCalendarSettings>("meta", "googleCalendar");
    return existing ?? { connected: false };
  }
  return mockGoogleCalendarSettings;
}

export async function saveGoogleCalendarSettings(
  patch: Partial<GoogleCalendarSettings>
): Promise<GoogleCalendarSettings> {
  const current = await getGoogleCalendarSettings();
  const updated: GoogleCalendarSettings = { ...current, ...patch };
  if (isFirebaseConfigured) {
    return setSingleton<GoogleCalendarSettings & Record<string, unknown>>(
      "meta",
      "googleCalendar",
      updated as GoogleCalendarSettings & Record<string, unknown>
    );
  }
  Object.assign(mockGoogleCalendarSettings, updated);
  return mockGoogleCalendarSettings;
}

export async function clearGoogleCalendarSettings(): Promise<void> {
  const cleared: GoogleCalendarSettings = { connected: false };
  if (isFirebaseConfigured) {
    const { getDb } = await import("@/lib/firebaseAdmin");
    await getDb()!.collection("meta").doc("googleCalendar").set(cleared as unknown as Record<string, unknown>);
    return;
  }
  for (const k of Object.keys(mockGoogleCalendarSettings)) {
    delete (mockGoogleCalendarSettings as unknown as Record<string, unknown>)[k];
  }
  mockGoogleCalendarSettings.connected = false;
}

const mockExternalEvents: ExternalCalendarEvent[] = [];

export async function getExternalCalendarEvents(): Promise<ExternalCalendarEvent[]> {
  const all = await listAll(mockExternalEvents, "externalCalendarEvents");
  return all
    .filter((e) => e.status !== "cancelled")
    .sort((a, b) => (a.start_at < b.start_at ? -1 : 1));
}

// Insert-or-update by google_event_id (Firestore doc id = our internal id,
// not Google's, so we look up by the google_event_id field first).
export async function upsertExternalCalendarEvent(
  event: Omit<ExternalCalendarEvent, "id">
): Promise<ExternalCalendarEvent> {
  const matches = await listWhere(
    mockExternalEvents,
    "externalCalendarEvents",
    "google_event_id",
    event.google_event_id
  );
  const existing = matches[0];
  if (existing) {
    const updated = await patchById<ExternalCalendarEvent>(
      mockExternalEvents,
      "externalCalendarEvents",
      existing.id,
      event as Partial<ExternalCalendarEvent>
    );
    return updated!;
  }
  const rec: ExternalCalendarEvent = { id: nextId("extev"), ...event };
  return create(mockExternalEvents, "externalCalendarEvents", rec);
}

export async function deleteExternalCalendarEventByGoogleId(googleEventId: string): Promise<void> {
  const matches = await listWhere(
    mockExternalEvents,
    "externalCalendarEvents",
    "google_event_id",
    googleEventId
  );
  if (matches[0]) await removeById(mockExternalEvents, "externalCalendarEvents", matches[0].id);
}
