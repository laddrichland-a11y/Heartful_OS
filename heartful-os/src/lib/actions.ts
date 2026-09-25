"use server";

import { revalidatePath } from "next/cache";
import { forbidden, redirect, unauthorized } from "next/navigation";
import { cookies } from "next/headers";
import * as data from "@/lib/data";
import { SessionNoteField, ClientStatus, JourneyPhase, DocumentType, SessionType, type PaymentMethod } from "@/lib/types";
import { canSetJourneyStatus, JOURNEY_PROGRESS_COMPLETED_MILESTONES } from "@/lib/utils";
import { runAiJson } from "@/lib/ai/generate";
import { buildAiConversationPrompt, buildProspectIntroSummaryPrompt } from "@/lib/ai/prompts";
import { mockAiConversationReply } from "@/lib/ai/mocks";
import {
  AuthorizationError,
  getAuthenticatedPractitioner,
  requireClientAccess as authorizeClientAccess,
  requirePractitioner as authorizePractitioner,
  requireProspectAccess as authorizeProspectAccess,
} from "@/lib/serverAuth";

const AUTH_COOKIE = "heartful_auth";
const PORTAL_UNLOCK_PREFIX = "portal_unlock_";
// Must match middleware.ts, which writes this on every deep-link hit.
const PORTAL_CLIENT_COOKIE = "heartful_portal_client";
const ONE_MONTH_SECONDS = 60 * 60 * 24 * 30;

function emailLooksValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Practitioner login. There's no account system — the configured password
// itself is the session secret, stored in an httpOnly cookie that
// middleware.ts compares against PRACTITIONER_PASSWORD on every request.
export async function loginAction(password: string): Promise<{ ok: boolean }> {
  const expected = process.env.PRACTITIONER_PASSWORD;
  if (!expected || password !== expected) return { ok: false };
  (await cookies()).set(AUTH_COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_MONTH_SECONDS,
  });
  return { ok: true };
}

export async function logoutAction() {
  (await cookies()).delete(AUTH_COOKIE);
  redirect("/login");
}

async function isPractitionerAuthed(): Promise<boolean> {
  return Boolean(await getAuthenticatedPractitioner());
}

function interruptUnauthorizedAction(error: unknown): never {
  if (error instanceof AuthorizationError) {
    if (error.status === 401) unauthorized();
    forbidden();
  }
  throw error;
}

async function requirePractitioner() {
  try {
    return await authorizePractitioner();
  } catch (error) {
    interruptUnauthorizedAction(error);
  }
}

async function requireClientAccess(clientId: string, options: { allowPortal?: boolean } = {}) {
  try {
    return await authorizeClientAccess(clientId, options);
  } catch (error) {
    interruptUnauthorizedAction(error);
  }
}

async function requireProspectAccess(prospectId: string) {
  try {
    return await authorizeProspectAccess(prospectId);
  } catch (error) {
    interruptUnauthorizedAction(error);
  }
}

// Sets the per-client unlock cookie. Deliberately a *session* cookie (no
// maxAge) — closing the browser ends it, so the client has to log in again
// next time, per the practice's "log in each time" requirement. The cookie
// value is the client's password hash, compared directly against the
// record on each request (same simple-secret-as-session-token pattern used
// for the practitioner login above).
async function setPortalUnlockCookie(clientId: string, passwordHash: string) {
  (await cookies()).set(`${PORTAL_UNLOCK_PREFIX}${clientId}`, passwordHash, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // no maxAge/expires => session cookie, cleared when the browser closes.
  });
}

// First-time setup: the client picks their own email + password the first
// time they open their private portal link. Only allowed while no account
// exists yet on the client record — afterward they must log in instead.
export async function createPortalAccountAction(
  clientId: string,
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const client = await data.getClient(clientId);
  if (!client) return { ok: false, error: "Client not found." };
  if (client.portal_password_hash) return { ok: false, error: "An account already exists. Please log in." };
  if (!emailLooksValid(email)) return { ok: false, error: "Enter a valid email address." };
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
  if (!client.email || client.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
    return { ok: false, error: "Use the email address your practitioner has on file." };
  }

  await data.createPortalAccount(clientId, email, password);
  const updated = await data.getClient(clientId);
  if (updated?.portal_password_hash) await setPortalUnlockCookie(clientId, updated.portal_password_hash);
  return { ok: true };
}

// Logs an existing client in with their email + password.
export async function portalLoginAction(
  clientId: string,
  email: string,
  password: string
): Promise<{ ok: boolean }> {
  const { ok, passwordHash } = await data.verifyPortalLogin(clientId, email, password);
  if (!ok || !passwordHash) return { ok: false };
  await setPortalUnlockCookie(clientId, passwordHash);
  return { ok: true };
}

// Called by the portal's dead-end screen, when ?client=<id> resolves to no
// client record. Two jobs:
//
// 1. Drop the remembered client id. Middleware rebuilds /portal?client=<id>
//    from that cookie for a year, so without this a client whose id went bad
//    would be pinned to the same dead link on every single visit — strictly
//    worse than the /login dead end this whole mechanism replaced.
// 2. Report who to contact. This app cannot send email (every "email" feature
//    is a mailto: the practitioner sends by hand — see emailTemplates.ts), so
//    a self-service "resend my link" is not possible; the best we can do is
//    make reaching the practitioner one tap.
export async function reportDeadPortalLinkAction(): Promise<{
  isPractitioner: boolean;
  practitionerName?: string;
  practitionerEmail?: string;
}> {
  (await cookies()).delete(PORTAL_CLIENT_COOKIE);
  const isPractitioner = await isPractitionerAuthed();
  const practitioner = await data.getPractitioner();
  return {
    isPractitioner,
    practitionerName: practitioner?.full_name,
    practitionerEmail: practitioner?.email,
  };
}

// Practitioner-triggered reset for a client who forgot their password —
// clears the account so the client sees the "create your account" form
// again next time they open their portal link.
export async function resetPortalPasswordAction(clientId: string) {
  await requireClientAccess(clientId);
  await data.resetPortalPassword(clientId);
  (await cookies()).delete(`${PORTAL_UNLOCK_PREFIX}${clientId}`);
  revalidatePath(`/clients/${clientId}`);
}

