"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormTemplate, DOCUMENT_LABELS } from "@/lib/types";
import { cx } from "@/lib/utils";
import { setFormTemplateFlagsAction, resyncFormTemplatesAction } from "@/lib/actions";
import { FileText, ChevronDown, ChevronUp, ShieldCheck, ShieldOff, RefreshCw } from "lucide-react";
import FormRenderer from "./FormRenderer";

// Form Library: lets a practitioner see every codified consent/intake template
// and control which ones auto-attach to new clients. Toggling "Required" +
// "Active" here is the single source of truth that drives auto-attachment in
// createClient (see lib/data.ts) — there is no per-client picking.
export default function FormLibraryManager({ templates }: { templates: FormTemplate[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleResync() {
    setDone(false);
    startTransition(async () => {
      await resyncFormTemplatesAction();
      setDone(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="card p-4 bg-clay-50/60 border-clay-100 text-sm text-ink-600">
        Templates marked <strong>Required</strong> and <strong>Active</strong> are automatically attached to every new
        client&apos;s record — there&apos;s no per-client picking. Mark a template inactive to retire it without deleting
        history from clients who already have it.
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-400">
          Form wording/fields are stored once and don&apos;t update automatically after a fix ships — use this if a form
          looks out of date.
        </p>
        <button
          type="button"
          onClick={handleResync}
          disabled={pending}
          className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={cx("h-3.5 w-3.5", pending && "animate-spin")} />
          {pending ? "Updating..." : done ? "Updated" : "Update form content"}
        </button>
      </div>
      <div className="space-y-3">
        {templates.map((t) => (
          <TemplateCard key={t.id} template={t} />
        ))}
        {templates.length === 0 && <p className="text-sm text-ink-400">No form templates yet.</p>}
      </div>
    </div>
  );
}

function TemplateCard({ template }: { template: FormTemplate }) {
  const [open, setOpen] = useState(false);
  const [required, setRequired] = useState(template.required);
  const [active, setActive] = useState(template.active);
  const [busy, setBusy] = useState<"required" | "active" | null>(null);

  async function toggle(field: "required" | "active") {
    setBusy(field);
    const nextRequired = field === "required" ? !required : required;
    const nextActive = field === "active" ? !active : active;
    if (field === "required") setRequired(nextRequired);
    else setActive(nextActive);
    await setFormTemplateFlagsAction(template.id, { required: nextRequired, active: nextActive });
    setBusy(null);
  }

  const fieldCount = template.sections.reduce((n, s) => n + s.fields.length, 0);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex items-start gap-2.5 min-w-0">
          <FileText className="h-4 w-4 text-clay-500 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="font-medium text-sm text-ink-900">{template.title}</div>
            <div className="text-xs text-ink-400 mt-0.5">
              {DOCUMENT_LABELS[template.document_type] ?? template.document_type} · {template.sections.length} sections ·{" "}
              {fieldCount} fields
            </div>
            {template.description && <p className="text-xs text-ink-500 mt-1.5 leading-relaxed">{template.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ToggleBadge
            label="Required"
            active={required}
            busy={busy === "required"}
            onClick={() => toggle("required")}
          />
          <ToggleBadge label="Active" active={active} busy={busy === "active"} onClick={() => toggle("active")} />
          <button
            onClick={() => setOpen((o) => !o)}
            className="btn-ghost p-1.5"
            aria-label={open ? "Collapse preview" : "Expand preview"}
          >
            {open ? <ChevronUp className="h-4 w-4 text-ink-400" /> : <ChevronDown className="h-4 w-4 text-ink-400" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4 border-t border-ink-100 pt-4 bg-ink-50/30">
          <div className="text-xs text-ink-400 mb-3">Preview — read-only, shown as the client would see it.</div>
          <FormRenderer template={template} clientId="preview" documentId="preview" readOnly />
        </div>
      )}
    </div>
  );
}

function ToggleBadge({
  label,
  active,
  busy,
  onClick,
}: {
  label: string;
  active: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={cx(
        "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border font-medium transition-colors",
        active ? "bg-sage-100 text-sage-700 border-sage-200" : "bg-ink-100 text-ink-500 border-ink-200"
      )}
    >
      {active ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}
