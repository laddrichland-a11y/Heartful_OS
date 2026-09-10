# Heartful OS — App Audit
*June 2026 · Based on current codebase*

---

## How the App is Structured

Two distinct user types, completely separate UIs:

**Practitioner** (password-protected, `/dashboard` and beyond)
**Client** (email + password login, `/portal` only)

---

## Practitioner Navigation (Sidebar)

| Nav Item | What It Does |
|---|---|
| Dashboard | Overview: active clients, upcoming sessions, outstanding forms/tasks, messages, referral sources, AI Copilot shortcut |
| Clients | Full client list → individual client records |
| Calendar | Month view of all sessions; click a session to see detail + Prepare Me |
| AI Copilot | Global copilot: Next 30 days across all clients, Prepare Me by client, Living Journey Summary |
| Search | Full-text client search |
| Reports | Charts and stats |
| Settings | Profile, Venmo, Form Library |

**What's working:** Coverage is solid — all major practitioner workflows are reachable.

---

## Client Record Page (`/clients/[id]`)

### The Header
Name, status badge (manually adjustable), contact info, payment summary, portal account status, emergency contact, milestone progress bar, intro email button, delete client button.

Below the progress bar: **6 phase pills** — Intake, Preparation, Journey Day, 12hr Check-In, Integration 1, Integration 2. The current phase is highlighted in orange. Each pill links to a dedicated phase workspace page.

### The Action Card
Smart tile row that shows only what's currently relevant:
- **Upcoming Sessions** — future-only, links to session detail pages
- **Outstanding Forms** — missing or in-progress forms with templates
- **Open Tasks** — not completed, not past-due, links to task detail pages
- **Portal Assignments** — incomplete homework/exercises

This disappears entirely if nothing is pending. Works well.

### The 6 Tabs

| Tab | What's Inside |
|---|---|
| **Documents** | All forms grouped by journey stage (Intake, Preparation, Integration 1, Integration 2), plus uploaded PDFs. Each form row opens the full fillable form. |
| **Sessions** | Left column: full session history + Schedule button + Prepare Me + Complete/Cancel per session. Right column: all tasks. |
| **Journey & AI** | All AI-generated summaries (assessment, journey brief, etc.) + Memory items + Preparation plan |
| **AI Copilot** | All sessions in chronological order with Prepare Me buttons + hide/finish controls + past briefings + stage-relevant forms |
| **Messages** | Practitioner ↔ client messaging thread; marks unread on open |
| **History** | Complete chronological activity log: every session, document, form, message, task, check-in, milestone, AI summary |

### Phase Workspace Pages (from the header pills)
- `/clients/[id]/intake` — Intake-specific workspace
- `/clients/[id]/preparation` — Preparation workspace
- `/clients/[id]/journey-day` — Journey Day workspace
- `/clients/[id]/check-in` — 12-hour check-in workspace
- `/clients/[id]/integration-1` — Integration 1 workspace
- `/clients/[id]/integration-2` — Integration 2 workspace

### Detail Pages
- `/clients/[id]/sessions/[sessionId]` — Session detail: Prepare Me, Mark Complete/Cancel, past briefings, related forms
- `/clients/[id]/tasks/[taskId]` — Task detail: title, description, due date, Mark Complete

---

## Client Portal (`/portal`)

| Tab | What's Inside |
|---|---|
| **Home** | Journey progress bar + Action Items (pending tasks, assignments, incomplete forms) |
| **Appointments** | Upcoming and past sessions |
| **Forms & Check-Ins** | Required forms (fillable), assigned homework, 12-hour check-in form |
| **Growth & Integration** | Growth Action Plan (appears after Integration 2) |
| **Messages** | Chat with practitioner |

---

## Journey Flow

The journey moves through statuses, which map to phases:

```
inquiry → intake_scheduled → intake_complete
  → preparation → preparation_complete
  → journey_scheduled → journey_complete
  → check_in_complete
  → integration_1 → integration_1_complete
  → integration_2 → integration_2_complete
  → journey_closed
```

Sessions are typed separately from phases:
`intake_assessment`, `preparation`, `harm_reduction_support`, `check_in_12hr`, `integration_1`, `integration_2`, `other`

---

## Issues & Recommendations

### 🔴 High Priority — Causes Real Confusion

**1. "AI Copilot" means three different things**

There are three distinct AI surfaces, two of which are named nearly identically:
- Sidebar → *AI Copilot* = global, all clients, 3 tools
- Client record tab → *AI Copilot* = per-client, session prep focused
- Client record tab → *Journey & AI* = per-client, saved AI summaries

A practitioner clicking "AI Copilot" in the sidebar gets a completely different tool than the "AI Copilot" tab inside a client record. The distinction isn't explained anywhere on screen.

**Suggested fix:**
- Rename the sidebar page to **"Copilot"** or **"Prep Center"**
- Rename the client tab from "AI Copilot" to **"Session Prep"**
- Keep "Journey & AI" as-is, or rename to **"AI Notes"** or **"Insights"**

---

**2. "Prepare Me" button appears in 5 different places**

| Location | Context |
|---|---|
| Global AI Copilot page | Pick client → pick session → generate |
| Calendar → session detail panel | Click session on calendar |
| Sessions tab (client record) | Inline on each session row |
| AI Copilot tab (client record) | Inline on each session row |
| Session detail page | Top of the page |

