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
  buttonId,
  onError,
  refreshOnDone = true,
}: {
  clientId: string;
  summaryType: AiSummaryType;
  label: string;
  extra?: Record<string, unknown>;
  onDone?: (summary: { content: Record<string, unknown>; title: string; model?: string }) => void;
  icon?: "sparkles" | "document";
  className?: string;
  disabled?: boolean;
  buttonId?: string;
  onError?: () => void;
  /** Keep transient preview UI open when its result is already rendered locally. */
  refreshOnDone?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex max-w-full flex-col items-end gap-1.5">
      <button
        id={buttonId}
        disabled={busy || disabled}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/ai/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ clientId, summaryType, ...extra }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.summary) {
              throw new Error(typeof json.error === "string" ? json.error : "AI generation failed. Please try again.");
            }
            if (onDone) onDone(json.summary);
            if (refreshOnDone) router.refresh();
          } catch (generationError) {
            setError(generationError instanceof Error ? generationError.message : "AI generation failed. Please try again.");
            onError?.();
          } finally {
            setBusy(false);
          }
        }}
        className={className ?? "btn-primary flex items-center gap-2 text-sm disabled:opacity-60"}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon === "document" ? <FileText className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        {busy ? "Generating..." : error ? "Try again" : label}
      </button>
      {error && <span role="alert" className="max-w-72 text-right text-xs text-red-600">{error}</span>}
    </span>
  );
}
