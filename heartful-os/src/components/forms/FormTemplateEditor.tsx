"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FormFieldType, FormTemplate, SessionType } from "@/lib/types";
import { createFormTemplateAction, updateFormTemplateAction } from "@/lib/actions";
import { cx } from "@/lib/utils";
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from "@/components/ui/HeartfulIcon";

export const FORM_STAGE_CHOICES: { value: SessionType; label: string }[] = [
  { value: "intake_assessment", label: "Intake & Assessment" },
  { value: "preparation", label: "Preparation" },
  { value: "harm_reduction_support", label: "Journey Day" },
  { value: "check_in_12hr", label: "12-Hour Check-In" },
  { value: "integration_1", label: "Integration Session 1" },
  { value: "integration_2", label: "Integration Session 2" },
];

const FIELD_TYPE_CHOICES: { value: FormFieldType; label: string }[] = [
  { value: "short_text", label: "Short answer" },
  { value: "long_text", label: "Long answer" },
  { value: "yes_no", label: "Yes / No" },
  { value: "select", label: "Pick one (list)" },
  { value: "multi_select", label: "Pick several (checkboxes)" },
  { value: "signature", label: "Signature" },
  { value: "static_text", label: "Information only (no answer)" },
];

interface DraftField {
  key: string;
  id?: string;
  type: FormFieldType;
  label: string;
  helpText: string;
  required: boolean;
  optionsText: string;
}
interface DraftSection {
  key: string;
  id?: string;
  title: string;
  body: string;
  fields: DraftField[];
}

let keySeq = 0;
const newKey = () => `k${Date.now().toString(36)}${(keySeq++).toString(36)}`;
const blankField = (): DraftField => ({ key: newKey(), type: "long_text", label: "", helpText: "", required: false, optionsText: "" });
const blankSection = (): DraftSection => ({ key: newKey(), title: "", body: "", fields: [blankField()] });

function toDraft(template?: FormTemplate): DraftSection[] {
  if (!template || template.sections.length === 0) return [blankSection()];
  return template.sections.map((section) => ({
    key: newKey(),
    id: section.id,
    title: section.title ?? "",
    body: section.body ?? "",
    fields: section.fields.map((field) => ({
      key: newKey(),
      id: field.id,
      type: field.type,
      label: field.label,
      helpText: field.helpText ?? "",
      required: Boolean(field.required),
      optionsText: (field.options ?? []).map((o) => o.label).join("\n"),
    })),
  }));
}

