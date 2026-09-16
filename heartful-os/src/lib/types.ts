// Core domain types for Heartful OS.
// These mirror the Supabase schema in supabase/migrations/0001_init.sql.
// When wiring up real Supabase, these types should match `Database` codegen
// (npx supabase gen types typescript) — kept hand-written for now so the
// mock data layer and the future real layer share an identical shape.

export type UserRole = "practitioner" | "admin" | "client";

export type ClientStatus =
  | "inquiry"
  | "intake_scheduled"
  | "intake_complete"
  | "preparation"
  | "preparation_complete"
  | "journey_scheduled"
  | "journey_complete"
  | "check_in_complete"
  | "integration_1"
  | "integration_1_complete"
  | "integration_2"
  | "integration_2_complete"
  | "journey_closed"
  | "inactive";

// ---------------------------------------------------------------------------
// ON HOLD
// ---------------------------------------------------------------------------
// A client or prospect can be parked without losing their place. Hold state is
// deliberately NOT a ClientStatus / ProspectStatus value: those drive phase
// mapping, milestone logic and exhaustive Record<> label maps, and a client on
// hold hasn't changed where they are in the journey — they've just paused. So
// hold lives in its own optional block, and releasing a hold restores the
// record exactly as it was.
//
// Anything carrying on_hold_at is hidden from the default list/dashboard/
// calendar/copilot reads (see getClients / getProspects in data.ts) until the
// hold is released or the practitioner explicitly asks to see held records.
export interface OnHoldFields {
  /** ISO timestamp the hold was placed. Presence of this field IS the hold. */
  on_hold_at?: string;
  /** ISO timestamp of the scheduled follow-up — defaults to 60 days out. */
  hold_follow_up_at?: string;
  /** Optional practitioner note: why this record was parked. */
  hold_reason?: string;
  /** ProspectCall id of the follow-up reminder, so releasing can clean it up. */
  hold_reminder_call_id?: string;
}

/** Days out the follow-up reminder defaults to when placing a hold. */
export const DEFAULT_HOLD_DAYS = 60;

export type JourneyPhase =
  | "intake"
  | "preparation"
  | "harm_reduction_session"
  | "post_journey_check_in"
  | "integration_1"
  | "integration_2"
  | "closed";

export type DocumentType =
  | "participant_screening_form"
  | "informed_consent"
  | "harm_reduction_services_agreement"
  | "client_services_agreement"
  | "preparation_navigation_plan"
  | "preparation_education_session"
  | "integration_session_1"
  | "integration_session_2"
  | "post_integration_form"
  | "post_integration_form_updated"
  | "session_notes"
  | "journey_brief"
  | "integration_summary_1"
  | "integration_summary_2"
  | "growth_action_plan"
  | "other";

export type SessionType =
  | "intake_assessment"
  | "preparation"
  | "harm_reduction_support"
  | "check_in_12hr"
  | "integration_1"
  | "integration_2"
  | "other";

export type TaskStatus = "pending" | "in_progress" | "completed" | "skipped" | "overdue";

export type AiSummaryType =
  | "client_assessment_summary"
  | "journey_brief"
  | "journey_summary"
  | "check_in_12hr_summary"
  | "integration_1_brief"
  | "integration_summary"
  | "growth_action_plan"
  | "prepare_me_briefing"
  | "living_journey_summary"
  | "session_call_summary"
  | "journey_manual_notes_summary";

export type MemoryItemType =
  | "note"
  | "intention"
  | "insight"
  | "theme"
  | "challenge"
  | "breakthrough"
  | "commitment"
  | "action_item"
  | "integration_outcome";

export type SessionNoteField =
  | "observation"
  | "significant_moment"
  | "client_request"
  | "safety_note"
  | "integration_theme";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  practice_name?: string;
  title?: string;
  // Venmo username (no @), used to build a payment link for client-facing
  // emails (e.g. https://venmo.com/<venmo_handle>). Optional — set in Settings.
  venmo_handle?: string;
  /** Payment instructions configured by the practitioner for use in client communications. */
  payment_methods?: PaymentMethod[];
}

export type PaymentMethodKind = "venmo" | "paypal" | "cash_app" | "zelle" | "bank_transfer" | "other";

export interface PaymentMethod {
  id: string;
  kind: PaymentMethodKind;
  label: string;
  details: string;
}

