"use client";

import { useState } from "react";
import {
  CheckCircle2,
  CalendarDays,
  ClipboardCheck,
  Sprout,
  MessageSquareText,
  ShieldCheck,
  ArrowRight,
  Loader2,
} from "@/components/ui/HeartfulIcon";
import { Profile } from "@/lib/types";

// ---------------------------------------------------------------------------
// PORTAL WELCOME
//
// Shown once, immediately after a client signs the last of their agreements —
// the first thing the portal says to them after the paperwork. Orientation,
// not instruction: what this space is, what lives in each part of it, and the
// reassurance that nothing here is a test.
//
// Dismissing writes portal_welcome_seen_at on the client record (not
// localStorage) so it doesn't reappear when they move from phone to laptop.
// The header keeps an "About this portal" link so they can come back to it.
// ---------------------------------------------------------------------------

const SECTIONS: {
  icon: typeof CalendarDays;
  title: string;
  body: string;
  tint: string;
}[] = [
  {
    icon: CalendarDays,
    title: "Appointments",
    body: "Every session — the ones ahead and the ones behind. Times, places, and afterward, any recordings or summaries worth keeping.",
    tint: "bg-clay-50 text-clay-600",
  },
  {
    icon: ClipboardCheck,
    title: "Forms & Check-Ins",
    body: "The reflections that come before and after a session. They help your practitioner meet you where you actually are, rather than where the schedule says you should be.",
    tint: "bg-plum-50 text-plum-600",
  },
  {
    icon: Sprout,
    title: "Growth & Integration",
    body: "Where the work settles. Intentions you've set, insights you've gathered, and the practices that carry the experience into ordinary days.",
    tint: "bg-sage-50 text-sage-700",
  },
  {
    icon: MessageSquareText,
    title: "Messages",
    body: "A direct line to your practitioner between sessions. Not urgent care — but a place to put a question rather than carry it alone.",
    tint: "bg-ink-100 text-ink-600",
  },
];

export default function PortalWelcome({
  clientFirstName,
  practitioner,
  onDismiss,
  dismissLabel = "Take me to my portal",
  showDismiss = true,
}: {
  clientFirstName: string;
  practitioner?: Profile;
  onDismiss: () => Promise<void> | void;
  dismissLabel?: string;
  showDismiss?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="portal-welcome">
      {/* Masthead */}
      <div className="portal-welcome-hero">
        <div className="relative space-y-3">
          <div className="portal-welcome-hero__icon">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            You&apos;re all set, {clientFirstName}
          </h1>
          <p className="text-sm leading-relaxed max-w-md">
            Your paperwork is signed and your portal is open. Here&apos;s what you&apos;ll find in it.
          </p>
        </div>
      </div>

      {/* What this space is */}
      <div className="card p-6">
        <p className="text-sm text-ink-600 leading-relaxed">
          This portal is the quiet part of the work — the space between sessions. It holds your
          schedule, the reflections you write, and the notes that come back to you afterward, all in
          one place so nothing has to live in your inbox or your memory.
        </p>
        <p className="text-sm text-ink-600 leading-relaxed mt-3">
          You don&apos;t need to do anything here right now. When something is waiting for you,
          it&apos;ll show up under <span className="font-medium text-ink-800">Action Items</span> on
          your home page.
        </p>
      </div>

      {/* The four rooms */}
      <div className="portal-welcome-sections">
        {SECTIONS.map(({ icon: Icon, title, body, tint }) => (
          <div key={title} className="card p-5 flex flex-col gap-2.5">
            <div className={`portal-welcome-section-icon h-9 w-9 rounded-xl flex items-center justify-center ${tint}`}>
              <Icon className="h-4.5 w-4.5" />
            </div>
            <h2 className="font-semibold text-ink-900 text-sm">{title}</h2>
            <p className="text-xs text-ink-500 leading-relaxed">{body}</p>
          </div>
        ))}
      </div>

      {/* Privacy — the question every client has and few ask out loud */}
      {/* Not using .card here: it's an unlayered rule in globals.css, so its
          white background and ink border beat any Tailwind utility no matter
          the order. Spelled out to match .card's shape exactly. */}
      <div className="portal-welcome-privacy p-5 flex gap-3.5">
        <div className="h-9 w-9 rounded-xl bg-white text-sage-700 flex items-center justify-center shrink-0">
          <ShieldCheck className="h-4.5 w-4.5" />
        </div>
        <div className="space-y-1">
          <h2 className="font-semibold text-ink-900 text-sm">What you write here is yours</h2>
          {/* Built as one JS string on purpose. JSX drops the line break when
              a line ends in an expression, which silently glued the
              practitioner's name to the next word. */}
          <p className="text-xs text-ink-600 leading-relaxed">
            {`Only you and ${practitioner?.full_name ?? "your practitioner"} can see what\u2019s in this portal. Write plainly \u2014 nothing you put here is graded, and there\u2019s no version of this you\u2019re supposed to get right.`}
          </p>
        </div>
      </div>

      {showDismiss && (
        <div className="text-center space-y-3 pb-4">
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onDismiss();
              } finally {
                setBusy(false);
              }
            }}
            className="btn-primary text-sm px-6 py-2.5 inline-flex items-center gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {dismissLabel}
            {!busy && <ArrowRight className="h-4 w-4" />}
          </button>
          <p className="text-xs text-ink-400">
            You can come back to this any time from the link in the header.
          </p>
        </div>
      )}
    </div>
  );
}
