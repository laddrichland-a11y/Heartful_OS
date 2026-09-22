import AppShell from "@/components/layout/AppShell";
import Link from "next/link";
import { ArrowLeft } from "@/components/ui/HeartfulIcon";
import {
  getClient,
  getMilestones,
  getDocuments,
  getSessions,
  getAiSummaries,
  getAiConversationMessages,
  getMemory,
  getMessages,
  getPostIntegrationForms,
  getPreparationPlan,
  getCheckIns,
  getTasks,
  getReferralSources,
  getPortalAssignments,
  getFormTemplates,
  getFormSubmissionsForClient,
  getPractitioner,
  getEmailLogs,
  getTranscripts,
} from "@/lib/data";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import ClientHeader from "@/components/client/ClientHeader";
import ClientRecordTabs from "@/components/client/ClientRecordTabs";
import ClientContextRail from "@/components/client/ClientContextRail";
import ClientWorkspace from "@/components/client/ClientWorkspace";
import { TABS, Tab } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ intro?: string; tab?: string; stage?: string }>;
}) {
  const { id } = await params;
  const { intro, tab: rawTab, stage } = await searchParams;
  const tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : undefined;
  const client = await getClient(id);
  if (!client) notFound();

  const [
    milestones,
    documents,
    sessions,
    aiSummaries,
    aiConversationMessages,
    memory,
    messages,
    postIntegrationForms,
    preparationPlan,
    checkIns,
    tasks,
    referralSources,
    portalAssignments,
    formTemplates,
    formSubmissions,
    practitioner,
    emailLogs,
    transcripts,
  ] = await Promise.all([
    getMilestones(id),
    getDocuments(id),
    getSessions(id),
    getAiSummaries(id),
    getAiConversationMessages(id),
    getMemory(id),
    getMessages(id),
    getPostIntegrationForms(id),
    getPreparationPlan(id),
    getCheckIns(id),
    getTasks(id),
    getReferralSources(),
    getPortalAssignments(id),
    getFormTemplates(),
    getFormSubmissionsForClient(id),
    getPractitioner(),
    getEmailLogs(id),
    getTranscripts(id),
  ]);

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol = h.get("x-forwarded-proto") ?? "http";
  const portalUrl = `${protocol}://${host}/portal?client=${id}`;

  return (
    <AppShell title={client.full_name} variant="wellnest-client">
      <Link href="/clients" className="wn-back-link text-sm text-ink-400 hover:text-ink-700 flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> All Clients
      </Link>
      <ClientWorkspace rail={
        <ClientContextRail
          client={client}
          sessions={sessions}
          milestones={milestones}
          documents={documents}
          formSubmissions={formSubmissions}
          tasks={tasks}
          portalAssignments={portalAssignments}
          checkIns={checkIns}
          postIntegrationForms={postIntegrationForms}
          transcripts={transcripts}
          aiSummaries={aiSummaries}
          messages={messages}
        />
      }>
        <div className="wn-client-primary">
          <ClientHeader
            client={client}
            milestones={milestones}
            sessions={sessions}
            referralSources={referralSources}
            practitioner={practitioner}
            portalUrl={portalUrl}
            autoOpenIntro={intro === "1"}
          />
          <ClientRecordTabs
            client={client}
            documents={documents}
            sessions={sessions}
            aiSummaries={aiSummaries}
            aiConversationMessages={aiConversationMessages}
            memory={memory}
            messages={messages}
            postIntegrationForms={postIntegrationForms}
            preparationPlan={preparationPlan}
            checkIns={checkIns}
            tasks={tasks}
            portalAssignments={portalAssignments}
            formTemplates={formTemplates}
            formSubmissions={formSubmissions}
            milestones={milestones}
            emailLogs={emailLogs}
            defaultTab={tab}
            defaultStage={stage}
          />
        </div>
      </ClientWorkspace>
    </AppShell>
  );
}
