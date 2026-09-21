"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "@/components/ui/HeartfulIcon";
import { deleteClientAction } from "@/lib/actions";

export default function DeleteClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    const confirmed = window.confirm(
      `Delete ${clientName}? This permanently removes their record and all sessions, documents, forms, and history. This cannot be undone.`
    );
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteClientAction(clientId);
      } catch (err) {
        // Next.js server actions throw a special redirect error on success —
        // let that one propagate so navigation to /clients actually happens.
        if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
        setError("Couldn't delete this client. Try again.");
      }
    });
  }

  return (
    <div className="text-right client-delete-button">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="text-xs text-clay-600 hover:text-clay-700 underline underline-offset-2 flex items-center gap-1 ml-auto disabled:opacity-50"
      >
        <Trash2 className="h-3 w-3" /> {pending ? "Deleting..." : "Delete Client"}
      </button>
      {error && <p className="text-xs text-clay-600 mt-1">{error}</p>}
    </div>
  );
}
