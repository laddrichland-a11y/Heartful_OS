# Heartful OS

Client journey management for psychedelic harm reduction specialists, preparation coaches, integration coaches, and transformational practitioners. Heartful OS tracks the full arc of a client's journey — intake, preparation, the supported session itself, post-journey check-ins, and integration — with AI-generated summaries at every milestone.

**This is not an EMR or medical records system.** It does not store diagnoses, treatment plans, or clinical documentation. It is built around transformation, preparation, support, integration, and accountability.

## Current state: running on mock data

This build ships fully wired and clickable against an in-memory mock dataset — five seeded demo clients at different journey stages, realistic documents, transcripts, AI summaries, tasks, and messages. No Supabase project or OpenAI key is required to explore every module. AI buttons fall back to deterministic mock generators when `OPENAI_API_KEY` is not set.

Check `/settings` in the app to see whether mock mode or real credentials are active.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll land on `/dashboard` as the practitioner. Use the role switcher in the top bar to view the app as a client in `/portal`.

## Project structure

- `src/app` — Next.js App Router routes (dashboard, clients, journey-phase workflows, portal, copilot, search, reports, settings).
- `src/components` — UI components, organized by domain (`client/`, `ai/`, `copilot/`, `reports/`, `layout/`, `ui/`).
- `src/lib/types.ts` — TypeScript types mirroring the Supabase schema.
- `src/lib/mock/` — seed data (`seed.ts`) and the in-memory store (`store.ts`) the app currently runs against.
- `src/lib/data.ts` — the data access layer every page/component calls. This is the **only** file that needs to change when wiring up real Supabase — all call sites stay the same.
- `src/lib/actions.ts` — Next.js Server Actions for mutations (uploads, form submissions, messages, tasks).
- `src/lib/ai/` — the AI prompt library (`prompts.ts`), the OpenAI wrapper with mock fallback (`generate.ts`), and deterministic mocks (`mocks.ts`).
- `src/app/api/ai/generate/route.ts` — single endpoint that dispatches all 9 AI summary types.
- `supabase/migrations/0001_init.sql` — full Postgres schema with RLS policies for practitioner vs. client-portal access.

## Connecting real Supabase + OpenAI

1. Create a Supabase project, then run the schema:
   ```bash
   supabase db push
   # or paste supabase/migrations/0001_init.sql into the SQL editor
   ```
2. Copy `.env.local.example` to `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   OPENAI_API_KEY=...
   ```
3. Replace the implementation inside `src/lib/mock/store.ts`-backed functions in `src/lib/data.ts` with real `@supabase/supabase-js` queries. Function signatures are intentionally identical to what real Supabase calls would return, so this is a mechanical swap, page by page.
4. Once `OPENAI_API_KEY` is set, `runAiJson` (in `src/lib/ai/generate.ts`) automatically calls `gpt-4o-mini` instead of returning mocks — no other code changes needed.

## Modules

- **Dashboard** — active clients, upcoming sessions, outstanding forms, journey status, revenue, referral sources.
- **Client Record** — profile, documents (12 types with version history), AI summaries, memory, messages.
- **Journey Workflow** — Intake & Assessment, Preparation, Harm Reduction Support Session (with structured timestamped notes), automatic Post-Journey Timeline, 12-Hour Check-In, Integration Sessions One & Two, Growth Action Plan.
- **Client Portal** — assigned forms/homework, action items, check-ins, growth action plan, secure messaging.
- **AI Copilot** — "Prepare Me For This Session" pre-session briefings and a living Journey Summary per client.
- **Search** — across clients, transcripts, session notes, themes, intentions, action items, insights.
- **Reports** — client/journey metrics, referral sources, revenue, charts.

## Design

Warm, grounded, non-clinical visual language (clay / sage / plum / ink palette) — closer to Notion or Fireflies than an EMR.