export interface ReferralSource {
  id: string;
  practitioner_id: string;
  name: string;
  category?: string;
}

export interface Client extends OnHoldFields {
  id: string;
  practitioner_id: string;
  portal_user_id?: string;
  full_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  referral_source_id?: string;
  status: ClientStatus;
  current_phase: JourneyPhase;
  notes?: string;
  package_name?: string;
  package_value?: number;
  amount_paid?: number;
  payment_due_date?: string;
  // Client-chosen portal login. The client sets these themselves the first
  // time they open their private portal link (see actions.ts
  // createPortalAccountAction) — the practitioner never sees the password,
  // only whether an account has been set up. portal_password_hash is a
  // SHA-256 hash, never the plaintext password (see data.ts hashPassword).
  portal_email?: string;
  portal_password_hash?: string;
  // Set the first time the client dismisses the portal welcome page. Stored
  // on the record rather than in localStorage so the welcome doesn't come
  // back when they switch from their phone to a laptop.
  portal_welcome_seen_at?: string;
  created_at: string;
  updated_at: string;
}

export interface JourneyMilestone {
  id: string;
  client_id: string;
  milestone_key: string;
  label: string;
  sort_order: number;
  completed: boolean;
  completed_at?: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  file_url: string;
  file_name: string;
  file_size_bytes?: number;
  mime_type?: string;
  uploaded_by_role?: UserRole;
  notes?: string;
  created_at: string;
}

export interface ClientDocument {
  id: string;
  client_id: string;
  document_type: DocumentType;
  title: string;
  required: boolean;
  status: "missing" | "uploaded" | "signed" | "reviewed";
  versions: DocumentVersion[];
  current_version_id?: string;
}

// ---------------------------------------------------------------------------
// FORM LIBRARY — reusable form/consent templates (built from the
// practitioner's real intake/consent paperwork) that auto-attach to new
// clients and get filled out + signed by the client in the portal, instead
// of being a generic file-upload slot.
// ---------------------------------------------------------------------------

export type FormFieldType =
  | "short_text"
  | "long_text"
  | "yes_no"
  | "select"
  | "multi_select"
  | "fee"
  | "static_text"
  | "initial"
  | "signature";

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  helpText?: string;
  options?: FormFieldOption[]; // select | multi_select
  required?: boolean;
}

export interface FormSection {
  id: string;
  title?: string;
  body?: string; // intro / instructions / legal text rendered above the fields
  fields: FormField[];
}

export interface FormTemplate {
  id: string;
  document_type: DocumentType;
  title: string;
  description?: string;
  required: boolean; // auto-attached to every new client when also active
  active: boolean; // whether this template is currently in use
  // Which session stage(s) this form is relevant to — used to group forms
  // by stage in the Documents tab and surface the right forms on the Copilot.
  session_types?: SessionType[];
  sections: FormSection[];
}

export interface FormSubmission {
  id: string;
  client_id: string;
  document_id: string; // the ClientDocument this submission fulfills
  template_id: string;
  answers: Record<string, string | string[] | boolean>;
  status: "draft" | "in_progress" | "submitted" | "signed";
  submitted_at?: string;
  signed_at?: string;
}

export interface Session {
  id: string;
  client_id: string;
  practitioner_id: string;
  session_type: SessionType;
  scheduled_at?: string;
  duration_minutes?: number;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  location?: string;
  // Practitioner-only UI state for the per-client AI Copilot list — lets a
  // stage be hidden from the chronological list (e.g. no longer relevant)
  // or marked finished (briefing's been used) without affecting the
  // session's actual scheduling status.
  copilot_hidden?: boolean;
  copilot_finished?: boolean;
  /** Google Calendar event id this session is mirrored to, once synced */
  google_event_id?: string;
  /** ISO timestamp of the last write we made to Google for this record — used to ignore the sync-back echo */
  google_synced_at?: string;
  /** Free-form practitioner notes on this session, separate from the timestamped/tagged Structured Session Notes */
  manual_notes?: string;
  /** ISO timestamp of when the Journey Day session actually began (set via the Journey Begin toggle). null = cleared. */
  journey_started_at?: string | null;
  /** ISO timestamp of when the Journey Day session actually ended (set via the Journey End toggle). null = cleared. */
  journey_ended_at?: string | null;
  /** Free-text amount of the initial dose administered (e.g. "25mg", "3.5g") */
  initial_dose_amount?: string;
  /** ISO timestamp of a booster dose (set via the Booster Dose toggle). null = cleared. */
  booster_dose_at?: string | null;
  /** Free-text amount of the booster dose administered */
  booster_dose_amount?: string;
  /**
   * Pasted transcript text (from a recording app like Plaud, iPhone Voice
   * Memos, Fathom, etc.) — the single persisted source both the
   * practitioner-facing and client-facing AI summaries are generated from.
   * Separate from manual_notes, which is the practitioner's own free-form
   * running journal, not a transcript of what was said.
   */
  transcript?: string;
}

