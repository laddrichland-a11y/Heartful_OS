-- ============================================================================
-- HEARTFUL OS — Core Database Schema
-- A client journey management platform for psychedelic harm reduction
-- specialists, preparation coaches, integration coaches, and
-- transformational practitioners.
--
-- This is NOT an EMR / medical records system. All data models below treat
-- client information as journey/coaching data, not clinical/medical records.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------------
create type user_role as enum ('practitioner', 'admin', 'client');

create type client_status as enum (
  'inquiry',
  'intake_scheduled',
  'intake_complete',
  'preparation',
  'preparation_complete',
  'journey_scheduled',
  'journey_complete',
  'check_in_complete',
  'integration_1',
  'integration_1_complete',
  'integration_2',
  'integration_2_complete',
  'journey_closed',
  'inactive'
);

create type journey_phase as enum (
  'intake',
  'preparation',
  'harm_reduction_session',
  'post_journey_check_in',
  'integration_1',
  'integration_2',
  'closed'
);

create type document_type as enum (
  'health_history',
  'informed_consent',
  'harm_reduction_services_agreement',
  'client_services_agreement',
  'preparation_navigation_plan',
  'post_integration_form',
  'post_integration_form_updated',
  'session_notes',
  'journey_brief',
  'integration_summary_1',
  'integration_summary_2',
  'growth_action_plan',
  'other'
);

create type session_type as enum (
  'intake_assessment',
  'preparation',
  'harm_reduction_support',
  'check_in_12hr',
  'integration_1',
  'integration_2',
  'other'
);

create type task_status as enum ('pending', 'in_progress', 'completed', 'skipped', 'overdue');

create type message_sender as enum ('practitioner', 'client', 'system');

-- ---------------------------------------------------------------------------
-- PROFILES (extends Supabase auth.users)
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'client',
  full_name text not null,
  email text not null,
  phone text,
  avatar_url text,
  practice_name text,            -- for practitioners
  title text,                    -- e.g. "Integration Coach", "Harm Reduction Specialist"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- REFERRAL SOURCES
