import { ReactNode, Suspense } from "react";
import Link from "next/link";
import {
  getAiSummaries,
  getCheckIns,
  getClient,
  getDocuments,
  getFormSubmissionsForClient,
  getFormTemplates,
  getMessages,
  getMilestones,
  getPortalAssignments,
  getPostIntegrationForms,
  getSessions,
  getTasks,
  getTranscripts,
  getPractitioner,
  getReferralSources,
} from "@/lib/data";
import ClientContextRail from "@/components/client/ClientContextRail";
import ClientWorkspace from "@/components/client/ClientWorkspace";
import ClientHeader from "@/components/client/ClientHeader";
import { ArrowLeft } from "@/components/ui/HeartfulIcon";
import { headers } from "next/headers";

/** Keeps dedicated stage routes in the same two-column client workspace as the record page. */
export default function ClientPhaseWorkspace({
  clientId,
  children,
  showClientHeader = false,
}: {
  clientId: string;
  children: ReactNode;
  showClientHeader?: boolean;
}) {
  return (
    <ClientWorkspace rail={
      <Suspense fallback={<aside className="wn-context-rail" aria-label="Loading client context" />}>
        <ClientPhaseContextRail clientId={clientId} />
      </Suspense>
    }>
      <div className="wn-client-primary">
        <Link href="/clients" className="wn-back-link mb-4 flex items-center gap-1 text-sm text-ink-400 hover:text-ink-700">
          <ArrowLeft className="h-3.5 w-3.5" /> All Clients
        </Link>
        {showClientHeader && <ClientPhaseHeader clientId={clientId} />}
        {children}
      </div>
    </ClientWorkspace>
  );
}

/** Reuses the record header on standalone stage routes that have no session page. */
async function ClientPhaseHeader({ clientId }: { clientId: string }) {
  const [client, milestones, sessions, practitioner, referralSources, requestHeaders] = await Promise.all([
    getClient(clientId),
    getMilestones(clientId),
    getSessions(clientId),
    getPractitioner(),
    getReferralSources(),
    headers(),
  ]);
  if (!client) return null;

  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  return (
    <ClientHeader
      client={client}
      milestones={milestones}
      sessions={sessions}
      practitioner={practitioner}
      referralSources={referralSources}
      portalUrl={`${protocol}://${host}/portal?client=${clientId}`}
    />
  );
}

async function ClientPhaseContextRail({ clientId }: { clientId: string }) {
  const [client, sessions, milestones, documents, formSubmissions, formTemplates, tasks, portalAssignments, checkIns, postIntegrationForms, transcripts, aiSummaries, messages] = await Promise.all([
    getClient(clientId),
    getSessions(clientId),
    getMilestones(clientId),
    getDocuments(clientId),
    getFormSubmissionsForClient(clientId),
    getFormTemplates(),
    getTasks(clientId),
    getPortalAssignments(clientId),
    getCheckIns(clientId),
    getPostIntegrationForms(clientId),
    getTranscripts(clientId),
    getAiSummaries(clientId),
    getMessages(clientId),
  ]);

  if (!client) return null;

  return (
    <ClientContextRail
        client={client}
        sessions={sessions}
        milestones={milestones}
        documents={documents}
        formSubmissions={formSubmissions}
        formTemplates={formTemplates}
        tasks={tasks}
        portalAssignments={portalAssignments}
        checkIns={checkIns}
        postIntegrationForms={postIntegrationForms}
        transcripts={transcripts}
        aiSummaries={aiSummaries}
        messages={messages}
    />
  );
}