/** Updates only the contact fields the client record already supports. */
export async function updatePortalProfileAction(
  clientId: string,
  input: { full_name: string; email?: string; phone?: string }
): Promise<{ ok: boolean; error?: string }> {
  const client = await data.getClient(clientId);
  if (!client) return { ok: false, error: "Client not found." };
  try {
    await requireClientAccess(clientId, { allowPortal: true });
  } catch {
    return { ok: false, error: "Your portal session has ended. Please sign in again." };
  }

  const fullName = input.full_name.trim();
  const email = input.email?.trim() ?? "";
  if (!fullName) return { ok: false, error: "Enter your full name." };
  if (email && !emailLooksValid(email)) return { ok: false, error: "Enter a valid email address." };

  await data.updateClient(clientId, {
    full_name: fullName,
    email: email || undefined,
    phone: input.phone?.trim() || undefined,
  });
  revalidatePath("/portal");
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

/** Ends the current client portal session without affecting practitioner auth. */
export async function portalLogoutAction(clientId: string) {
  await requireClientAccess(clientId, { allowPortal: true });
  const cookieStore = await cookies();
  cookieStore.delete(`${PORTAL_UNLOCK_PREFIX}${clientId}`);
  cookieStore.delete(PORTAL_CLIENT_COOKIE);
  redirect("/portal");
}

async function requireDocumentForClient(clientId: string, documentId: string) {
  const document = await data.getDocument(documentId);
  if (!document || document.client_id !== clientId) forbidden();
  return document;
}

async function requireSessionForClient(clientId: string, sessionId: string) {
  const session = await data.getSession(sessionId);
  if (!session || session.client_id !== clientId) forbidden();
  return session;
}

async function requireTaskForClient(clientId: string, taskId: string) {
  const task = await data.getTask(taskId);
  if (!task || task.client_id !== clientId) forbidden();
  return task;
}

// ---------------------------------------------------------------------------
// Server Actions — thin mutation layer called directly from client
// components. Each wraps the mock data layer in lib/data.ts and revalidates
// the relevant client page. When wiring real Supabase, only lib/data.ts
// needs to change — these signatures stay the same.
// ---------------------------------------------------------------------------

export async function uploadDocumentAction(documentId: string, clientId: string, fileName: string, notes?: string) {
  await requireClientAccess(clientId);
  await requireDocumentForClient(clientId, documentId);
  await data.uploadDocumentVersion(documentId, fileName, notes);
  revalidatePath(`/clients/${clientId}`);
}

export async function createClientAction(input: {
  full_name: string;
  email?: string;
  phone?: string;
  referral_source_id?: string;
  package_name?: string;
  package_value?: number;
}) {
  await requirePractitioner();
  const client = await data.createClient(input);
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/copilot");
  redirect(`/clients/${client.id}?intro=1`);
}

export async function deleteAiSummaryAction(summaryId: string, clientId: string) {
  await requireClientAccess(clientId);
  if (!(await data.getAiSummaries(clientId)).some((summary) => summary.id === summaryId)) forbidden();
  await data.deleteAiSummary(summaryId);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/sessions`);
  revalidatePath(`/clients/${clientId}/journey-day`);
}

export async function updateAiSummaryAction(summaryId: string, clientId: string, content: Record<string, unknown>) {
  await requireClientAccess(clientId);
  if (!(await data.getAiSummaries(clientId)).some((summary) => summary.id === summaryId)) forbidden();
  const updated = await data.updateAiSummary(summaryId, content);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/sessions`);
  revalidatePath(`/clients/${clientId}/journey-day`);
  return updated;
}

export async function deleteGrowthActionPlanAction(clientId: string) {
  await requireClientAccess(clientId);
  await data.deleteGrowthActionPlan(clientId);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/integration-2`);
}

export async function recordPaymentAction(
  clientId: string,
  amount: number,
  method?: string,
  notes?: string
) {
  const { client } = await requireClientAccess(clientId);
  const newTotal = (client.amount_paid ?? 0) + amount;
  // Update running total on client record AND create a dated payment record
  // so MTD/YTD breakdowns on the dashboard are accurate going forward.
  await Promise.all([
    data.updateClient(clientId, { amount_paid: newTotal }),
    data.addPayment(clientId, amount, method, notes),
  ]);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/reports/revenue");
}

export async function updatePaymentDueDateAction(clientId: string, dueDate?: string) {
  await requireClientAccess(clientId);
  await data.updateClient(clientId, { payment_due_date: dueDate || "" });
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/reports/revenue");
}

export async function updateOutstandingPaymentAction(clientId: string, outstanding: number) {
  const { client } = await requireClientAccess(clientId);
  await data.updateClient(clientId, {
    package_value: (client.amount_paid ?? 0) + Math.max(0, outstanding),
  });
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/reports/revenue");
}

export async function updatePaymentAction(
  paymentId: string,
  input: { amount: number; paidAt: string; method?: string; notes?: string }
) {
  await requirePractitioner();
  const payment = (await data.getPayments()).find((item) => item.id === paymentId);
  if (!payment) throw new Error("Payment not found");
  if (!input.amount || input.amount <= 0) throw new Error("Payment amount must be greater than zero");
  const client = await data.getClient(payment.client_id);
  if (!client) throw new Error("Client not found");
  await requireClientAccess(payment.client_id);

  await Promise.all([
    data.updatePayment(paymentId, {
      amount: input.amount,
      paid_at: input.paidAt,
      method: input.method,
      notes: input.notes,
    }),
    data.updateClient(payment.client_id, {
      amount_paid: Math.max(0, (client.amount_paid ?? 0) + input.amount - payment.amount),
    }),
  ]);
  revalidatePath(`/clients/${payment.client_id}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/reports/revenue");
}

export async function deleteClientAction(clientId: string) {
  await requireClientAccess(clientId);
  await data.deleteClient(clientId);
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/copilot");
  redirect("/clients");
}

export async function addClientDocumentAction(
  clientId: string,
  documentType: DocumentType,
  fileName?: string,
  title?: string
) {
  await requireClientAccess(clientId);
  const filenameTitle = fileName?.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "").trim();
  const documentTitle = title?.trim() || filenameTitle || "Other Document";
  const doc = await data.addClientDocument(clientId, documentType, documentTitle);
  if (fileName) {
    await data.uploadDocumentVersion(doc.id, fileName);
  }
  revalidatePath(`/clients/${clientId}`);
  return { id: doc.id };
}

export async function renameClientDocumentAction(documentId: string, clientId: string, title: string) {
  await requireClientAccess(clientId);
  const document = await requireDocumentForClient(clientId, documentId);

  const filenameTitle = document.versions[0]?.file_name?.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "").trim();
  const documentTitle = title.trim() || filenameTitle || "Other Document";
  const updated = await data.renameClientDocument(documentId, documentTitle);
  revalidatePath(`/clients/${clientId}`);
  return updated;
}

export async function deleteClientDocumentAction(documentId: string, clientId: string) {
  await requireClientAccess(clientId);
  await requireDocumentForClient(clientId, documentId);

  await data.deleteClientDocument(documentId);
  revalidatePath(`/clients/${clientId}`);
}

const JOURNEY_PROGRESS_MILESTONES = [
  "intake_complete",
  "preparation_complete",
  "journey_complete",
  "check_in_12hr_complete",
  "integration_1_complete",
  "integration_2_complete",
  "growth_action_plan_complete",
  "journey_closed",
] as const;

export async function updateClientStatusAction(clientId: string, status: ClientStatus, phase: JourneyPhase) {
  await requireClientAccess(clientId);
  const completedCount = JOURNEY_PROGRESS_COMPLETED_MILESTONES[status];
  if (completedCount !== undefined) {
    const milestones = await data.getMilestones(clientId);
    if (!canSetJourneyStatus(milestones, status)) {
      throw new Error("Complete the next journey stage before advancing this status.");
    }
    for (const [index, milestoneKey] of JOURNEY_PROGRESS_MILESTONES.entries()) {
      if (index < completedCount) {
        await data.completeMilestone(clientId, milestoneKey);
      } else {
        await data.uncompleteMilestone(clientId, milestoneKey);
      }
    }
  }
  await data.updateClient(clientId, { status, current_phase: phase });
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/dashboard");
}

