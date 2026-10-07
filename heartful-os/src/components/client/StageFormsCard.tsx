import Link from "next/link";
import {
  ClientDocument,
  DOCUMENT_LABELS,
  FormSubmission,
  FormTemplate,
  SessionType,
} from "@/lib/types";
import { cx, isGeneralPaperwork } from "@/lib/utils";
import { formTemplateAppliesToSession } from "@/lib/requiredForms";
import { FileText } from "@/components/ui/HeartfulIcon";

// "Forms for This Session" — one shared list used on every stage page and
// session page, so the forms for a stage look and open the same everywhere.
// Every active form in the Form Library tagged for this stage is listed
// (built-in and ones you add in Settings → Forms). Click a form to open and
// fill it in.
export default function StageFormsCard({
  clientId,
  sessionType,
  formTemplates,
  documents,
  formSubmissions,
  includeAgreements = false,
}: {
  clientId: string;
  sessionType: SessionType;
  formTemplates: FormTemplate[];
  documents: ClientDocument[];
  formSubmissions: FormSubmission[];
  /** The signed-once agreements live under All Paperwork, so they're hidden here by default. */
  includeAgreements?: boolean;
}) {
  const templates = formTemplates.filter(
    (t) => formTemplateAppliesToSession(t, sessionType) && (includeAgreements || !isGeneralPaperwork(t.document_type)),
  );
  const rows = [...new Map(templates.map((t) => [t.document_type, t])).values()].map((template) => {
    const doc = documents.find((d) => d.document_type === template.document_type);
    const submission = doc ? formSubmissions.find((s) => s.document_id === doc.id) : undefined;
    return { template, doc, submission };
  });

  return (
    <div className="card p-4 stage-forms-card">
      <h3 className="session-panel-heading mb-3 flex items-center gap-3">
        <FileText className="h-4 w-4" aria-hidden="true" />
        Forms for This Session
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-400">
          No forms are set for this stage. Add one in{" "}
          <Link href="/settings/forms" className="font-medium text-clay-700 underline underline-offset-2">
            Settings → Forms
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map(({ template, doc, submission }) => {
            const label = DOCUMENT_LABELS[template.document_type] ?? template.title;
            if (!doc) {
              return (
                <div key={template.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-ink-100 text-sm text-ink-500">
                  <FileText className="h-4 w-4 text-ink-300 shrink-0" />
                  <span>{label}</span>
                  <span className="badge ml-auto bg-ink-100 text-ink-500">Not attached yet — refresh</span>
                </div>
              );
            }
            const status = submission?.status ?? "missing";
            const badge =
              doc.status === "reviewed"
                ? { label: "Reviewed", cls: "bg-blue-100 text-blue-700" }
                : status === "signed"
                  ? { label: "Signed", cls: "bg-sage-100 text-sage-700" }
                  : status === "submitted"
                    ? { label: "Submitted", cls: "bg-sage-100 text-sage-700" }
                    : status === "in_progress" || status === "draft"
                      ? { label: "In Progress", cls: "bg-amber-100 text-amber-700" }
                      : { label: "Not Started", cls: "bg-ink-100 text-ink-500" };
            return (
              <Link
                key={template.id}
                href={`/clients/${clientId}/forms/${doc.id}`}
                target="_blank"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-ink-100 hover:bg-ink-50/60 hover:border-clay-200 transition-colors group"
              >
                <FileText className="h-4 w-4 text-ink-400 shrink-0 group-hover:text-clay-500" />
                <span className="text-sm font-medium text-ink-800 group-hover:text-clay-700">{label}</span>
                <span className={cx("badge ml-auto", badge.cls)}>{badge.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
