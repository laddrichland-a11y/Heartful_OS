// Plain-text templates for client-facing emails. Heartful OS has no
// outbound mail server wired up (no SMTP/Resend/etc. credentials — see
// Settings), so these are composed here and handed off to the user's own
// email client via a mailto: link, or copied to the clipboard. No email is
// ever sent automatically.

export function buildIntroEmail(input: {
  clientFirstName: string;
  practitionerName: string;
  practiceName?: string;
  portalUrl: string;
  packageName?: string;
  packageValue?: number;
  amountDue?: number;
  venmoHandle?: string;
}): { subject: string; body: string } {
  const {
    clientFirstName,
    practitionerName,
    practiceName,
    portalUrl,
    packageName,
    packageValue,
    amountDue,
    venmoHandle,
  } = input;

  const subject = `Welcome${practiceName ? ` to ${practiceName}` : ""} — Next Steps Before We Meet`;

  const packageLine =
    packageName || packageValue
      ? `Your package: ${packageName ?? "Journey Support"}${packageValue ? ` ($${packageValue.toLocaleString()})` : ""}.`
      : "";

  const paymentAmount = amountDue && amountDue > 0 ? `$${amountDue.toLocaleString()}` : "your payment";
  const venmoLink = venmoHandle ? `https://venmo.com/${venmoHandle}` : "";
  const paymentLine = venmoHandle
    ? `To reserve your spot, please send ${paymentAmount} via Venmo: ${venmoLink}`
    : `To reserve your spot, please send ${paymentAmount} (payment link to follow).`;

  const body = `Hi ${clientFirstName},

Welcome — I'm looking forward to working with you. Here's what to expect and what I need from you before we meet.

WHAT TO EXPECT
Our first session together will be an intake & assessment conversation, where we'll talk through your intentions, history, and how to prepare safely. From there we'll move through preparation, the session itself, and integration support afterward — I'll walk you through each step as we go.

YOUR CLIENT PORTAL
Please log in and complete your intake forms and consents before our first session:
${portalUrl}
The first time you open this link, you'll be asked to set up an email and password for your account. You'll need to log in again each time you return, for your privacy.

PAYMENT
${packageLine ? packageLine + "\n" : ""}${paymentLine}

STAYING IN TOUCH
Going forward, please send any questions, updates, or messages through your client portal rather than by text or email — that way everything stays together in one place and I won't miss anything. You can message me anytime from the portal link above.

Warmly,
${practitionerName}${practiceName ? `\n${practiceName}` : ""}`;

  return { subject, body };
}

// Client-facing recap of an intro call, built from the AI-generated
// client_summary_content on a Prospect. Keys are optional/best-effort since
// the AI response shape can vary slightly.
export function buildProspectSummaryEmail(input: {
  prospectFirstName: string;
  practitionerName: string;
  practiceName?: string;
  summary: Record<string, unknown>;
}): { subject: string; body: string } {
  const { prospectFirstName, practitionerName, practiceName, summary } = input;

  const get = (key: string) => {
    const v = summary[key];
    return typeof v === "string" && v.trim() ? v.trim() : "";
  };

  const whatWeTalkedAbout = get("what_we_talked_about") || get("summary");
  const nextSteps = get("your_next_steps") || get("action_items");
  const whatHappensNext = get("what_happens_next");
  const questions = get("questions_to_sit_with");

  const subject = `Recap from our conversation${practiceName ? ` — ${practiceName}` : ""}`;

  const sections = [
    whatWeTalkedAbout,
    nextSteps && `WHAT'S NEEDED FROM YOU\n${nextSteps}`,
    whatHappensNext && `WHAT HAPPENS NEXT\n${whatHappensNext}`,
    questions && `A FEW THINGS TO SIT WITH\n${questions}`,
  ].filter(Boolean);

  const body = `Hi ${prospectFirstName},

Thank you for taking the time to talk with me. Here's a quick recap of our conversation.

${sections.join("\n\n")}

Feel free to reach out anytime with questions.

Warmly,
${practitionerName}${practiceName ? `\n${practiceName}` : ""}`;

  return { subject, body };
}

