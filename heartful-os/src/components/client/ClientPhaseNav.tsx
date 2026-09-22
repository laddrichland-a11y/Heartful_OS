import Link from "next/link";
import { ListChecks } from "@/components/ui/HeartfulIcon";
import { getClient, getMilestones, getSessions } from "@/lib/data";
import { getClientJourneyProgress, phaseForStatus } from "@/lib/utils";
import { JourneyStageNav, PhaseNavKey } from "@/components/client/JourneyStageNav";

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
}: {
  clientId: string;
  current?: PhaseNavKey;
  hideClientSummary?: boolean;
}) {
  const [client, sessions, milestones] = await Promise.all([getClient(clientId), getSessions(clientId), getMilestones(clientId)]);
  if (!client) return null;
  const journeyProgress = getClientJourneyProgress(client, milestones);

  return (
    <section className="client-workspace-chrome wn-stage-chrome mb-6">
      <nav aria-label="Client record" className="client-surface wn-stage-client-tabs mb-5 flex gap-2 overflow-x-auto overflow-y-hidden px-5 py-2">
        {CLIENT_NAV.map((item) => <Link key={item.label} href={`/clients/${clientId}?tab=${encodeURIComponent(item.tab)}`} className={`wn-stage-client-tab ${item.label === "Journey" ? "is-active" : ""}`}>{item.label}</Link>)}
      </nav>
      <section id="journey-stages" className="client-surface wn-stage-journey journey-stages-card mb-5 px-5 py-5">
        <div className="mb-3 flex items-end justify-between gap-4"><div><h2 className="journey-icon-heading mt-0.5 text-base font-semibold text-ink-900"><ListChecks aria-hidden="true" />Journey stages</h2></div><span className="text-xs text-ink-400">{journeyProgress.completed} of {journeyProgress.total} stages complete</span></div>
        <JourneyStageNav clientId={clientId} sessions={sessions} milestones={milestones} activePhase={phaseForStatus(client.status, client.current_phase)} current={current} />
      </section>
    </section>
  );
}