export async function updatePractitionerAction(patch: {
  full_name?: string;
  practice_name?: string;
  email?: string;
  phone?: string;
  title?: string;
  venmo_handle?: string;
  payment_methods?: PaymentMethod[];
}) {
  await requirePractitioner();
  await data.updatePractitioner(patch);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
}

// Puts a form into "in_progress" (creating an empty submission if needed) so
// both practitioner and client enter live co-editing mode simultaneously.
export async function startLiveSessionAction(clientId: string, documentId: string, templateId: string) {
  await requireClientAccess(clientId);
  await requireDocumentForClient(clientId, documentId);
  await data.saveFormSubmission({ clientId, documentId, templateId, answers: {}, status: "in_progress" });
  revalidatePath(`/clients/${clientId}/forms/${documentId}`);
  revalidatePath("/portal");
}

// Ends a live session by saving current answers as "draft" — work is preserved
// but live syncing stops. Either side can restart with startLiveSessionAction.
export async function endLiveSessionAction(clientId: string, documentId: string, templateId: string) {
  await requireClientAccess(clientId);
  await requireDocumentForClient(clientId, documentId);
  await data.saveFormSubmission({ clientId, documentId, templateId, answers: {}, status: "draft" });
  revalidatePath(`/clients/${clientId}/forms/${documentId}`);
  revalidatePath("/portal");
}

export async function createReferralSourceAction(name: string, category?: string) {
  await requirePractitioner();
  const src = await data.createReferralSource(name.trim(), category?.trim());
  revalidatePath("/clients");
  revalidatePath("/settings");
  return src;
}

export async function deleteReferralSourceAction(id: string) {
  await requirePractitioner();
  await data.deleteReferralSource(id);
  revalidatePath("/clients");
  revalidatePath("/settings");
}

export async function updateClientNotesAction(clientId: string, notes: string) {
  await requireClientAccess(clientId);
  await data.updateClient(clientId, { notes });
  revalidatePath(`/clients/${clientId}`);
}

export async function addClientQuickNoteAction(clientId: string, content: string) {
  await requireClientAccess(clientId);
  const note = content.trim();
  if (!note) throw new Error("A note cannot be empty.");

  const [created] = await data.addMemoryItems(clientId, [{ item_type: "note", content: note }]);
  revalidatePath(`/clients/${clientId}`);
  return created;
}

export async function updateClientProfileAction(clientId: string, patch: Record<string, string>) {
  await requireClientAccess(clientId);
  await data.updateClient(clientId, patch);
  revalidatePath(`/clients/${clientId}`);
}

/** Stores a compact client portrait. The UI resizes images before sending them. */
export async function updateClientAvatarAction(clientId: string, avatarUrl: string) {
  await requireClientAccess(clientId);
  const value = avatarUrl.trim();
  if (!value.startsWith("data:image/") || value.length > 500_000) {
    throw new Error("Choose a smaller JPG, PNG, or WebP image.");
  }

  await data.updateClient(clientId, { avatar_url: value });
  revalidatePath("/dashboard");
  revalidatePath("/clients");
  revalidatePath("/copilot");
  revalidatePath(`/clients/${clientId}`);
}

export async function savePreparationPlanAction(clientId: string, patch: Record<string, string>) {
  await requireClientAccess(clientId);
  await data.upsertPreparationPlan(clientId, patch);
  revalidatePath(`/clients/${clientId}/preparation`);
  revalidatePath(`/clients/${clientId}`);
}

export async function addTranscriptAction(clientId: string, text: string, sessionId?: string) {
  await requireClientAccess(clientId);
  if (sessionId) await requireSessionForClient(clientId, sessionId);
  const t = await data.addTranscript(clientId, text, sessionId);
  return t;
}

export async function updateSessionManualNotesAction(sessionId: string, clientId: string, manualNotes: string) {
  await requireClientAccess(clientId);
  await requireSessionForClient(clientId, sessionId);
  await data.setSessionManualNotes(sessionId, manualNotes);
  revalidatePath(`/clients/${clientId}/journey-day`);
  revalidatePath(`/clients/${clientId}/sessions/${sessionId}`);
}

export async function updateSessionTranscriptAction(sessionId: string, clientId: string, transcript: string) {
  await requireClientAccess(clientId);
  await requireSessionForClient(clientId, sessionId);
  await data.setSessionTranscript(sessionId, transcript);
  revalidatePath(`/clients/${clientId}/journey-day`);
  revalidatePath(`/clients/${clientId}/sessions/${sessionId}`);
}

// Returns null if Cloud Storage isn't configured yet — the UI should show a
// setup hint rather than a generic upload failure in that case.
export async function createRecordingUploadUrlAction(
  clientId: string,
  sessionId: string,
  fileName: string,
  contentType: string
) {
  await requireClientAccess(clientId);
  await requireSessionForClient(clientId, sessionId);
  return data.createRecordingUploadUrl(clientId, sessionId, fileName, contentType);
}

export async function addRecordingAction(
  clientId: string,
  sessionId: string,
  fileName: string,
  storagePath: string,
  sizeBytes?: number
) {
  await requireClientAccess(clientId);
  await requireSessionForClient(clientId, sessionId);
  const recording = await data.addRecording(clientId, sessionId, fileName, storagePath, sizeBytes);
  revalidatePath(`/clients/${clientId}/journey-day`);
  revalidatePath(`/clients/${clientId}/sessions/${sessionId}`);
  return recording;
}

export async function getRecordingDownloadUrlAction(storagePath: string) {
  await requirePractitioner();
  return data.getRecordingDownloadUrl(storagePath);
}

export async function deleteRecordingAction(recordingId: string, clientId: string, sessionId: string) {
  await requireClientAccess(clientId);
  await requireSessionForClient(clientId, sessionId);
  if (!(await data.getRecordings(clientId, sessionId)).some((recording) => recording.id === recordingId)) forbidden();
  await data.deleteRecording(recordingId);
  revalidatePath(`/clients/${clientId}/journey-day`);
  revalidatePath(`/clients/${clientId}/sessions/${sessionId}`);
}

export async function setJourneyMarkerAction(
  sessionId: string,
  clientId: string,
  marker: "started" | "ended" | "booster",
  on: boolean,
  currentManualNotes?: string,
  timeZone?: string
) {
  await requireClientAccess(clientId);
  await requireSessionForClient(clientId, sessionId);
  const session = await data.setJourneyMarker(sessionId, marker, !on, currentManualNotes, timeZone);
  revalidatePath(`/clients/${clientId}/journey-day`);
  revalidatePath(`/clients/${clientId}/sessions/${sessionId}`);
  revalidatePath(`/clients/${clientId}`);
  return session;
}

// Corrects a marker's timestamp after the fact (e.g. forgot to toggle
// Journey Begin until a few minutes in) without re-triggering the notes
// line or touching the milestone's on/off state.
export async function updateJourneyMarkerTimeAction(
  sessionId: string,
  clientId: string,
  marker: "started" | "ended" | "booster",
  isoTimestamp: string
) {
  await requireClientAccess(clientId);
  await requireSessionForClient(clientId, sessionId);
  const session = await data.setJourneyMarkerTime(sessionId, marker, isoTimestamp);
  revalidatePath(`/clients/${clientId}/journey-day`);
  revalidatePath(`/clients/${clientId}/sessions/${sessionId}`);
  revalidatePath(`/clients/${clientId}`);
  return session;
}

