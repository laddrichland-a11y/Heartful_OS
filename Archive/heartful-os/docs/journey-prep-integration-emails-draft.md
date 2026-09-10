# Journey Prep Email — Draft (v2, combined)

One client-facing email, sent **two days before** a scheduled session,
combining prep instructions with aftercare guidance — since clients are
asked to stay off screens the evening of their session, they wouldn't be
able to read a separate "day after" email anyway, so everything they need
is delivered up front instead.

Written to match the tone and format already used in `buildIntroEmail` /
`buildProspectSummaryEmail` (`src/lib/emailTemplates.ts`): plain text,
ALL-CAPS section labels, first-name greeting, warm sign-off. Bracketed
`{fields}` are merge variables to wire up when we code
`buildJourneyPrepEmail()`.

**Trigger idea:** sent (manually, via the same "open in mail app" pattern as
the intro email — no auto-send) two days before a scheduled session.

**Merge fields used:** `{clientFirstName}`, `{sessionDate}`, `{sessionTime}`,
`{arrivalTime}`, `{followUpDate}`, `{practitionerName}`, `{practiceName}`

**Subject:** `Preparing for Your Session on {sessionDate}`

**Body:**

```
Hi {clientFirstName},

Your session is scheduled for {sessionDate} at {sessionTime} — just two
days from now. Since I'll be asking you to stay off screens for the rest of
that evening, I'm sending everything you need now: how to prepare over the
next two days, and what to expect afterward.

HYDRATION
Stay well hydrated over the next two days, especially the day before your
session — don't try to catch up right before we meet. Ease off caffeine
after midday the day before, and skip alcohol entirely starting then.

FOOD
Eat normally over the next couple of days, keeping meals light and easy to
digest — especially your last meal the night before your session. Avoid
anything heavy, greasy, or rich that evening. On the morning of your
session, follow the specific eating guidance we discussed. If you're unsure
what that means for you, reach out rather than guessing.

SLEEP
Aim for a full night's sleep the night before your session — 7 to 9 hours
if you can. Wind down earlier than usual that evening: dim the lights, put
screens away at least 30–60 minutes before bed, and steer clear of anything
emotionally heavy (work stress, difficult conversations, heavy news).

MEDICATIONS
Continue any regular medications as prescribed unless we've specifically
discussed otherwise. Please avoid alcohol and any recreational substances
for at least 24 hours before we meet.

WHAT TO BRING / WEAR
Comfortable clothing you can relax and move in. Bring a journal. Anything
else that helps you feel grounded — entirely optional.

SETTING YOUR INTENTION
Review your planning session(s) in the client portal, then take a few quiet
minutes to sit with what's bringing you here — what you're hoping to
explore, understand, or let go of. It doesn't need to be polished, just
honest.

LOGISTICS
Please arrive by {arrivalTime} on {sessionDate} so we have time to settle
in before we begin. Plan for someone else to get you home afterward rather
than driving yourself.

AFTER YOUR SESSION
Since you won't be looking at your phone or email that evening, here's what
to know now, ahead of time.

FOR THE REST OF THAT EVENING
Keep the evening quiet and unstructured, and avoid screens — phone, TV,
computer — for the rest of the night.

Why: scrolling and notifications pull your attention back outward right
when your mind is still settling and organizing what came up. A quiet,
low-stimulation evening protects that process, and tends to make what you
experienced easier to hold onto and make sense of later, instead of getting
crowded out by noise.

Eat something light and nourishing when you're hungry, drink water, and
rest. Feeling tired, tender, or a little "spacey" that night is normal —
let yourself have an easy evening.

WHAT TO EXPECT IN THE DAYS AHEAD
Everyone's experience is different, but common in the days that follow:
- Vivid dreams, or unusually clear dream recall
- Emotional sensitivity — things sitting closer to the surface than usual
- A sense of clarity or "afterglow," sometimes followed by a dip a day or
  two later as things settle — this is normal and typically passes on its
  own
- Physical tiredness, even after a full night's sleep
- New thoughts or connections surfacing at unexpected moments over the
  next several days to weeks

None of this needs fixing — it's part of how the experience continues to
settle and integrate.

INTEGRATION PRACTICES
- Journal, even a few lines, about what stood out — you don't need to
  interpret it yet, just capture it
- Spend time outside and move your body gently
- Hold off on major decisions (ending relationships, big purchases, career
  changes) for at least a few weeks — let things settle before acting on them
- Talk about your experience with people you trust, at whatever pace feels
  right to you

WHEN TO REACH OUT
If you're feeling overwhelmed, distressed, or something feels off —
physically or emotionally — reach out to me directly rather than waiting
for our next scheduled check-in.

OUR NEXT CONVERSATION
We'll plan to check in on {followUpDate} to talk through what came up and
support you in integrating it. Until then, be gentle with yourself.

If anything comes up between now and your session, reach out any time.

Warmly,
{practitionerName}
{practiceName}
```

---

## Notes for the coding pass

- One function now, not two: `buildJourneyPrepEmail(input)` in
  `src/lib/emailTemplates.ts`, returning `{ subject, body }` — same shape as
  `buildIntroEmail` / `buildProspectSummaryEmail`.
- Reuse the `IntroEmailModal` component shape (editable subject/body,
  "Copy Text" + "Open in Mail App," no auto-send) rather than a new modal —
  a shared generic `EmailModal` would work well now that there are three of
  these using an identical pattern.
- `{sessionDate}` / `{sessionTime}` pull from the `Session`'s
  `scheduled_at`. `{arrivalTime}` = `scheduled_at` minus a configurable
  buffer (e.g. 15 min — let me know what buffer you actually use).
  `{followUpDate}` pulls from the next scheduled session/call for that
  client if one exists, otherwise falls back to generic phrasing ("in the
  next few days").
- For the "two days before" timing: since Heartful OS never auto-sends
  email (everything routes through "open in mail app" / copy), the
  practical version of this is a **reminder**, not an auto-send — e.g. a
  small addition to the existing daily Netlify scheduled function (the same
  one that renews the Google Calendar watch channel) that checks for
  sessions happening in exactly 2 days and surfaces a "Prep email ready to
  send — {clientName}, session on {sessionDate}" prompt somewhere visible
  (dashboard banner, or a badge on the client/session row) so you don't
  have to remember to check manually.