This isn't necessarily wrong — it's designed for convenience — but it means a briefing can be accidentally generated multiple times and pile up. The delete button (just added) helps. Consider whether the Sessions tab and AI Copilot tab both need it, or whether one tab could "own" it.

---

### 🟡 Medium Priority — Worth Addressing

**3. Sessions tab and AI Copilot tab are redundant in unclear ways**

Both tabs show a list of sessions. The difference:
- **Sessions tab** adds: the Schedule form, Complete/Cancel buttons, Tasks in the right column
- **AI Copilot tab** adds: hide/finish copilot state, past briefings, stage-relevant forms

A practitioner trying to "manage sessions" would go to Sessions. A practitioner trying to "prepare for sessions" would go to AI Copilot. But these aren't labeled that way — it's only clear after using both.

**Suggested fix:** Add a 1-line description at the top of each tab: *"Schedule and manage sessions for this client."* vs. *"Prepare for upcoming sessions using AI briefings."*

---

**4. Session type labels are inconsistent in the Sessions tab**

The Sessions tab shows session type as `s.session_type.replace(/_/g, " ")` — raw string with underscores swapped for spaces. Every other surface (AI Copilot tab, session detail page, action card) uses `SESSION_TYPE_LABELS` which has proper labels like "Intake & Assessment" and "Harm Reduction Support Session."

Result: the Sessions tab says "harm reduction support" while the session detail page says "Harm Reduction Support Session."

**Fix:** One-line change in SessionsTab — replace the raw string with `SESSION_TYPE_LABELS[s.session_type] ?? s.session_type`.

---

**5. Dashboard "Upcoming Sessions" links to the client page, not the session**

On the dashboard, clicking an upcoming session goes to `/clients/[client_id]` (the client's homepage, defaulting to the Documents tab). It should go to the session detail page or at least open the Sessions tab.

**Suggested fix:** Link to `/clients/${s.client_id}/sessions/${s.id}` — or at minimum `/clients/${s.client_id}?tab=Sessions`.

---

**6. Dashboard "Outstanding Forms & Tasks" links too broadly**

Same issue — clicking a task on the dashboard goes to the client page, not the task or the Documents tab. The practitioner has to then hunt for it.

**Suggested fix:** For tasks, link to `/clients/${t.client_id}/tasks/${t.id}`. For forms, link to `/clients/${t.client_id}?tab=Documents`.

---

**7. Phase pills are always visible regardless of where a client is in the journey**

The 6 phase pills (Intake through Integration 2) are shown for every client, including brand-new inquiry clients who haven't even had an intake yet. Only the current phase is highlighted, but all 6 are always clickable.

This isn't harmful but can create confusion — clicking "Integration 2" for a client who just had their intake opens an Integration 2 workspace with nothing in it.

**Optional improvement:** Gray out or hide phase pills for stages the client hasn't reached yet.

---

**8. No UI to create Portal Assignments**

Portal Assignments (homework, journaling prompts, exercises sent to the client) are visible in the Action Card tile and in the portal itself — but there's no screen in the practitioner UI where you can create or edit them. They only appear if seeded in the database.

**This is a real feature gap.** Practitioners can send messages but can't currently assign homework from within the app.

---

**9. 48-hour check-in is defined but never surfaced**

`CheckIn.check_in_type` has two values: `"12_hour"` and `"48_hour_reflection"`. Only the 12-hour check-in is shown anywhere (portal, practitioner workspaces). The 48-hour reflection exists in the data model but is orphaned.

Either remove it from the type or build the UI for it.

---

### 🟢 Working Well — No Action Needed

- **Action Card** — smart filtering (future sessions, open tasks), live links, disappears when empty. Clean.
- **History tab** — complete audit trail, clickable links to sessions/forms. Very useful for understanding a client at a glance.
- **Documents tab** — forms grouped by journey stage is logical and matches how a practitioner actually works through a case.
- **Milestone progress bar** — clear visual of where a client is in the journey.
- **Portal separation** — the client portal is well-isolated. Clients can only see their own data; the practitioner-preview mode is properly flagged.
- **AI summary delete** — just added; lets practitioners clean up accidental duplicates.
- **Copilot hide/finish** — the session-level hide and finish controls on the AI Copilot tab are a smart practitioner workflow tool.
- **Messages unread badge** — the sidebar badge and 20-second polling are working.
- **Deep link tab switching** — `?tab=X` URL params now properly switch the active tab even when the component is already mounted.

---

## Summary Scorecard

| Area | Status | Notes |
|---|---|---|
| Navigation coverage | ✅ Good | All major views reachable |
| AI surface naming | ⚠️ Confusing | 3 things called "AI Copilot" / "AI" |
| Prepare Me placement | ⚠️ Over-placed | 5 locations; delete helps |
| Session tab labels | ⚠️ Inconsistent | Raw strings vs proper labels |
| Dashboard links | ⚠️ Too broad | Should go to task/session detail |
| Phase workspace access | ✅ Good | Pills in header are clear |
| Client portal | ✅ Good | Clean and well-separated |
| Journey flow logic | ✅ Good | Status → phase mapping is solid |
| Portal assignments | ❌ Gap | No UI to create them |
| 48-hour check-in | ❌ Orphaned | In type system, never surfaced |
| AI summary cleanup | ✅ Fixed | Delete buttons just added |
| History / audit trail | ✅ Good | Comprehensive and clickable |
