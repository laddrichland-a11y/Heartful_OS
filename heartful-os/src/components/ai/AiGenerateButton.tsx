"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileText, Sparkles, Loader2 } from "@/components/ui/HeartfulIcon";
import { AiSummaryType } from "@/lib/types";

export default function AiGenerateButton({
  clientId,
  summaryType,
  label,
  extra,
  onDone,
  icon = "sparkles",
  className,
  disabled = false,
}: {
  clientId: string;
  summaryType: AiSummaryType;
  label: string;
  extra?: Record<string, unknown>;
  onDone?: (summary: { content: Record<string, unknown>; title: string; model?: string }) => void;
  icon?: "sparkles" | "document";
  className?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      disabled={busy || disabled}
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
      className={className ?? "btn-primary flex items-center gap-2 text-sm disabled:opacity-60"}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon === "document" ? <FileText className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      {busy ? "Generating..." : label}
    </button>
  );
}
