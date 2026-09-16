import AppShell from "@/components/layout/AppShell";
import {
  getClient,
  getDocument,
  getFormTemplateForDocumentType,
  getFormSubmission,
  getPractitioner,
} from "@/lib/data";
import { notFound } from "next/navigation";
import FullPageForm from "@/components/forms/FullPageForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DOCUMENT_LABELS } from "@/lib/types";
import { buildFormPrefill } from "@/lib/formPrefill";

export const dynamic = "force-dynamic";

export default async function ClientFormPage({
  params,
}: {
  params: Promise<{ id: string; documentId: string }>;
}) {
  const { id, documentId } = await params;
  const [client, doc] = await Promise.all([getClient(id), getDocument(documentId)]);
  if (!client || !doc) notFound();

  const [template, submission, practitioner] = await Promise.all([
    getFormTemplateForDocumentType(doc.document_type),
    getFormSubmission(documentId),
    getPractitioner(),
  ]);
  if (!template) notFound();

  const title = DOCUMENT_LABELS[doc.document_type] ?? template.title;

  return (
    <AppShell title={`${title} — ${client.full_name}`}>
      <div className="max-w-2xl mx-auto">
        <Link
          href={`/clients/${id}`}
          className="text-sm text-ink-500 hover:text-ink-800 flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to {client.full_name}
        </Link>
        <div className="mb-4">
          <h1 className="app-page-title text-ink-900">{title}</h1>
          <p className="text-sm text-ink-500 mt-0.5">{client.full_name}</p>
        </div>
        <FullPageForm
          clientId={id}
          documentId={documentId}
          templateId={template.id}
          template={template}
          submission={submission}
          packageValue={client.package_value}
          prefill={buildFormPrefill(client, practitioner)}
          isPractitioner
        />
      </div>
    </AppShell>
  );
}
