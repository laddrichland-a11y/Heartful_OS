"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { AiSummaryType } from "@/lib/types";

export default function AiGenerateButton({
  clientId,
  summaryType,
  label,
  extra,
  onDone,
}: {
  clientId: string;
  summaryType: AiSummaryType;
  label: string;
  extra?: Record<string, unknown>;
  onDone?: (summary: { content: Record<string, unknown>; title: string; model?: string }) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch("/api/ai/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId, summaryType, ...extra }),
          });
          const json = await res.json();
          if (json.summary && onDone) onDone(json.summary);
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className="btn-primary flex items-center gap-2 text-sm disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {busy ? "Generating..." : label}
    </button>
  );
}
