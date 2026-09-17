import Link from "next/link";
import { Mail, Phone } from "@/components/ui/HeartfulIcon";
import { getClient, getMilestones, getSessions } from "@/lib/data";
import { STATUS_LABELS } from "@/lib/types";
import { formatDate, phaseForStatus } from "@/lib/utils";
import { getJourneyStageProgress, JourneyStageNav, PhaseNavKey } from "@/components/client/JourneyStageNav";

const CLIENT_NAV = [
  { label: "Overview", tab: "History" },
  { label: "Journey", tab: "Journey & AI" },
  { label: "Sessions", tab: "Sessions" },
  { label: "Documents", tab: "Documents" },
  { label: "Messages", tab: "Messages" },
  { label: "AI", tab: "AI Copilot" },
];

export default async function ClientPhaseNav({
  clientId,
  current,
  hideClientSummary = false,
}: {
  clientId: string;
  current?: PhaseNavKey;
  hideClientSummary?: boolean;
}) {
  const [client, sessions, milestones] = await Promise.all([getClient(clientId), getSessions(clientId), getMilestones(clientId)]);
  if (!client) return null;
  const journeyProgress = getJourneyStageProgress(milestones);

  return (
    <section className="client-workspace-chrome wn-stage-chrome mb-6">
      <div className={`client-surface wn-stage-header rounded-b-none border-b-0 px-5 pt-5 ${hideClientSummary ? "wn-stage-header--tabs-only" : ""}`}>
        {!hideClientSummary && (
          <div className="flex flex-wrap items-start justify-between gap-4 pb-4">
            <div>
              <p className="client-eyebrow">Client workspace</p>
              <div className="mt-1 flex flex-wrap items-center gap-2.5"><h1 className="app-page-title text-ink-900">{client.full_name}</h1><span className="badge bg-plum-50 text-plum-700">{STATUS_LABELS[client.status]}</span></div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
                {client.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{client.email}</span>}
                {client.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{client.phone}</span>}
                <span>Client since {formatDate(client.created_at)}</span>
              </div>
            </div>
            <Link href={`/clients/${clientId}`} className="btn-ghost border border-ink-100 bg-white text-xs">View client overview</Link>
          </div>
        )}
        <nav aria-label="Client workspace" className="wn-stage-record-tabs flex gap-6 overflow-x-auto border-b border-ink-100 px-1">
          {CLIENT_NAV.map((item) => <Link key={item.label} href={`/clients/${clientId}?tab=${encodeURIComponent(item.tab)}`} className={`relative shrink-0 py-3 text-sm font-medium transition-colors ${item.label === "Journey" ? "text-ink-900" : "text-ink-400 hover:text-ink-700"}`}>{item.label}{item.label === "Journey" && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-clay-500" />}</Link>)}
        </nav>
      </div>
      <div className="client-surface wn-stage-journey rounded-t-none border-t-0 px-5 pb-5 pt-4">
        <div className="mb-3 flex items-end justify-between gap-4"><div><p className="client-eyebrow">Journey</p><h2 className="mt-0.5 text-base font-semibold text-ink-900">Journey stages</h2></div><span className="text-xs text-ink-400">{journeyProgress.completed} of {journeyProgress.total} stages complete</span></div>
        <JourneyStageNav clientId={clientId} sessions={sessions} milestones={milestones} activePhase={phaseForStatus(client.status, client.current_phase)} current={current} />
      </div>
    </section>
  );
}
