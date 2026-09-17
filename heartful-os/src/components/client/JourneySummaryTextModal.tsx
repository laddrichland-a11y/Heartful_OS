"use client";

import { useMemo, useState } from "react";
import { X, MessageSquare, Copy, Check } from "@/components/ui/HeartfulIcon";
import { buildJourneySummaryReadyText } from "@/lib/smsTemplates";
import { logJourneySummaryTextAction } from "@/lib/actions";

export default function JourneySummaryTextModal({
  open,
  onClose,
  clientId,
  clientName,
  clientPhone,
  practitionerName,
  portalUrl,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  clientPhone?: string;
  practitionerName?: string;
  portalUrl: string;
}) {
  const initial = useMemo(
    () =>
      buildJourneySummaryReadyText({
        clientFirstName: clientName.split(" ")[0],
        portalUrl,
        practitionerName,
      }),
    [clientName, portalUrl, practitionerName]
  );

  const [body, setBody] = useState(initial);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  // sms: URI schemes differ between iOS (body after &) and Android (body
  // after ?) — "?&body=" is a widely used compromise that both platforms
  // tend to parse correctly.
  const smsHref = `sms:${clientPhone ?? ""}?&body=${encodeURIComponent(body)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className="card w-full max-w-lg p-6 bg-white max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-medium text-ink-900 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-clay-500" /> Text Client — {clientName}
          </h2>
          <button className="btn-ghost p-1" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {!clientPhone && (
          <p className="text-xs text-clay-600 bg-clay-50 rounded-lg px-3 py-2 mb-3">
            No phone number on file for this client — add one to use &quot;Open in Messages&quot;, or copy the text below to send it yourself.
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-ink-500">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              className="mt-1 w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200 resize-y"
            />
          </div>
        </div>
        <p className="text-xs text-ink-400 mt-3">
          Heartful OS doesn&apos;t send texts itself yet — open it in Messages, or copy the text below to send it yourself.
        </p>
        <div className="flex justify-end gap-2 pt-3">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(body);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
              logJourneySummaryTextAction(clientId, "copied");
            }}
            className="btn-ghost text-sm px-3 py-2 flex items-center gap-1.5"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy Text"}
          </button>
          <a
            href={smsHref}
            className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5"
            onClick={() => {
              if (!clientPhone) return;
              setTimeout(onClose, 150);
              logJourneySummaryTextAction(clientId, "sms_app");
            }}
          >
            <MessageSquare className="h-3.5 w-3.5" /> Open in Messages
          </a>
        </div>
      </div>
    </div>
  );
}
