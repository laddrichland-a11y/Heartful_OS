"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { resetPortalPasswordAction } from "@/lib/actions";

// Lets the practitioner clear a client's forgotten portal password — there's
// no email-sending service to power a self-serve "forgot password" flow, so
// this is the realistic reset path: the client tells the practitioner, the
// practitioner clicks this, and the client's portal link then shows the
// "create your account" form again so they can set a new password.
export default function ResetPortalPasswordButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleClick() {
    const confirmed = window.confirm(
      `Reset ${clientName}'s portal password? They'll be asked to set a new email and password next time they open their portal link.`
    );
    if (!confirmed) return;
    setDone(false);
    startTransition(async () => {
      await resetPortalPasswordAction(clientId);
      setDone(true);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-xs text-ink-500 hover:text-clay-600 underline underline-offset-2 flex items-center gap-1 ml-auto disabled:opacity-50"
    >
      <KeyRound className="h-3 w-3" /> {pending ? "Resetting..." : done ? "Password reset" : "Reset portal password"}
    </button>
  );
}