export async function updateInitialDoseAmountAction(sessionId: string, clientId: string, amount: string) {
  await requireClientAccess(clientId);
  await requireSessionForClient(clientId, sessionId);
  const session = await data.setInitialDoseAmount(sessionId, amount);
  revalidatePath(`/clients/${clientId}/journey-day`);
  revalidatePath(`/clients/${clientId}/sessions/${sessionId}`);
  return session;
}

export async function updateBoosterDoseAmountAction(sessionId: string, clientId: string, amount: string) {
  await requireClientAccess(clientId);
  await requireSessionForClient(clientId, sessionId);
  const session = await data.setBoosterDoseAmount(sessionId, amount);
  revalidatePath(`/clients/${clientId}/journey-day`);
  revalidatePath(`/clients/${clientId}/sessions/${sessionId}`);
  return session;
}

export async function addSessionNoteAction(
  sessionId: string,
  clientId: string,
  fieldType: SessionNoteField,
  content: string,
  elapsedMinutes?: number
) {
  await requireClientAccess(clientId);
  await requireSessionForClient(clientId, sessionId);
  await data.addSessionNote(sessionId, clientId, fieldType, content, elapsedMinutes);
  revalidatePath(`/clients/${clientId}/journey-day`);
}

export async function addSessionAction(input: {
  clientId: string;
  sessionType: SessionType;
  scheduledAt: string;
  durationMinutes?: number;
  location?: string;
}) {
  await requireClientAccess(input.clientId);
  const session = await data.addSession({
    client_id: input.clientId,
    session_type: input.sessionType,
    scheduled_at: input.scheduledAt,
    duration_minutes: input.durationMinutes,
    location: input.location,
  });
  syncSessionToGoogleInBackground(session.id);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/copilot");
  revalidatePath(`/clients/${input.clientId}`);
  return session;
}

export async function updateSessionAction(
  sessionId: string,
  clientId: string,
  patch: {
    sessionType?: SessionType;
    scheduledAt?: string;
    durationMinutes?: number;
    location?: string;
    status?: "scheduled" | "completed" | "cancelled" | "no_show";
  }
) {
  await requireClientAccess(clientId);
  await requireSessionForClient(clientId, sessionId);
  await data.updateSession(sessionId, {
    session_type: patch.sessionType,
    scheduled_at: patch.scheduledAt,
    duration_minutes: patch.durationMinutes,
    location: patch.location,
    status: patch.status,
  });
  syncSessionToGoogleInBackground(sessionId);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/copilot");
  revalidatePath(`/clients/${clientId}`);
}

export async function cancelSessionAction(sessionId: string, clientId: string) {
  await requireClientAccess(clientId);
  await requireSessionForClient(clientId, sessionId);
  await data.cancelSession(sessionId);
  syncSessionToGoogleInBackground(sessionId);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/copilot");
  revalidatePath(`/clients/${clientId}`);
}

export async function toggleMilestoneAction(clientId: string, milestoneKey: string, complete: boolean) {
  await requireClientAccess(clientId);
  if (complete) {
    await data.completeMilestone(clientId, milestoneKey);
    // Auto-create a completed session record so the Sessions tab is never
    // empty after marking an activity complete from the activity page.
    await data.ensureSessionRecord(clientId, milestoneKey);
    await data.syncJourneyProgressFromMilestones(clientId);
  } else {
    await data.uncompleteMilestone(clientId, milestoneKey);
  }
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/intake`);
  revalidatePath(`/clients/${clientId}/preparation`);
  revalidatePath(`/clients/${clientId}/journey-day`);
  revalidatePath(`/clients/${clientId}/integration-1`);
  revalidatePath(`/clients/${clientId}/integration-2`);
}

export async function completeSessionAction(sessionId: string, clientId: string) {
  await requireClientAccess(clientId);
  await requireSessionForClient(clientId, sessionId);
  await data.completeSession(sessionId);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath(`/clients/${clientId}`);
}

export async function reopenCompletedSessionAction(sessionId: string, clientId: string) {
  await requireClientAccess(clientId);
  await requireSessionForClient(clientId, sessionId);
  await data.reopenCompletedSession(sessionId);
  syncSessionToGoogleInBackground(sessionId);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/copilot");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/intake`);
  revalidatePath(`/clients/${clientId}/preparation`);
  revalidatePath(`/clients/${clientId}/journey-day`);
  revalidatePath(`/clients/${clientId}/integration-1`);
  revalidatePath(`/clients/${clientId}/integration-2`);
}

export async function sendAiConversationMessageAction(clientId: string, body: string) {
  await requireClientAccess(clientId);
  const message = body.trim();
  if (!message) return data.getAiConversationMessages(clientId);

  const client = await data.getClient(clientId);
  if (!client) throw new Error("Client not found");

  await data.addAiConversationMessage(clientId, "practitioner", message);

  const [sessions, documents, formSubmissions, summaries, memory, preparationPlan, conversation] = await Promise.all([
    data.getSessions(clientId),
    data.getDocuments(clientId),
    data.getFormSubmissionsForClient(clientId),
    data.getAiSummaries(clientId),
    data.getMemory(clientId),
    data.getPreparationPlan(clientId),
    data.getAiConversationMessages(clientId),
  ]);
  const clientRecordDump = JSON.stringify({
    client,
    sessions: sessions.map((session) => ({
      session_type: session.session_type,
      status: session.status,
      scheduled_at: session.scheduled_at,
      duration_minutes: session.duration_minutes,
      manual_notes: session.manual_notes,
      transcript: session.transcript,
    })),
    documents: documents.map((document) => ({
      document_type: document.document_type,
      title: document.title,
      status: document.status,
    })),
    formSubmissions: formSubmissions.map((submission) => ({
      document_id: submission.document_id,
      status: submission.status,
    })),
    summaries: summaries.slice(0, 12).map((summary) => ({
      title: summary.title,
      content: summary.content,
      created_at: summary.created_at,
    })),
    memory,
    preparationPlan,
  });
  const conversationHistory = conversation
    .slice(-20)
    .map((item) => `${item.role === "practitioner" ? "Practitioner" : "AI"}: ${item.body}`)
    .join("\n\n");
  const prompt = buildAiConversationPrompt(client.full_name, clientRecordDump, conversationHistory, message);
  const { data: response, model } = await runAiJson<{ reply: string }>(prompt, () => mockAiConversationReply(client.full_name, message));
  await data.addAiConversationMessage(clientId, "assistant", response.reply, model);

  revalidatePath(`/clients/${clientId}`);
  return data.getAiConversationMessages(clientId);
}

// Toggles for the per-client AI Copilot list — purely cosmetic state, no
// journey-progress side effects, so this only ever needs to revalidate the
// client record itself.
export async function setSessionCopilotStateAction(
  sessionId: string,
  clientId: string,
  patch: { hidden?: boolean; finished?: boolean }
) {
  await requireClientAccess(clientId);
  await requireSessionForClient(clientId, sessionId);
  await data.setSessionCopilotState(sessionId, patch);
  revalidatePath(`/clients/${clientId}`);
}