function move<T>(list: T[], index: number, delta: number): T[] {
  const next = [...list];
  const target = index + delta;
  if (target < 0 || target >= next.length) return list;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// Create a new form, or edit one. Built-in forms keep their wording (it's
// managed in code) — for those only the stages and auto-attach can change.
export default function FormTemplateEditor({
  template,
  onClose,
}: {
  template?: FormTemplate;
  onClose: () => void;
}) {
  const router = useRouter();
  const isBuiltIn = Boolean(template && !template.custom);
  const [title, setTitle] = useState(template?.title ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [stages, setStages] = useState<SessionType[]>(template?.session_types ?? []);
  const [required, setRequired] = useState(template?.required ?? true);
  const [sections, setSections] = useState<DraftSection[]>(() => toDraft(template));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateSection(key: string, patch: Partial<DraftSection>) {
    setSections((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }
  function updateField(sectionKey: string, fieldKey: string, patch: Partial<DraftField>) {
    setSections((prev) =>
      prev.map((s) => (s.key === sectionKey ? { ...s, fields: s.fields.map((f) => (f.key === fieldKey ? { ...f, ...patch } : f)) } : s)),
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    const input = {
      title,
      description,
      session_types: stages,
      required,
      sections: sections.map((s) => ({
        id: s.id ?? "",
        title: s.title,
        body: s.body,
        fields: s.fields.map((f) => ({
          id: f.id ?? "",
          type: f.type,
          label: f.label,
          helpText: f.helpText,
          required: f.required,
          options: f.optionsText.split("\n").map((line) => line.trim()).filter(Boolean).map((label) => ({ value: label, label })),
        })),
      })),
    };
    const result = template ? await updateFormTemplateAction(template.id, input) : await createFormTemplateAction(input);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  const inputCls = "w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200";

  return (
    <div className="card p-5 space-y-5 border-clay-200" role="region" aria-label={template ? `Edit ${template.title}` : "New form"}>
      <div>
        <h2 className="font-semibold text-ink-900">{template ? `Edit: ${template.title}` : "New Form"}</h2>
        {isBuiltIn && (
          <p className="mt-1 text-xs text-ink-500">
            This is a built-in form, so its questions can&apos;t be changed here. You can choose which stage(s) it belongs to
            and whether it attaches to every client.
          </p>
        )}
      </div>

      {!isBuiltIn && (
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-ink-800">Form name</span>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Post-Journey Body Check" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-ink-800">Short description (optional)</span>
            <textarea className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink-800">Which stage is this form for?</legend>
        <p className="text-xs text-ink-400">It will appear under &quot;Forms for This Session&quot; on each stage you pick, and on those session pages.</p>
        <div className="flex flex-wrap gap-2">
          {FORM_STAGE_CHOICES.map((choice) => {
            const on = stages.includes(choice.value);
            return (
              <label
                key={choice.value}
                className={cx(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm cursor-pointer",
                  on ? "border-sage-300 bg-sage-100 text-sage-800" : "border-ink-200 bg-white text-ink-600",
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={() => setStages((prev) => (on ? prev.filter((v) => v !== choice.value) : [...prev, choice.value]))}
                />
                {choice.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="flex items-start gap-2 text-sm text-ink-800">
        <input type="checkbox" className="mt-0.5" checked={required} onChange={(e) => setRequired(e.target.checked)} />
        <span>
          Attach to every client automatically
          <span className="block text-xs text-ink-400">Adds it to every current client and every new client (this is the &quot;Required&quot; setting).</span>
        </span>
      </label>

      {!isBuiltIn && (
        <div className="space-y-4">
          {sections.map((section, sIndex) => (
            <div key={section.key} className="rounded-xl border border-ink-100 p-4 space-y-3 bg-white/60">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Section {sIndex + 1}</span>
                <span className="ml-auto flex items-center gap-1">
                  <button type="button" className="btn-ghost p-1" aria-label="Move section up" onClick={() => setSections((p) => move(p, sIndex, -1))}><ChevronUp className="h-4 w-4" /></button>
                  <button type="button" className="btn-ghost p-1" aria-label="Move section down" onClick={() => setSections((p) => move(p, sIndex, 1))}><ChevronDown className="h-4 w-4" /></button>
                  {sections.length > 1 && (
                    <button type="button" className="btn-ghost p-1 text-ink-400 hover:text-red-600" aria-label="Remove section" onClick={() => setSections((p) => p.filter((s) => s.key !== section.key))}><Trash2 className="h-4 w-4" /></button>
                  )}
                </span>
              </div>
              <input className={inputCls} value={section.title} onChange={(e) => updateSection(section.key, { title: e.target.value })} placeholder="Section heading (optional)" />
              <textarea className={inputCls} rows={2} value={section.body} onChange={(e) => updateSection(section.key, { body: e.target.value })} placeholder="Instructions for this section (optional)" />

              <div className="space-y-3">
                {section.fields.map((field, fIndex) => (
                  <div key={field.key} className="rounded-lg border border-ink-100 p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-ink-400">Question {fIndex + 1}</span>
                      <select
                        className="border border-ink-200 rounded-lg px-2 py-1 text-sm"
                        value={field.type}
                        onChange={(e) => updateField(section.key, field.key, { type: e.target.value as FormFieldType })}
                        aria-label="Answer type"
                      >
                        {FIELD_TYPE_CHOICES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      {field.type !== "static_text" && (
                        <label className="flex items-center gap-1.5 text-xs text-ink-600">
                          <input type="checkbox" checked={field.required} onChange={(e) => updateField(section.key, field.key, { required: e.target.checked })} />
                          Must be answered
                        </label>
                      )}
                      <span className="ml-auto flex items-center gap-1">
                        <button type="button" className="btn-ghost p-1" aria-label="Move question up" onClick={() => updateSection(section.key, { fields: move(section.fields, fIndex, -1) })}><ChevronUp className="h-4 w-4" /></button>
                        <button type="button" className="btn-ghost p-1" aria-label="Move question down" onClick={() => updateSection(section.key, { fields: move(section.fields, fIndex, 1) })}><ChevronDown className="h-4 w-4" /></button>
                        <button type="button" className="btn-ghost p-1 text-ink-400 hover:text-red-600" aria-label="Remove question" onClick={() => updateSection(section.key, { fields: section.fields.filter((f) => f.key !== field.key) })}><Trash2 className="h-4 w-4" /></button>
                      </span>
                    </div>
                    <input
                      className={inputCls}
                      value={field.label}
                      onChange={(e) => updateField(section.key, field.key, { label: e.target.value })}
                      placeholder={field.type === "static_text" ? "Text to show" : "Question"}
                    />
                    {(field.type === "select" || field.type === "multi_select") && (
                      <textarea
                        className={inputCls}
                        rows={3}
                        value={field.optionsText}
                        onChange={(e) => updateField(section.key, field.key, { optionsText: e.target.value })}
                        placeholder={"Choices — one per line"}
                      />
                    )}
                    {field.type !== "static_text" && (
                      <input
                        className={inputCls}
                        value={field.helpText}
                        onChange={(e) => updateField(section.key, field.key, { helpText: e.target.value })}
                        placeholder="Hint under the question (optional)"
                      />
                    )}
                  </div>
                ))}
              </div>
              <button type="button" className="btn-ghost text-sm px-3 py-1.5 flex items-center gap-1.5" onClick={() => updateSection(section.key, { fields: [...section.fields, blankField()] })}>
                <Plus className="h-3.5 w-3.5" /> Add question
              </button>
            </div>
          ))}
          <button type="button" className="btn-ghost text-sm px-3 py-1.5 flex items-center gap-1.5" onClick={() => setSections((p) => [...p, blankSection()])}>
            <Plus className="h-3.5 w-3.5" /> Add section
          </button>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <button type="button" className="btn-ghost text-sm px-3 py-2" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="button" className="btn-primary text-sm px-4 py-2 inline-flex items-center gap-2" onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {template ? "Save changes" : "Save form"}
        </button>
      </div>
    </div>
  );
}