export interface Transcript {
  id: string;
  client_id: string;
  session_id?: string;
  source: "paste" | "upload";
  file_url?: string;
  raw_text?: string;
  created_at: string;
}

export interface Recording {
  id: string;
  client_id: string;
  session_id?: string;
  /** Cloud Storage object path — not a public URL. A fresh signed download URL is generated on demand (getRecordingDownloadUrl) rather than stored, since signed URLs expire. */
  storage_path: string;
  /** Legacy/optional public URL field — unused by the real upload flow, kept for the Transcript-style shape used elsewhere */
  file_url?: string;
  file_name?: string;
  size_bytes?: number;
  duration_seconds?: number;
  created_at: string;
}

export interface AiSummary {
  id: string;
  client_id: string;
  session_id?: string;
  // Which stage of the journey this summary was generated for ("Preparation",
  // "Journey Day", …). Set for Prepare Me briefings so each phase page shows
  // its OWN briefing rather than whichever one was generated first — needed
  // because a phase with no session on the calendar yet has no session_id to
  // scope by.
  stage_label?: string;
  summary_type: AiSummaryType;
  title: string;
  content: Record<string, unknown>;
  model?: string;
  created_at: string;
}

export interface AiConversationMessage {
  id: string;
  client_id: string;
  role: "practitioner" | "assistant";
  body: string;
  model?: string;
  created_at: string;
}

export interface ClientMemoryItem {
  id: string;
  client_id: string;
  item_type: MemoryItemType;
  content: string;
  phase?: JourneyPhase;
  status: "open" | "in_progress" | "resolved" | "carried_forward";
  created_at: string;
}

export interface SessionNote {
  id: string;
  session_id: string;
  client_id: string;
  field_type: SessionNoteField;
  note_timestamp: string;
  elapsed_minutes?: number;
  content: string;
}

export interface PreparationPlan {
  id: string;
  client_id: string;
  intentions?: string;
  desired_outcomes?: string;
  fears?: string;
  support_systems?: string;
  preparation_practices?: string;
  mindset_considerations?: string;
  environmental_considerations?: string;
  navigation_strategies?: string;
  integration_priorities?: string;
  updated_at: string;
}

export interface CheckIn {
  id: string;
  client_id: string;
  check_in_type: "12_hour" | "48_hour_reflection";
  emotional_state?: string;
  physical_state?: string;
  immediate_insights?: string;
  support_needs?: string;
  safety_concerns?: string;
  submitted_by?: UserRole;
  submitted_at?: string;
}

export interface PostIntegrationForm {
  id: string;
  client_id: string;
  integration_session: 1 | 2;
  responses: Record<string, string>;
  submitted_at?: string;
}

export interface GrowthActionPlan {
  id: string;
  client_id: string;
  thirty_day_commitments: string[];
  behavioral_experiments: string[];
  daily_practices: string[];
  reflection_questions: string[];
  accountability_commitments: string[];
  created_at: string;
}

export interface Task {
  id: string;
  client_id: string;
  practitioner_id: string;
  title: string;
  description?: string;
  task_type?: "form" | "reminder" | "reflection" | "session_prep" | "follow_up";
  due_at?: string;
  status: TaskStatus;
  assigned_to: UserRole;
  completed_at?: string;
}

export interface Message {
  id: string;
  client_id: string;
  sender: UserRole;
  sender_id?: string;
  body: string;
  read_at?: string;
  created_at: string;
}

export interface PortalAssignment {
  id: string;
  client_id: string;
  assignment_type: "form" | "homework" | "journaling_prompt" | "integration_exercise" | "action_item";
  title: string;
  description?: string;
  content?: Record<string, unknown>;
  status: TaskStatus;
  due_at?: string;
  completed_at?: string;
}

