"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import JourneySummaryTextModal from "./JourneySummaryTextModal";

export default function JourneySummaryTextButton({
  clientId,
  clientName,
  clientPhone,
  practitionerName,
  portalUrl,
  ready,
}: {
  clientId: string;
  clientName: string;
  clientPhone?: string;
  practitionerName?: string;
  portalUrl: string;
  /** Only show once there's an actual generated Journey Day Summary - Client to point the client to. */
  ready: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!ready) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
      >
        <MessageSquare className="h-3.5 w-3.5" /> Text Client: Summary Ready
      </button>
      <JourneySummaryTextModal
        open={open}
        onClose={() => setOpen(false)}
        clientId={clientId}
        clientName={clientName}
        clientPhone={clientPhone}
        practitionerName={practitionerName}
        portalUrl={portalUrl}
      />
    </>
  );
}
