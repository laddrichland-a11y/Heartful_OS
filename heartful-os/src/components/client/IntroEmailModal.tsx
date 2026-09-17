"use client";

import { useMemo, useState } from "react";
import { X, Mail, Copy, Check } from "@/components/ui/HeartfulIcon";
import { buildIntroEmail } from "@/lib/emailTemplates";
import { logIntroEmailAction } from "@/lib/actions";

export default function IntroEmailModal({
  open,
  onClose,
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
  open: boolean;
  onClose: () => void;
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
  const initial = useMemo(
    () =>
      buildIntroEmail({
        clientFirstName: clientName.split(" ")[0],
        practitionerName,
        practiceName,
        portalUrl,
        packageName,
        packageValue,
        amountDue,
        venmoHandle,
      }),
    [clientName, practitionerName, practiceName, portalUrl, packageName, packageValue, amountDue, venmoHandle]
  );

  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const mailtoHref = `mailto:${clientEmail ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className="card w-full max-w-xl p-6 bg-white max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-medium text-ink-900 flex items-center gap-2">
            <Mail className="h-4 w-4 text-clay-500" /> Intro Email — {clientName}
          </h2>
          <button className="btn-ghost p-1" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {!clientEmail && (
          <p className="text-xs text-clay-600 bg-clay-50 rounded-lg px-3 py-2 mb-3">
            No email address on file for this client — add one to use &quot;Open in Mail App&quot;, or copy the text below to send it yourself.
          </p>
        )}
        {!venmoHandle && (
          <p className="text-xs text-ink-400 mb-3">
            Add your Venmo handle in Settings to auto-include a payment link.
          </p>
        )}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-ink-500">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-500">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={14}
              className="mt-1 w-full border border-ink-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-clay-200"
            />
          </div>
        </div>
        <p className="text-xs text-ink-400 mt-3">
          Heartful OS doesn&apos;t send email itself — open it in your mail app, or copy the text below to send it yourself.
        </p>
        <div className="flex justify-end gap-2 pt-3">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
              logIntroEmailAction(clientId, "copied");
            }}
            className="btn-ghost text-sm px-3 py-2 flex items-center gap-1.5"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy Text"}
          </button>
          <a
            href={mailtoHref}
            className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5"
            onClick={() => {
              if (!clientEmail) return;
              setTimeout(onClose, 150);
              logIntroEmailAction(clientId, "mail_app");
            }}
          >
            <Mail className="h-3.5 w-3.5" /> Open in Mail App
          </a>
        </div>
      </div>
    </div>
  );
}
