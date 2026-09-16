"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Mail } from "lucide-react";
import IntroEmailModal from "./IntroEmailModal";

export default function ClientHeaderActions({
  autoOpenIntro,
  clientId,
  clientName,
  clientEmail,
  practitionerName,
  practiceName,
  portalUrl,
  packageName,
  packageValue,
  amountDue,
  venmoHandle,
  compact = false,
}: {
  autoOpenIntro: boolean;
  clientId: string;
  clientName: string;
  clientEmail?: string;
  practitionerName: string;
  practiceName?: string;
  portalUrl: string;
  packageName?: string;
  packageValue?: number;
  amountDue?: number;
  venmoHandle?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(autoOpenIntro);
  const router = useRouter();
  const pathname = usePathname();

  // Drop the ?intro=1 marker once we've used it so a page refresh doesn't
  // pop the modal open again.
  useEffect(() => {
    if (autoOpenIntro) router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`btn-secondary wn-intro-email-button text-xs px-3 py-1.5 flex items-center gap-1.5${compact ? " is-compact" : ""}`}
        aria-label={compact ? `Send intro email to ${clientName}` : undefined}
        title={compact ? "Send intro email" : undefined}
      >
        <Mail className="h-3.5 w-3.5" /> <span>Send Intro Email</span>
      </button>
      <IntroEmailModal
        open={open}
        onClose={() => setOpen(false)}
        clientId={clientId}
        clientName={clientName}
        clientEmail={clientEmail}
        practitionerName={practitionerName}
        practiceName={practiceName}
        portalUrl={portalUrl}
        packageName={packageName}
        packageValue={packageValue}
        amountDue={amountDue}
        venmoHandle={venmoHandle}
      />
    </>
  );
}
