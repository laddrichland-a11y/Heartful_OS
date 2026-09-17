"use client";

import { useState } from "react";
import { Mail } from "@/components/ui/HeartfulIcon";
import JourneyPrepEmailModal from "./JourneyPrepEmailModal";

export default function JourneyPrepEmailButton({
  clientId,
  clientName,
  clientEmail,
  practitionerName,
  practiceName,
  sessionScheduledAt,
  followUpScheduledAt,
}: {
  clientId: string;
  clientName: string;
  clientEmail?: string;
  practitionerName: string;
  practiceName?: string;
  /** ISO timestamp of the Journey Day session. No session scheduled yet = nothing to send prep for. */
  sessionScheduledAt?: string;
  followUpScheduledAt?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!sessionScheduledAt) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
      >
        <Mail className="h-3.5 w-3.5" /> Send Prep Email
      </button>
      <JourneyPrepEmailModal
        open={open}
        onClose={() => setOpen(false)}
        clientId={clientId}
        clientName={clientName}
        clientEmail={clientEmail}
        practitionerName={practitionerName}
        practiceName={practiceName}
        sessionScheduledAt={sessionScheduledAt}
        followUpScheduledAt={followUpScheduledAt}
      />
    </>
  );
}