// Combined prep + aftercare email for a client's Journey Day (harm-reduction
// support session), sent two days ahead. Combined into one email rather than
// a separate day-of and day-after pair because the client is asked to stay
// off screens the evening of the session, so they wouldn't be able to read a
// follow-up email that night anyway — everything they need goes out up front.
function formatEmailDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatEmailTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function buildJourneyPrepEmail(input: {
  clientFirstName: string;
  /** ISO timestamp of the Journey Day session */
  sessionScheduledAt: string;
  /** Minutes before the session the client should arrive by. Defaults to 15. */
  arrivalBufferMinutes?: number;
  /** ISO timestamp of the next scheduled session/call after Journey Day (e.g. the 12hr check-in), if one exists */
  followUpScheduledAt?: string;
  practitionerName: string;
  practiceName?: string;
}): { subject: string; body: string } {
  const {
    clientFirstName,
    sessionScheduledAt,
    arrivalBufferMinutes = 15,
    followUpScheduledAt,
    practitionerName,
    practiceName,
  } = input;

  const sessionDate = formatEmailDate(sessionScheduledAt);
  const sessionTime = formatEmailTime(sessionScheduledAt);
  const arrivalTime = formatEmailTime(
    new Date(new Date(sessionScheduledAt).getTime() - arrivalBufferMinutes * 60_000).toISOString()
  );
  const followUpDate = followUpScheduledAt ? formatEmailDate(followUpScheduledAt) : "in the next few days";

  const subject = `Preparing for Your Session on ${sessionDate}`;

  const body = `Hi ${clientFirstName},

Your session is scheduled for ${sessionDate} at ${sessionTime} — just two days from now. Since I'll be asking you to stay off screens for the rest of that evening, I'm sending everything you need now: how to prepare over the next two days, and what to expect afterward.

HYDRATION
Stay well hydrated over the next two days, especially the day before your session — don't try to catch up right before we meet. Ease off caffeine after midday the day before, and skip alcohol entirely starting then.

FOOD
Eat normally over the next couple of days, keeping meals light and easy to digest — especially your last meal the night before your session. Avoid anything heavy, greasy, or rich that evening. On the morning of your session, follow the specific eating guidance we discussed. If you're unsure what that means for you, reach out rather than guessing.

SLEEP
Aim for a full night's sleep the night before your session — 7 to 9 hours if you can. Wind down earlier than usual that evening: dim the lights, put screens away at least 30–60 minutes before bed, and steer clear of anything emotionally heavy (work stress, difficult conversations, heavy news).

MEDICATIONS
Continue any regular medications as prescribed unless we've specifically discussed otherwise. Please avoid alcohol and any recreational substances for at least 24 hours before we meet.

WHAT TO BRING / WEAR
Comfortable clothing you can relax and move in. Bring a journal. Anything else that helps you feel grounded — entirely optional.

SETTING YOUR INTENTION
Review your planning session(s) in the client portal, then take a few quiet minutes to sit with what's bringing you here — what you're hoping to explore, understand, or let go of. It doesn't need to be polished, just honest.

LOGISTICS
Please arrive by ${arrivalTime} on ${sessionDate} so we have time to settle in before we begin. Plan for someone else to get you home afterward rather than driving yourself.

AFTER YOUR SESSION
Since you won't be looking at your phone or email that evening, here's what to know now, ahead of time.

FOR THE REST OF THAT EVENING
Keep the evening quiet and unstructured, and avoid screens — phone, TV, computer — for the rest of the night.

Why: scrolling and notifications pull your attention back outward right when your mind is still settling and organizing what came up. A quiet, low-stimulation evening protects that process, and tends to make what you experienced easier to hold onto and make sense of later, instead of getting crowded out by noise.

Eat something light and nourishing when you're hungry, drink water, and rest. Feeling tired, tender, or a little "spacey" that night is normal — let yourself have an easy evening.

WHAT TO EXPECT IN THE DAYS AHEAD
Everyone's experience is different, but common in the days that follow:
- Vivid dreams, or unusually clear dream recall
- Emotional sensitivity — things sitting closer to the surface than usual
- A sense of clarity or "afterglow," sometimes followed by a dip a day or two later as things settle — this is normal and typically passes on its own
- Physical tiredness, even after a full night's sleep
- New thoughts or connections surfacing at unexpected moments over the next several days to weeks

None of this needs fixing — it's part of how the experience continues to settle and integrate.

INTEGRATION PRACTICES
- Journal, even a few lines, about what stood out — you don't need to interpret it yet, just capture it
- Spend time outside and move your body gently
- Hold off on major decisions (ending relationships, big purchases, career changes) for at least a few weeks — let things settle before acting on them
- Talk about your experience with people you trust, at whatever pace feels right to you

WHEN TO REACH OUT
If you're feeling overwhelmed, distressed, or something feels off — physically or emotionally — reach out to me directly rather than waiting for our next scheduled check-in.

OUR NEXT CONVERSATION
We'll plan to check in on ${followUpDate} to talk through what came up and support you in integrating it. Until then, be gentle with yourself.

If anything comes up between now and your session, reach out any time.

Warmly,
${practitionerName}${practiceName ? `\n${practiceName}` : ""}`;

  return { subject, body };
}