// Client dismissed the portal welcome page. One-way flag — once set, the
// welcome never auto-shows again (it stays reachable from the header link).
export async function markPortalWelcomeSeenAction(clientId: string) {
  await requireClientAccess(clientId, { allowPortal: true });
  await data.updateClient(clientId, { portal_welcome_seen_at: new Date().toISOString() });
}

export async function markPortalAgreementsOpenedAction(clientId: string) {
  await requireClientAccess(clientId, { allowPortal: true });
  await data.markPortalAgreementsOpened(clientId);
  revalidatePath("/dashboard");
  revalidatePath(`/clients/${clientId}`);
}

export async function submitCheckInAction(
  clientId: string,
  fields: {
    emotional_state: string;
    physical_state: string;
    immediate_insights: string;
    support_needs: string;
    safety_concerns: string;
  },
  submittedBy: "practitioner" | "client"
) {
  const actor = await requireClientAccess(clientId, { allowPortal: submittedBy === "client" });
  if (actor.kind === "portal" && submittedBy !== "client") forbidden();
  await data.addCheckIn(clientId, {
    check_in_type: "12_hour",
    ...fields,
    submitted_by: submittedBy,
    submitted_at: new Date().toISOString(),
  });
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/portal");
}

export async function submitPostIntegrationFormAction(
  clientId: string,
  session: 1 | 2,
  responses: Record<string, string>
) {
  await requireClientAccess(clientId);
  await data.addPostIntegrationForm(clientId, session, responses);
  revalidatePath(`/clients/${clientId}/integration-${session}`);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/portal");
}

export async function addTaskAction(
  clientId: string,
  practitionerId: string,
  title: string,
  taskType: "form" | "reminder" | "reflection" | "session_prep" | "follow_up",
  dueAt?: string,
  assignedTo: "practitioner" | "client" = "practitioner"
) {
  const practitioner = await requirePractitioner();
  await requireClientAccess(clientId);
  if (practitionerId !== practitioner.id) forbidden();
  await data.addTask({
    client_id: clientId,
    practitioner_id: practitionerId,
    title,
    task_type: taskType,
    due_at: dueAt,
    status: "pending",
    assigned_to: assignedTo,
  });
  revalidatePath("/dashboard");
  revalidatePath(`/clients/${clientId}`);
}

export async function completeTaskAction(taskId: string, clientId: string) {
  const actor = await requireClientAccess(clientId, { allowPortal: true });
  const task = await requireTaskForClient(clientId, taskId);
  if (actor.kind === "portal" && task.assigned_to !== "client") forbidden();
  await data.completeTask(taskId);
  revalidatePath("/dashboard");
  revalidatePath(`/clients/${clientId}`);
}