export interface EmailLog {
  id: string;
  client_id: string;
  email_type: "intro" | "journey_prep";
  // We never actually send the email ourselves (no SMTP provider wired up —
  // see emailTemplates.ts), so this just records that the practitioner used
  // the modal: either handed it to their mail app, or copied the text to
  // paste in manually. Either way it's evidence the step happened.
  channel: "mail_app" | "copied";
  created_at: string;
}

export interface SmsLog {
  id: string;
  client_id: string;
  sms_type: "journey_summary_ready";
  // We never actually send the text ourselves (no SMS provider wired up yet
  // — see smsTemplates.ts), so this just records that the practitioner used
  // the modal: either handed it to their Messages app, or copied the text to
  // paste in manually. Either way it's evidence the step happened.
  channel: "sms_app" | "copied";
  created_at: string;
}

export interface Payment {
  id: string;
  client_id: string;
  amount: number;
  paid_at: string;
  method?: string;
  notes?: string;
}

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  participant_screening_form: "Participant Screening Form",
  informed_consent: "Informed Consent",
  harm_reduction_services_agreement: "Harm Reduction Services Agreement",
  client_services_agreement: "Client Services Agreement",
  preparation_navigation_plan: "Psychedelic Preparation and Navigation Plan",
  preparation_education_session: "Preparation Education Session",
  integration_session_1: "Integration Session 1 — Reflection Form",
  integration_session_2: "Integration Session 2 — Reflection Form",
  post_integration_form: "Post Integration Form",
  post_integration_form_updated: "Updated Post Integration Form",
  session_notes: "Session Notes",
  journey_brief: "Journey Brief",
  integration_summary_1: "Integration Summary (Session 1)",
  integration_summary_2: "Integration Summary (Session 2)",
  growth_action_plan: "Growth Action Plan",
  other: "Other Document",
};

export const MILESTONE_TEMPLATE: { key: string; label: string; sort_order: number }[] = [
  { key: "intake_complete", label: "Intake Complete", sort_order: 1 },
  { key: "preparation_complete", label: "Preparation Complete", sort_order: 2 },
  { key: "journey_complete", label: "Journey Complete", sort_order: 3 },
  { key: "check_in_12hr_complete", label: "12 Hour Check-In Complete", sort_order: 4 },
  { key: "integration_1_complete", label: "Integration 1 Complete", sort_order: 5 },
  { key: "integration_2_complete", label: "Integration 2 Complete", sort_order: 6 },
  { key: "growth_action_plan_complete", label: "Growth Action Plan Complete", sort_order: 7 },
  { key: "journey_closed", label: "Journey Closed", sort_order: 8 },
];

// ---------------------------------------------------------------------------
// PROSPECTS — pre-client CRM records for introductory calls
// ---------------------------------------------------------------------------

export type ProspectStatus =
  | "new"
  | "intro_scheduled"
  | "intro_complete"
  | "considering"
  | "converted"
  | "declined";

