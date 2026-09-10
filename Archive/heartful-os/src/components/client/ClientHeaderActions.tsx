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
        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
      >
        <Mail className="h-3.5 w-3.5" /> Send Intro Email
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