export async function updateTaskAction(
  taskId: string,
  clientId: string,
  fields: { title: string; dueAt?: string; taskType: "form" | "reminder" | "reflection" | "session_prep" | "follow_up" }
) {
  await requireClientAccess(clientId);
  await requireTaskForClient(clientId, taskId);
  const title = fields.title.trim();
  if (!title) throw new Error("Task title is required.");

  await data.updateTask(taskId, {
    title,
    due_at: fields.dueAt,
    task_type: fields.taskType,
  });
  revalidatePath("/dashboard");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/tasks/${taskId}`);
}

export async function sendMessageAction(clientId: string, sender: "practitioner" | "client", body: string) {
  const actor = await requireClientAccess(clientId, { allowPortal: sender === "client" });
  if (actor.kind === "portal" && sender !== "client") forbidden();
  await data.addMessage(clientId, sender, body);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/portal");
  revalidatePath("/dashboard");
}

async function canChangeSentMessage(clientId: string, sender: "practitioner" | "client"): Promise<boolean> {
  const actor = await requireClientAccess(clientId, { allowPortal: sender === "client" });
  return actor.kind === "practitioner" || sender === "client";
}

export async function editSentMessageAction(clientId: string, messageId: string, sender: "practitioner" | "client", body: string) {
  const nextBody = body.trim();
  if (!nextBody) throw new Error("Message cannot be empty.");
  if (!(await canChangeSentMessage(clientId, sender))) throw new Error("You cannot edit this message.");
  const updated = await data.updateMessage(clientId, messageId, sender, nextBody);
  if (!updated) throw new Error("Message not found or not sent by you.");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/portal");
  revalidatePath("/dashboard");
  return updated;
}

export async function deleteSentMessageAction(clientId: string, messageId: string, sender: "practitioner" | "client") {
  if (!(await canChangeSentMessage(clientId, sender))) throw new Error("You cannot delete this message.");
  const deleted = await data.deleteMessage(clientId, messageId, sender);
  if (!deleted) throw new Error("Message not found or not sent by you.");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/portal");
  revalidatePath("/dashboard");
}

// Lightweight poll target for the sidebar's unread-message badge — kept
// separate from the full dashboard summary so it stays cheap to call often.
export async function getUnreadMessageCountAction(): Promise<number> {
  await requirePractitioner();
  const { totalUnread } = await data.getUnreadMessagesSummary();
  return totalUnread;
}

export async function getActiveClientCountAction(): Promise<number> {
  await requirePractitioner();
  return data.getActiveClientCount();
}

export async function markMessagesReadAction(clientId: string) {
  await requireClientAccess(clientId);
  await data.markMessagesRead(clientId);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/dashboard");
}

export async function logIntroEmailAction(clientId: string, channel: "mail_app" | "copied") {
  await requireClientAccess(clientId);
  await data.addEmailLog(clientId, "intro", channel);
  revalidatePath(`/clients/${clientId}`);
}

export async function logJourneyPrepEmailAction(clientId: string, channel: "mail_app" | "copied") {
  await requireClientAccess(clientId);
  await data.addEmailLog(clientId, "journey_prep", channel);
  revalidatePath(`/clients/${clientId}`);
}

export async function logJourneySummaryTextAction(clientId: string, channel: "sms_app" | "copied") {
  await requireClientAccess(clientId);
  await data.addSmsLog(clientId, "journey_summary_ready", channel);
  revalidatePath(`/clients/${clientId}`);
}

export async function completePortalAssignmentAction(id: string, clientId: string) {
  await requireClientAccess(clientId, { allowPortal: true });
  if (!(await data.getPortalAssignments(clientId)).some((assignment) => assignment.id === id)) forbidden();
  await data.completePortalAssignment(id);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/portal");
}

export async function addPortalAssignmentAction(
  clientId: string,
  assignmentType: "form" | "homework" | "journaling_prompt" | "integration_exercise" | "action_item",
  title: string,
  description?: string,
  dueAt?: string
) {
  await requireClientAccess(clientId);
  await data.addPortalAssignment({
    client_id: clientId,
    assignment_type: assignmentType,
    title,
    description,
    status: "pending",
    due_at: dueAt,
  });
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/portal");
}

export async function listClientsForPortalAction() {
  const practitioner = await requirePractitioner();
  const clients = await data.getClients();
  return clients.filter((client) => client.practitioner_id === practitioner.id).map((c) => ({ id: c.id, full_name: c.full_name, status: c.status }));
}

// Returned instead of a real bundle when the requester is neither an
// authenticated practitioner (previewing) nor logged in as this client. The
// portal UI shows a "create your account" form if accountExists is false,
// or a login form if it's true, instead of any of the client's actual data.
export interface PortalLocked {
  locked: true;
  accountExists: boolean;
}

export async function getPortalBundleAction(clientId: string) {
  const client = await data.getClient(clientId);
  if (!client) return { client: undefined } as { client: undefined };

  try {
    await authorizeClientAccess(clientId, { allowPortal: true });
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) {
      return {
        locked: true,
        accountExists: Boolean(client.portal_password_hash),
      } as PortalLocked;
    }
    interruptUnauthorizedAction(error);
  }

  const [
    tasks,
    assignments,
    messages,
    growthPlan,
    checkIns,
    postIntegrationForms,
    milestones,
    documents,
    formTemplates,
    formSubmissions,
    sessions,
    sessionCallSummaries,
    recordings,
    practitioner,
  ] = await Promise.all([
    data.getTasks(clientId),
    data.getPortalAssignments(clientId),
    data.getMessages(clientId),
    data.getGrowthActionPlan(clientId),
    data.getCheckIns(clientId),
    data.getPostIntegrationForms(clientId),
    data.getMilestones(clientId),
    data.getDocuments(clientId),
    data.getFormTemplates(),
    data.getFormSubmissionsForClient(clientId),
    data.getSessions(clientId),
    data.getAiSummaries(clientId, "session_call_summary"),
    data.getRecordings(clientId),
    data.getPractitioner(),
  ]);
  return {
    client,
    // Facilitator name/email/phone, so the portal can prefill the
    // facilitator half of the Informed Consent form.
    practitioner,
    tasks: tasks.filter((t) => t.assigned_to === "client"),
    assignments,
    messages,
    growthPlan,
    checkIns,
    postIntegrationForms,
    milestones,
    documents,
    formTemplates,
    formSubmissions,
    sessions,
    sessionCallSummaries,
    recordings,
  };
}

// Client-facing signed playback/download URL for a recording — separate from
// the practitioner-side getRecordingDownloadUrlAction so the client portal
// can't be used to fetch a signed URL for a recording belonging to a
// different client just by guessing/knowing its id. Re-checks the same
// practitioner-preview-or-unlocked-portal auth getPortalBundleAction uses,
// and re-verifies the recording actually belongs to clientId before ever
// generating a URL for it.
export async function getPortalRecordingUrlAction(clientId: string, recordingId: string): Promise<string | null> {
  await requireClientAccess(clientId, { allowPortal: true });
  const recordings = await data.getRecordings(clientId);
  const recording = recordings.find((r) => r.id === recordingId);
  if (!recording) return null;
  return data.getRecordingDownloadUrl(recording.storage_path);
}

// ---------------------------------------------------------------------------
// FORM LIBRARY — fill, submit/sign, and admin toggle actions
// ---------------------------------------------------------------------------

export async function getFormTemplatesAction() {
  await requirePractitioner();
  return data.getFormTemplates();
}

export async function getFormForDocumentAction(documentId: string, documentType: DocumentType) {
  const document = await data.getDocument(documentId);
  if (!document) throw new Error("Document not found.");
  await requireClientAccess(document.client_id, { allowPortal: true });
  const [template, submission] = await Promise.all([
    data.getFormTemplateForDocumentType(documentType),
    data.getFormSubmission(documentId),
  ]);
  return { template, submission };
}

// Lightweight read used for live polling (see FormRenderer's `live` prop) —
// deliberately bypasses revalidatePath/page cache so both the client portal
// and the practitioner's client-record view can poll the same in-progress
// submission and see each other's edits within a couple seconds, without a
// full page reload.
export async function getFormSubmissionAction(documentId: string) {
  const document = await data.getDocument(documentId);
  if (!document) throw new Error("Document not found.");
  await requireClientAccess(document.client_id, { allowPortal: true });
  return data.getFormSubmission(documentId);
}

export async function saveFormProgressAction(
  clientId: string,
  documentId: string,
  templateId: string,
  answers: Record<string, string | string[] | boolean>
) {
  await requireClientAccess(clientId, { allowPortal: true });
  await requireDocumentForClient(clientId, documentId);
  await data.saveFormSubmission({ clientId, documentId, templateId, answers, status: "in_progress" });
  revalidatePath("/portal");
}

export async function submitClientFormAction(
  clientId: string,
  documentId: string,
  templateId: string,
  answers: Record<string, string | string[] | boolean>,
  signed: boolean
) {
  await requireClientAccess(clientId, { allowPortal: true });
  await requireDocumentForClient(clientId, documentId);
  await data.saveFormSubmission({
    clientId,
    documentId,
    templateId,
    answers,
    status: signed ? "signed" : "submitted",
  });
  revalidatePath("/portal");
  revalidatePath(`/clients/${clientId}`);
}

export async function markFormReviewedAction(clientId: string, documentId: string) {
  "use server";
  await requireClientAccess(clientId);
  await requireDocumentForClient(clientId, documentId);
  await data.markDocumentReviewed(documentId);
  revalidatePath(`/clients/${clientId}`);
}

export async function setFormTemplateFlagsAction(templateId: string, patch: { required?: boolean; active?: boolean }) {
  await requirePractitioner();
  await data.setFormTemplateFlags(templateId, patch);
  revalidatePath("/settings/forms");
}

export async function resyncFormTemplatesAction() {
  await requirePractitioner();
  await data.resyncFormTemplates();
  revalidatePath("/settings/forms");
}

// ---------------------------------------------------------------------------
// PROSPECTS — pre-client CRM records for introductory calls
// ---------------------------------------------------------------------------

export async function createProspectAction(input: {
  full_name: string;
  email?: string;
  phone?: string;
  referral_source?: string;
}) {
  await requirePractitioner();
  const prospect = await data.addProspect(input);
  revalidatePath("/prospects");
  revalidatePath(`/prospects/${prospect.id}`);
  revalidatePath("/dashboard");
  return prospect;
}

export async function updateProspectAction(
  id: string,
  patch: Parameters<typeof data.updateProspect>[1]
) {
  await requireProspectAccess(id);
  const prospect = await data.updateProspect(id, patch);
  revalidatePath("/prospects");
  revalidatePath(`/prospects/${id}`);
  return prospect;
}

export async function deleteProspectAction(id: string) {
  await requireProspectAccess(id);
  await data.deleteProspect(id);
  revalidatePath("/prospects");
  redirect("/prospects");
}

export async function scheduleProspectCallAction(input: {
  prospect_id: string;
  prospect_name: string;
  call_type: "intro_call" | "follow_up";
  scheduled_at: string;
  duration_minutes?: number;
  notes?: string;
}) {
  await requireProspectAccess(input.prospect_id);
  const call = await data.addProspectCall(input);
  syncProspectCallToGoogleInBackground(call.id);
  revalidatePath(`/prospects/${input.prospect_id}`);
  revalidatePath("/calendar");
  return call;
}

// ---------------------------------------------------------------------------
// HOLDS
// ---------------------------------------------------------------------------
// Parking a client or prospect hides them from the working views and drops a
// follow-up reminder on the calendar (default 60 days out, editable). The
// reminder is a ProspectCall, so it mirrors to Google Calendar through the
// same path as every other scheduled item.

export async function putClientOnHoldAction(
  clientId: string,
  opts: { followUpAt?: string; reason?: string } = {}
) {
  await requireClientAccess(clientId);
  const client = await data.putClientOnHold(clientId, opts);
  if (client?.hold_reminder_call_id) {
    syncProspectCallToGoogleInBackground(client.hold_reminder_call_id);
  }
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return client;
}

export async function releaseClientHoldAction(clientId: string) {
  await requireClientAccess(clientId);
  const existing = await data.getClient(clientId);
  const reminderId = existing?.hold_reminder_call_id;
  const reminder = reminderId ? await data.getProspectCall(reminderId) : undefined;

  const client = await data.releaseClientHold(clientId);
  if (reminder?.google_event_id) {
    deleteProspectCallFromGoogleInBackground(reminder.google_event_id);
  }
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return client;
}

export async function putProspectOnHoldAction(
  prospectId: string,
  opts: { followUpAt?: string; reason?: string } = {}
) {
  await requireProspectAccess(prospectId);
  const prospect = await data.putProspectOnHold(prospectId, opts);
  if (prospect?.hold_reminder_call_id) {
    syncProspectCallToGoogleInBackground(prospect.hold_reminder_call_id);
  }
  revalidatePath(`/prospects/${prospectId}`);
  revalidatePath("/prospects");
  revalidatePath("/calendar");
  return prospect;
}

export async function releaseProspectHoldAction(prospectId: string) {
  await requireProspectAccess(prospectId);
  const existing = await data.getProspect(prospectId);
  const reminderId = existing?.hold_reminder_call_id;
  const reminder = reminderId ? await data.getProspectCall(reminderId) : undefined;

  const prospect = await data.releaseProspectHold(prospectId);
  if (reminderId) {
    deleteProspectCallFromGoogleInBackground(reminderId, reminder?.google_event_id);
  }
  revalidatePath(`/prospects/${prospectId}`);
  revalidatePath("/prospects");
  revalidatePath("/calendar");
  return prospect;
}

export async function updateProspectCallAction(
  callId: string,
  prospectId: string,
  patch: Parameters<typeof data.updateProspectCall>[1]
) {
  await requireProspectAccess(prospectId);
  const existingCall = await data.getProspectCall(callId);
  if (!existingCall || existingCall.prospect_id !== prospectId) forbidden();
  const call = await data.updateProspectCall(callId, patch);
  syncProspectCallToGoogleInBackground(callId);
  revalidatePath(`/prospects/${prospectId}`);
  revalidatePath("/calendar");
  return call;
}

export async function deleteProspectCallAction(callId: string, prospectId: string) {
  await requireProspectAccess(prospectId);
  // Grab the Google event id (if any) before the local record is gone, so
  // we can clean up the mirrored event on Google too.
  const existing = await data.getProspectCall(callId);
  if (!existing || existing.prospect_id !== prospectId) forbidden();
  await data.deleteProspectCall(callId);
  if (existing) {
    deleteProspectCallFromGoogleInBackground(callId, existing.google_event_id);
  }
  revalidatePath(`/prospects/${prospectId}`);
  revalidatePath("/calendar");
}

// ---------------------------------------------------------------------------
// Fire-and-forget Google Calendar push helpers. Deliberately not awaited by
// callers above — scheduling inside Heartful OS should never wait on a
// network round trip to Google. Each push function already catches its own
// errors internally (see lib/googleCalendarSync.ts), so a Google outage
// never surfaces as a broken save here; the .catch below is just a second
// safety net.
// ---------------------------------------------------------------------------

function syncSessionToGoogleInBackground(sessionId: string) {
  import("@/lib/googleCalendarSync")
    .then(({ pushSessionToGoogle }) => pushSessionToGoogle(sessionId))
    .catch((err) => console.error("Google Calendar session sync failed to start:", err));
}

function syncProspectCallToGoogleInBackground(callId: string) {
  import("@/lib/googleCalendarSync")
    .then(({ pushProspectCallToGoogle }) => pushProspectCallToGoogle(callId))
    .catch((err) => console.error("Google Calendar prospect call sync failed to start:", err));
}

// Used when the local record is *deleted* outright (rather than cancelled),
// so there's nothing left to push. Takes the local id as well as the stored
// event id and sweeps by the heartfulId tag, because a record deleted moments
// after being created may not have had google_event_id written back yet —
// without the sweep that event is orphaned on Google. Same reasoning as
// removeSessionFromGoogle in lib/googleCalendarSync.ts.
function deleteProspectCallFromGoogleInBackground(localId: string, googleEventId?: string) {
  import("@/lib/googleCalendar")
    .then(async ({ getAuthorizedClient, ensureHeartfulCalendar, deleteHeartfulEvent, deleteHeartfulEventsByLocalId }) => {
      const auth = await getAuthorizedClient();
      if (!auth) return;
      const calendarId = await ensureHeartfulCalendar(auth);
      if (googleEventId) await deleteHeartfulEvent(auth, calendarId, googleEventId);
      await deleteHeartfulEventsByLocalId(auth, calendarId, localId);
    })
    .catch((err) => console.error("Failed to delete prospect call from Google Calendar:", err));
}

// Additional call transcripts (beyond the original intro-call transcript on
// the prospect record itself) — e.g. a second call before conversion.
export async function addProspectTranscriptAction(prospectId: string, label: string, rawText: string) {
  await requireProspectAccess(prospectId);
  const t = await data.addProspectTranscript({ prospect_id: prospectId, label, raw_text: rawText });
  revalidatePath(`/prospects/${prospectId}`);
  return t;
}

export async function updateProspectTranscriptAction(
  id: string,
  prospectId: string,
  patch: Parameters<typeof data.updateProspectTranscript>[1]
) {
  await requireProspectAccess(prospectId);
  if (!(await data.getProspectTranscripts(prospectId)).some((transcript) => transcript.id === id)) forbidden();
  const t = await data.updateProspectTranscript(id, patch);
  revalidatePath(`/prospects/${prospectId}`);
  return t;
}

export async function deleteProspectTranscriptAction(id: string, prospectId: string) {
  await requireProspectAccess(prospectId);
  if (!(await data.getProspectTranscripts(prospectId)).some((transcript) => transcript.id === id)) forbidden();
  await data.deleteProspectTranscript(id);
  revalidatePath(`/prospects/${prospectId}`);
}

// Generates an AI summary for one additional transcript record and saves it
// inline on that transcript (mirrors the practitioner-facing summary flow
// the original transcript already has via /api/ai/prospect-summary).
export async function generateProspectTranscriptSummaryAction(id: string, prospectId: string, transcriptText: string) {
  const prospect = await requireProspectAccess(prospectId);
  if (!(await data.getProspectTranscripts(prospectId)).some((transcript) => transcript.id === id)) forbidden();
  const prompt = buildProspectIntroSummaryPrompt(transcriptText, prospect.full_name);
  const { data: content, model } = await runAiJson(prompt, () => ({
    what_they_are_seeking: `${prospect.full_name} discussed their goals for this work.`,
    background_context: "Shared relevant context during this call.",
    hesitations_or_concerns: "Noted during the call.",
    readiness_signals: "Noted during the call.",
    questions_to_explore: "Follow up on open threads from this call.",
    practitioner_notes: "Review the transcript for details.",
  }));
  const now = new Date().toISOString();
  const t = await data.updateProspectTranscript(id, {
    ai_summary_content: content as Record<string, unknown>,
    ai_summary_model: model,
    ai_summary_generated_at: now,
  });
  revalidatePath(`/prospects/${prospectId}`);
  return t;
}

export async function convertProspectToClientAction(prospectId: string) {
  const prospect = await requireProspectAccess(prospectId);

  const referralSources = await data.getReferralSources();
  const matchedSource = prospect.referral_source
    ? referralSources.find((r) => r.name.toLowerCase() === prospect.referral_source?.toLowerCase())
    : undefined;

  const client = await data.createClient({
    full_name: prospect.full_name,
    email: prospect.email,
    phone: prospect.phone,
    referral_source_id: matchedSource?.id,
  });

  await data.updateProspect(prospectId, {
    status: "converted",
    converted_client_id: client.id,
  });

  revalidatePath("/prospects");
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  redirect(`/clients/${client.id}`);
}

// ---------------------------------------------------------------------------
// SCHEDULING CONFLICTS — checked before saving a Session or ProspectCall so
// the practitioner doesn't double-book themselves. Compares against every
// other scheduled Session, every other scheduled ProspectCall, and (once
// Google Calendar is connected) any mirrored busy block from their primary
// Google Calendar — see lib/googleCalendarSync.ts.
// ---------------------------------------------------------------------------

export interface ScheduleConflict {
  type: "session" | "prospect_call" | "external";
  title: string;
  start_at: string;
  end_at?: string;
}

export async function checkScheduleConflictsAction(
  startIso: string,
  durationMinutes: number,
  excludeId?: string
): Promise<ScheduleConflict[]> {
  await requirePractitioner();
  const start = new Date(startIso).getTime();
  const end = start + durationMinutes * 60 * 1000;
  const overlaps = (otherStart: string, otherDurationMinutes?: number, otherEnd?: string) => {
    const os = new Date(otherStart).getTime();
    const oe = otherEnd ? new Date(otherEnd).getTime() : os + (otherDurationMinutes ?? 60) * 60 * 1000;
    return start < oe && end > os;
  };

  const [sessions, prospectCalls, externalEvents] = await Promise.all([
    data.getAllSessions(),
    data.getAllProspectCalls(),
    data.getExternalCalendarEvents(),
  ]);

  const conflicts: ScheduleConflict[] = [];

  for (const s of sessions) {
    if (s.id === excludeId || s.status !== "scheduled" || !s.scheduled_at) continue;
    if (overlaps(s.scheduled_at, s.duration_minutes)) {
      conflicts.push({ type: "session", title: `${s.client_name} — ${s.session_type.replace(/_/g, " ")}`, start_at: s.scheduled_at });
    }
  }
  for (const c of prospectCalls) {
    if (c.id === excludeId || c.status !== "scheduled") continue;
    if (overlaps(c.scheduled_at, c.duration_minutes)) {
      conflicts.push({ type: "prospect_call", title: `${c.prospect_name} — ${c.call_type === "intro_call" ? "Intro Call" : "Follow-up"}`, start_at: c.scheduled_at });
    }
  }
  for (const e of externalEvents) {
    if (overlaps(e.start_at, undefined, e.end_at)) {
      conflicts.push({ type: "external", title: e.title || "Busy (Google Calendar)", start_at: e.start_at, end_at: e.end_at });
    }
  }
  return conflicts;
}

// ---------------------------------------------------------------------------
// GOOGLE CALENDAR — connect/callback/webhook live as route handlers (see
// src/app/api/integrations/google/*) since they involve redirects or calls
// from Google's servers. Disconnect and manual "sync now" are plain server
// actions since they're just button clicks inside the already-authenticated
// practitioner UI.
// ---------------------------------------------------------------------------

export async function getGoogleCalendarStatusAction() {
  await requirePractitioner();
  const settings = await data.getGoogleCalendarSettings();
  return {
    connected: settings.connected,
    connected_email: settings.connected_email,
    last_synced_at: settings.last_synced_at,
    last_sync_error: settings.last_sync_error,
  };
}

export async function disconnectGoogleCalendarAction() {
  await requirePractitioner();
  const { disconnectGoogle } = await import("@/lib/googleCalendar");
  await disconnectGoogle();
  revalidatePath("/settings");
  revalidatePath("/calendar");
}

export async function syncGoogleCalendarNowAction() {
  await requirePractitioner();
  const { pullAndApplyChanges } = await import("@/lib/googleCalendarSync");
  await pullAndApplyChanges();
  revalidatePath("/settings");
  revalidatePath("/calendar");
  return data.getGoogleCalendarSettings();
}

export async function createPostJourneyTimelineAction(clientId: string, practitionerId: string) {
  const practitioner = await requirePractitioner();
  await requireClientAccess(clientId);
  if (practitionerId !== practitioner.id) forbidden();
  const now = Date.now();
  const hrs = (h: number) => new Date(now + h * 60 * 60 * 1000).toISOString();
  await Promise.all([
    data.addTask({
      client_id: clientId,
      practitioner_id: practitionerId,
      title: "12-Hour Check-In",
      task_type: "form",
      due_at: hrs(12),
      status: "pending",
      assigned_to: "client",
    }),
    data.addTask({
      client_id: clientId,
      practitioner_id: practitionerId,
      title: "48-Hour Reflection Reminder",
      task_type: "reflection",
      due_at: hrs(48),
      status: "pending",
      assigned_to: "client",
    }),
    data.addTask({
      client_id: clientId,
      practitioner_id: practitionerId,
      title: "Integration Session One Reminder (within 72 hrs)",
      task_type: "session_prep",
      due_at: hrs(72),
      status: "pending",
      assigned_to: "practitioner",
    }),
    data.addTask({
      client_id: clientId,
      practitioner_id: practitionerId,
      title: "Integration Session Two Reminder (within 10 days)",
      task_type: "session_prep",
      due_at: hrs(24 * 10),
      status: "pending",
      assigned_to: "practitioner",
    }),
  ]);

  // Also put real placeholder sessions on the calendar for the three
  // touchpoints that are actual meetings with the practitioner (the
  // 48-hour reflection is a self-guided client task, not a session, so
  // it stays as a task-only reminder above). Times are estimates the
  // practitioner can drag/edit on the Calendar once the client confirms.
  const newSessions = await Promise.all([
    data.addSession({ client_id: clientId, session_type: "check_in_12hr", scheduled_at: hrs(12), duration_minutes: 30 }),
    data.addSession({ client_id: clientId, session_type: "integration_1", scheduled_at: hrs(72), duration_minutes: 60 }),
    data.addSession({ client_id: clientId, session_type: "integration_2", scheduled_at: hrs(24 * 10), duration_minutes: 60 }),
  ]);
  for (const s of newSessions) syncSessionToGoogleInBackground(s.id);

  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/copilot");
  revalidatePath(`/clients/${clientId}`);
}