export interface Prospect extends OnHoldFields {
  id: string;
  practitioner_id: string;
  full_name: string;
  email?: string;
  phone?: string;
  referral_source?: string;
  status: ProspectStatus;
  /** Free-form practitioner notes */
  notes?: string;
  /** Pasted Fathom / call transcript */
  fathom_transcript?: string;
  /** When the intro call took place */
  intro_call_at?: string;
  /** AI-generated intro call summary, practitioner-facing (stored inline). Nullable so it can be explicitly cleared. */
  ai_summary_content?: Record<string, unknown> | null;
  ai_summary_model?: string | null;
  ai_summary_generated_at?: string | null;
  /** AI-generated intro call recap, written for the prospect themselves. Nullable so it can be explicitly cleared. */
  client_summary_content?: Record<string, unknown> | null;
  client_summary_model?: string | null;
  client_summary_generated_at?: string | null;
  /** Set when prospect converts to a full client */
  converted_client_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ProspectCall {
  id: string;
  /**
   * Empty string for a hold reminder attached to a full Client rather than a
   * prospect — see client_id below. Always set for real prospect calls.
   */
  prospect_id: string;
  /**
   * Set instead of prospect_id when this record is the 60-day follow-up
   * reminder for a Client on hold. ProspectCall is reused here rather than
   * introducing a parallel reminder type because it already renders on the
   * calendar and already mirrors to Google Calendar.
   */
  client_id?: string;
  /** Denormalized for calendar display — the client or prospect's name */
  prospect_name: string;
  call_type: "intro_call" | "follow_up" | "hold_follow_up";
  scheduled_at: string;
  duration_minutes?: number;
  status: "scheduled" | "completed" | "cancelled";
  notes?: string;
  created_at: string;
  /** Google Calendar event id this call is mirrored to, once synced */
  google_event_id?: string;
  /** ISO timestamp of the last write we made to Google for this record — used to ignore the sync-back echo */
  google_synced_at?: string;
}

// Additional call transcripts beyond the original intro-call transcript
// stored inline on Prospect.fathom_transcript. Lets a practitioner paste in
// a second (or third) call transcript — e.g. a follow-up call before the
// prospect converts to a full client — and optionally generate its own AI
// summary, same as the original transcript does.
export interface ProspectTranscript {
  id: string;
  prospect_id: string;
  /** Short label, e.g. "Follow-up Call — Jul 21" */
  label: string;
  raw_text: string;
  ai_summary_content?: Record<string, unknown> | null;
  ai_summary_model?: string | null;
  ai_summary_generated_at?: string | null;
  created_at: string;
  updated_at: string;
}

export const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  new: "New",
  intro_scheduled: "Intro Scheduled",
  intro_complete: "Intro Complete",
  considering: "Considering",
  converted: "Converted",
  declined: "Declined",
};

export const STATUS_LABELS: Record<ClientStatus, string> = {
  inquiry: "Inquiry",
  intake_scheduled: "Intake Scheduled",
  intake_complete: "Intake Complete",
  preparation: "In Preparation",
  preparation_complete: "Preparation Complete",
  journey_scheduled: "Journey Scheduled",
  journey_complete: "Journey Complete",
  check_in_complete: "12hr Check-In Complete",
  integration_1: "Integration 1 In Progress",
  integration_1_complete: "Integration 1 Complete",
  integration_2: "Integration 2 In Progress",
  integration_2_complete: "Integration 2 Complete",
  journey_closed: "Journey Closed",
  inactive: "Inactive",
};

// ---------------------------------------------------------------------------
// GOOGLE CALENDAR SYNC — two-way sync between Heartful OS and a practitioner's
// Google Calendar. A dedicated "Heartful OS" calendar is created in the
// practitioner's Google account on connect, so Sessions/ProspectCalls are
// mirrored there without cluttering their primary calendar. Their primary
// calendar is watched read-only (busy blocks only) purely for double-booking
// checks — see ExternalCalendarEvent below.
// ---------------------------------------------------------------------------

/** Singleton settings/token doc — stored at meta/googleCalendar */
export interface GoogleCalendarSettings {
  connected: boolean;
  connected_email?: string;
  access_token?: string;
  refresh_token?: string;
  token_expiry?: number; // epoch ms
  /** The dedicated "Heartful OS" calendar we create and push Sessions/ProspectCalls to */
  heartful_calendar_id?: string;
  /** The practitioner's primary calendar — watched read-only for conflict checks */
  primary_calendar_id?: string;
  /** Incremental sync tokens, one per watched calendar */
  heartful_sync_token?: string;
  primary_sync_token?: string;
  /** Push notification channel bookkeeping, one per watched calendar */
  heartful_channel_id?: string;
  heartful_channel_resource_id?: string;
  heartful_channel_expiration?: number; // epoch ms
  primary_channel_id?: string;
  primary_channel_resource_id?: string;
  primary_channel_expiration?: number; // epoch ms
  /** Shared secret Google echoes back on every webhook ping (X-Goog-Channel-Token) so we can verify it's really Google */
  webhook_token?: string;
  last_synced_at?: string;
  last_sync_error?: string;
}

/**
 * A busy block mirrored from the practitioner's primary Google Calendar that
 * did NOT originate in Heartful OS (i.e. a personal/other-app event). Used
 * to show "Busy" chips on the Calendar and to catch double-bookings when
 * scheduling a Session or ProspectCall — never linked to a client.
 */
export interface ExternalCalendarEvent {
  id: string;
  google_event_id: string;
  title: string;
  start_at: string;
  end_at?: string;
  all_day?: boolean;
  status: "confirmed" | "cancelled";
  updated_at: string;
}
