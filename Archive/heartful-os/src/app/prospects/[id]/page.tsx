import AppShell from "@/components/layout/AppShell";
import { getProspect, getProspectCalls, getProspectTranscripts, getPractitioner } from "@/lib/data";
import { notFound } from "next/navigation";
import BackButton from "@/components/layout/BackButton";
import ProspectWorkspace from "@/components/prospect/ProspectWorkspace";

export const dynamic = "force-dynamic";

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [prospect, calls, transcripts, practitioner] = await Promise.all([
    getProspect(id),
    getProspectCalls(id),
    getProspectTranscripts(id),
    getPractitioner(),
  ]);
  if (!prospect) notFound();

  return (
    <AppShell title={prospect.full_name}>
      <BackButton label="Back to Prospects" />
      <ProspectWorkspace
        prospect={prospect}
        calls={calls}
        transcripts={transcripts}
        practitionerName={practitioner.full_name}
        practiceName={practitioner.practice_name}
      />
    </AppShell>
  );
}