-- ---------------------------------------------------------------------------
create table referral_sources (
  id uuid primary key default uuid_generate_v4(),
  practitioner_id uuid not null references profiles(id) on delete cascade,
  name text not null,            -- e.g. "Word of Mouth", "Psychedelic.support", "Dr. Jane Smith"
  category text,                 -- e.g. "Professional Referral", "Web", "Returning Client"
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- CLIENTS — the central journey record
-- ---------------------------------------------------------------------------
create table clients (
  id uuid primary key default uuid_generate_v4(),
  practitioner_id uuid not null references profiles(id) on delete cascade,
  portal_user_id uuid references profiles(id) on delete set null, -- linked client-portal auth user

  full_name text not null,
  email text,
  phone text,
  date_of_birth date,
  address text,

  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,

  referral_source_id uuid references referral_sources(id) on delete set null,

  status client_status not null default 'inquiry',
  current_phase journey_phase not null default 'intake',

  notes text,

  -- billing / revenue
  package_name text,
  package_value numeric(10,2),
  amount_paid numeric(10,2) default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_clients_practitioner on clients(practitioner_id);
create index idx_clients_status on clients(status);

-- ---------------------------------------------------------------------------
-- JOURNEY MILESTONES — drives the Journey Progress Bar
-- ---------------------------------------------------------------------------
create table journey_milestones (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  milestone_key text not null,        -- e.g. 'intake_complete', 'preparation_complete', 'journey_complete', 'check_in_12hr_complete', 'integration_1_complete', 'integration_2_complete', 'journey_closed'
  label text not null,
  sort_order int not null,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id, milestone_key)
);

create index idx_milestones_client on journey_milestones(client_id);

-- ---------------------------------------------------------------------------
-- DOCUMENTS — secure storage areas with version history
-- (file_url points to Supabase Storage object path)
-- ---------------------------------------------------------------------------
create table documents (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  document_type document_type not null,
  title text not null,
  current_version_id uuid,           -- fk set after first version inserted
  required boolean not null default true,
  status text not null default 'missing', -- missing | uploaded | signed | reviewed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table document_versions (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid not null references documents(id) on delete cascade,
  version_number int not null,
  file_url text not null,             -- storage path
  file_name text not null,
  file_size_bytes bigint,
  mime_type text,
  uploaded_by uuid references profiles(id),
  uploaded_by_role user_role,
  notes text,
  created_at timestamptz not null default now()
);

alter table documents
  add constraint fk_documents_current_version
  foreign key (current_version_id) references document_versions(id) on delete set null;

create index idx_documents_client on documents(client_id);
create index idx_document_versions_document on document_versions(document_id);

-- ---------------------------------------------------------------------------
-- SESSIONS — scheduled/completed sessions across all phases
-- ---------------------------------------------------------------------------
create table sessions (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  practitioner_id uuid not null references profiles(id) on delete cascade,
  session_type session_type not null,
  scheduled_at timestamptz,
  duration_minutes int,
  status text not null default 'scheduled', -- scheduled | completed | cancelled | no_show
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_sessions_client on sessions(client_id);
create index idx_sessions_practitioner_time on sessions(practitioner_id, scheduled_at);

-- ---------------------------------------------------------------------------
-- TRANSCRIPTS & RECORDINGS
-- ---------------------------------------------------------------------------
create table transcripts (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  source text not null default 'paste', -- paste | upload
  file_url text,
  raw_text text,
  created_at timestamptz not null default now()
);

create table recordings (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  file_url text not null,
  file_name text,
  duration_seconds int,
  created_at timestamptz not null default now()
);

create index idx_transcripts_client on transcripts(client_id);
create index idx_recordings_client on recordings(client_id);

-- ---------------------------------------------------------------------------
-- AI SUMMARIES — polymorphic summary store for all AI-generated artifacts
-- ---------------------------------------------------------------------------
create type ai_summary_type as enum (
  'client_assessment_summary',
  'journey_brief',
  'journey_summary',
  'check_in_12hr_summary',
  'integration_1_brief',
  'integration_summary',
  'growth_action_plan',
  'prepare_me_briefing',
  'living_journey_summary'
);

create table ai_summaries (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  summary_type ai_summary_type not null,
  title text not null,
  content jsonb not null,        -- structured sections, see lib/ai/prompts.ts for shape
  model text,
  source_transcript_id uuid references transcripts(id) on delete set null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_ai_summaries_client on ai_summaries(client_id);
create index idx_ai_summaries_type on ai_summaries(client_id, summary_type);

-- ---------------------------------------------------------------------------
-- CLIENT MEMORY — longitudinal structured memory (intentions, themes, etc.)
-- ---------------------------------------------------------------------------
create type memory_item_type as enum (
  'intention', 'insight', 'theme', 'challenge', 'breakthrough', 'commitment', 'action_item', 'integration_outcome'
);

create table client_memory_items (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  item_type memory_item_type not null,
  content text not null,
  source_summary_id uuid references ai_summaries(id) on delete set null,
  phase journey_phase,
  status text default 'open', -- open | in_progress | resolved | carried_forward
  created_at timestamptz not null default now()
);

create index idx_memory_client on client_memory_items(client_id, item_type);

-- ---------------------------------------------------------------------------
-- HARM REDUCTION SESSION NOTES — timestamped structured note-taking
-- ---------------------------------------------------------------------------
create type session_note_field as enum (
  'observation', 'significant_moment', 'client_request', 'safety_note', 'integration_theme'
);

create table session_notes (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  field_type session_note_field not null,
  note_timestamp timestamptz not null default now(),
  elapsed_minutes numeric(6,2),     -- minutes since session start, for the 8-hr timeline
  content text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_session_notes_session on session_notes(session_id, note_timestamp);

-- ---------------------------------------------------------------------------
-- PREPARATION NAVIGATION PLAN — editable structured sections
-- ---------------------------------------------------------------------------
create table preparation_plans (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade unique,
  intentions text,
  desired_outcomes text,
  fears text,
  support_systems text,
  preparation_practices text,
  mindset_considerations text,
  environmental_considerations text,
  navigation_strategies text,
  integration_priorities text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- CHECK-INS — 12-hour check-in (and future check-ins)
-- ---------------------------------------------------------------------------
create table check_ins (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  check_in_type text not null default '12_hour', -- 12_hour | 48_hour_reflection
  emotional_state text,
  physical_state text,
  immediate_insights text,
  support_needs text,
  safety_concerns text,
  submitted_by user_role,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_check_ins_client on check_ins(client_id);

-- ---------------------------------------------------------------------------
-- POST INTEGRATION FORMS
-- ---------------------------------------------------------------------------
create table post_integration_forms (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  integration_session int not null, -- 1 or 2
  responses jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_pif_client on post_integration_forms(client_id);

-- ---------------------------------------------------------------------------
-- GROWTH ACTION PLANS (structured, separate from ai_summaries for portal use)
-- ---------------------------------------------------------------------------
create table growth_action_plans (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  ai_summary_id uuid references ai_summaries(id) on delete set null,
  thirty_day_commitments jsonb default '[]'::jsonb,
  behavioral_experiments jsonb default '[]'::jsonb,
  daily_practices jsonb default '[]'::jsonb,
  reflection_questions jsonb default '[]'::jsonb,
  accountability_commitments jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- TASKS / REMINDERS — outstanding forms, auto-created post-journey timeline
-- ---------------------------------------------------------------------------
create table tasks (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  practitioner_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  task_type text,            -- form | reminder | reflection | session_prep | follow_up
  due_at timestamptz,
  status task_status not null default 'pending',
  assigned_to user_role not null default 'practitioner',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_tasks_client on tasks(client_id);
create index idx_tasks_practitioner_status on tasks(practitioner_id, status, due_at);

-- ---------------------------------------------------------------------------
-- MESSAGES — secure practitioner <-> client messaging
-- ---------------------------------------------------------------------------
create table messages (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  sender user_role not null,
  sender_id uuid references profiles(id),
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_messages_client on messages(client_id, created_at);

-- ---------------------------------------------------------------------------
-- PORTAL ASSIGNMENTS — homework, journaling prompts, integration exercises
-- ---------------------------------------------------------------------------
create table portal_assignments (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  assignment_type text not null, -- form | homework | journaling_prompt | integration_exercise | action_item
  title text not null,
  description text,
  content jsonb,
  status task_status not null default 'pending',
  due_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_portal_assignments_client on portal_assignments(client_id, status);

-- ---------------------------------------------------------------------------
-- REVENUE / PAYMENTS (lightweight, for reporting)
-- ---------------------------------------------------------------------------
create table payments (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  amount numeric(10,2) not null,
  paid_at date not null default current_date,
  method text,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_payments_client on payments(client_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table profiles enable row level security;
alter table referral_sources enable row level security;
alter table clients enable row level security;
alter table journey_milestones enable row level security;
alter table documents enable row level security;
alter table document_versions enable row level security;
alter table sessions enable row level security;
alter table transcripts enable row level security;
alter table recordings enable row level security;
alter table ai_summaries enable row level security;
alter table client_memory_items enable row level security;
alter table session_notes enable row level security;
alter table preparation_plans enable row level security;
alter table check_ins enable row level security;
alter table post_integration_forms enable row level security;
alter table growth_action_plans enable row level security;
alter table tasks enable row level security;
alter table messages enable row level security;
alter table portal_assignments enable row level security;
alter table payments enable row level security;

-- Helper: is the requester the practitioner who owns this client?
create or replace function is_owning_practitioner(target_client_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from clients c
    where c.id = target_client_id and c.practitioner_id = auth.uid()
  );
$$;

-- Helper: is the requester the linked client-portal user for this client?
create or replace function is_linked_client(target_client_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from clients c
    where c.id = target_client_id and c.portal_user_id = auth.uid()
  );
$$;

-- profiles: users can see/update their own profile; practitioners can see client profiles linked to their clients
create policy "profiles_self" on profiles for select using (id = auth.uid());
create policy "profiles_self_update" on profiles for update using (id = auth.uid());

-- clients: practitioner full access to own clients; linked client can read their own record
create policy "clients_practitioner_all" on clients for all
  using (practitioner_id = auth.uid()) with check (practitioner_id = auth.uid());
create policy "clients_client_read" on clients for select
  using (portal_user_id = auth.uid());

-- generic pattern applied to all client-scoped tables: practitioner owns via clients.practitioner_id,
-- client can read/write their own portal-relevant rows.
create policy "milestones_practitioner" on journey_milestones for all
  using (is_owning_practitioner(client_id)) with check (is_owning_practitioner(client_id));
create policy "milestones_client_read" on journey_milestones for select
  using (is_linked_client(client_id));

create policy "documents_practitioner" on documents for all
  using (is_owning_practitioner(client_id)) with check (is_owning_practitioner(client_id));
create policy "documents_client_read" on documents for select
  using (is_linked_client(client_id));

create policy "doc_versions_practitioner" on document_versions for all
  using (is_owning_practitioner((select client_id from documents d where d.id = document_id)))
  with check (is_owning_practitioner((select client_id from documents d where d.id = document_id)));

create policy "sessions_practitioner" on sessions for all
  using (practitioner_id = auth.uid()) with check (practitioner_id = auth.uid());
create policy "sessions_client_read" on sessions for select
  using (is_linked_client(client_id));

create policy "transcripts_practitioner" on transcripts for all
  using (is_owning_practitioner(client_id)) with check (is_owning_practitioner(client_id));

create policy "recordings_practitioner" on recordings for all
  using (is_owning_practitioner(client_id)) with check (is_owning_practitioner(client_id));

create policy "ai_summaries_practitioner" on ai_summaries for all
  using (is_owning_practitioner(client_id)) with check (is_owning_practitioner(client_id));
create policy "ai_summaries_client_read" on ai_summaries for select
  using (is_linked_client(client_id));

create policy "memory_practitioner" on client_memory_items for all
  using (is_owning_practitioner(client_id)) with check (is_owning_practitioner(client_id));

create policy "session_notes_practitioner" on session_notes for all
  using (is_owning_practitioner(client_id)) with check (is_owning_practitioner(client_id));

create policy "prep_plans_practitioner" on preparation_plans for all
  using (is_owning_practitioner(client_id)) with check (is_owning_practitioner(client_id));
create policy "prep_plans_client_read" on preparation_plans for select
  using (is_linked_client(client_id));

create policy "check_ins_practitioner" on check_ins for all
  using (is_owning_practitioner(client_id)) with check (is_owning_practitioner(client_id));
create policy "check_ins_client_write" on check_ins for insert
  using (is_linked_client(client_id)) with check (is_linked_client(client_id));
create policy "check_ins_client_read" on check_ins for select
  using (is_linked_client(client_id));

create policy "pif_practitioner" on post_integration_forms for all
  using (is_owning_practitioner(client_id)) with check (is_owning_practitioner(client_id));
create policy "pif_client_write" on post_integration_forms for insert
  using (is_linked_client(client_id)) with check (is_linked_client(client_id));
create policy "pif_client_read" on post_integration_forms for select
  using (is_linked_client(client_id));

create policy "gap_practitioner" on growth_action_plans for all
  using (is_owning_practitioner(client_id)) with check (is_owning_practitioner(client_id));
create policy "gap_client_read" on growth_action_plans for select
  using (is_linked_client(client_id));

create policy "tasks_practitioner" on tasks for all
  using (practitioner_id = auth.uid()) with check (practitioner_id = auth.uid());
create policy "tasks_client_read" on tasks for select
  using (is_linked_client(client_id));

create policy "messages_practitioner" on messages for all
  using (is_owning_practitioner(client_id)) with check (is_owning_practitioner(client_id));
create policy "messages_client_all" on messages for all
  using (is_linked_client(client_id)) with check (is_linked_client(client_id));

create policy "portal_assignments_practitioner" on portal_assignments for all
  using (is_owning_practitioner(client_id)) with check (is_owning_practitioner(client_id));
create policy "portal_assignments_client_read" on portal_assignments for select
  using (is_linked_client(client_id));
create policy "portal_assignments_client_update" on portal_assignments for update
  using (is_linked_client(client_id));

create policy "payments_practitioner" on payments for all
  using (is_owning_practitioner(client_id)) with check (is_owning_practitioner(client_id));

create policy "referral_sources_practitioner" on referral_sources for all
  using (practitioner_id = auth.uid()) with check (practitioner_id = auth.uid());

-- ============================================================================
-- DEFAULT JOURNEY MILESTONE TEMPLATE (applied via app logic on client creation)
-- Keys: intake_complete, preparation_complete, journey_complete,
--       check_in_12hr_complete, integration_1_complete, integration_2_complete,
--       journey_closed
-- ============================================================================
