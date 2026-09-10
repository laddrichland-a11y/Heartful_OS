# Heartful OS — Promo Capture Set
**24 PNGs · 3200 × 1800 (2× retina) · captured 2026-09-05**

Stills, not video. Drop them into Canva on a 1920 × 1080 video timeline and animate each one with a slow **pan/zoom (Ken Burns)** move — that reads as motion without any of the cursor jitter a screen recording would have. Every file is 2× the timeline resolution, so you have room to push in ~40% before anything softens.

Hero client throughout: **Marcus Webb**, Integration 1, 4/8 milestones. Fictional seed data — no real client information in any frame.

---

## Which file goes where in the 3:00 cut

| Time | Length | File | On-screen text | Move |
|---|---|---|---|---|
| 0:00 | 6s | *title card* | *Your practice isn't a series of 50-minute appointments.* | — |
| 0:06 | 6s | *title card* | *It's a journey. It has a shape.* | — |
| 0:12 | 12s | `04-phase-pills.png` | *Intake. Preparation. Journey Day. Check-In. Integration.* | slow pan left → right |
| 0:24 | 5s | *title card* | *Today that shape lives in Google Docs, texts, and paper forms.* | — |
| 0:29 | 10s | `01-dashboard.png` | *This is your morning. The work surfaces itself.* | slow push in |
| 0:39 | 5s | `02-clients-list.png` | — | slow push in |
| 0:44 | 10s | `03-client-header.png` | *One screen. No hunting.* | hold, very slight push |
| 0:54 | 8s | `05-phase-workspace.png` | *Every phase gets its own workspace.* | slow push in |
| 1:02 | 8s | `06-action-card.png` | *Only what's pending. Nothing else.* | hold (already a tight crop) |
| 1:10 | 10s | `07-documents-tab.png` | *Forms grouped the way you actually work a case.* | slow pan down |
| 1:20 | 8s | `11-calendar.png` | — | slow push in |
| 1:28 | 4s | *title card* | *And then there's the part you don't have time for.* | — |
| 1:32 | 20s | `08b-prepare-me-briefing.png` ⚠️ | *Prep for your next session — written from this client's full history.* | slow pan down |
| 1:52 | 10s | `09-journey-summary.png` | *Not a chatbot. It knows the phase, the session, the arc.* | slow push in |
| 2:02 | 12s | `10b-history-fullpage.png` | *Every session, form, message, and milestone. One record.* | **slow pan top → bottom** |
| 2:14 | 4s | *title card* | *Your client sees the same journey.* | — |
| 2:18 | 10s | `12-portal-home.png` | *Their portal. Their progress.* | slow push in |
| 2:28 | 12s | `13-portal-checkin.png` | *The 12-hour check-in — captured, not missed.* | slow pan down |
| 2:40 | 8s | `14-portal-messages.png` | *One thread. Both sides.* | hold |
| 2:48 | 6s | *title card* | *The journey has a shape. Heartful OS is built around it.* | — |
| 2:54 | 6s | logo + CTA | *[your URL] — book a walkthrough* | — |

`10b-history-fullpage.png` is a single tall image of the entire activity log. Pan down it over the full 12 seconds — that one move is the most persuasive shot in the video, because a real audit trail can't be faked.

---

## ⚠️ One shot you need to re-take yourself

**`08b-prepare-me-briefing.png` — the Prepare Me briefing.**

I captured this from a credential-free instance, so the AI had no API key and fell back to the built-in placeholder text: *"Their stated goals and motivations for this work."* The framing and layout are right, but the words are generic — and a generic briefing actively undercuts the exact claim the shot is making.

Re-take this one on the live site, where the real key is set and the briefing draws on the client's actual history. Open the client → **Sessions** → the upcoming **Integration 1** session → **Prepare Me**, and screenshot once the briefing renders. Use this file as the composition reference.

Everything else in the set is production-ready.

---

## Alternates included

| File | Use it when |
|---|---|
| `07b-documents-full.png` | full-page Documents — pan instead of the viewport crop |
| `08a-session-detail.png` | session detail *before* Prepare Me — good as a 2s setup beat |
| `08c-prepare-me-full.png` | full-page version of the briefing |
| `09b-journey-full.png` | full-page Journey & AI |
| `10-history-tab.png` | viewport History, if the tall pan feels too long |
| `12a-portal-welcome.png` | the portal's "You're all set, Marcus" welcome — a warmer opener for the portal section |
| `12b-portal-home-full.png` | full-page portal Home |
| `13a-portal-forms.png` | the signed-agreements list — good if you want a "paperwork is done" beat |
| `13b-portal-checkin-full.png` | full-page check-in |
| `15-portal-appointments.png` | spare portal B-roll |

---

## Canva setup

1. **Create design → Video → 1920 × 1080.**
2. Brand Kit colors, pulled from your logo: terracotta `#b5663f`, ink `#2b2420`, warm sand `#f3e6d8`, off-white `#fbf5ef`, muted `#948572`.
3. Title-card background: `Loom Backgrounds/Heartful-OS-Loom-BG-1920x1080-logo-left.png` from the project folder.
4. Captions in the lower third, warm-sand rounded rectangle at ~90% opacity behind the text, **same position on every slide**.
5. Every transition: **Dissolve, 0.3s** — no exceptions, no mixing.
6. Music at 15–20%, fading out over the last 3 seconds.
7. Export: **MP4, 1080p.**

Full shot-by-shot reasoning is in *Heartful OS — Promo Video Capture Guide.md* in the project folder.

---

## Two notes on how these were made

- Captured against a local instance running the **mock seed data** with no Firebase and no API key — that's why the clients are Maya/Marcus/Priya/Sarah/Daniel rather than anyone real.
- The seeded mock store leaves every form "Not Started" because it never creates submission records. I patched that in my throwaway copy only so the agreements read **Signed**. **Your repo was not touched.** If the live site also shows agreements as Not Started for demo clients, that's the same gap, and it's worth a look before you record anything live.
