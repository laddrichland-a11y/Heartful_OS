import AppShell from "@/components/layout/AppShell";
import JourneyProgressBar from "@/components/JourneyProgressBar";
import DashboardOutstandingActions from "@/components/dashboard/DashboardOutstandingActions";
import DashboardDateStrip from "@/components/dashboard/DashboardDateStrip";
import { getAgreementStatusByClient, getAllSessions, getDashboardSummary, getMilestones, getPractitioner } from "@/lib/data";
import {
  ArrowRight, CalendarDays, CheckCircle2, ChevronRight, CircleAlert,
  Clock3, DollarSign, FileText, IntegrationLink, OutstandingTasks, Plus, Users,
} from "@/components/ui/HeartfulIcon";
import ClientAvatarImage from "@/components/client/ClientAvatarImage";
import Link from "next/link";
import {
  clientAvatarSrc, clientJourneyWorkspaceHref, clientStatusBadgeClasses, cx, formatDateTime, initials, isPastDue, outstandingItemHref,
  relativeDueLabel, SESSION_TYPE_LABELS,
} from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [summary, practitioner, allSessions] = await Promise.all([
    getDashboardSummary(),
    getPractitioner(),
    getAllSessions(),
  ]);
  const activeClientRecords = summary.activeClientRecords.slice(0, 5);
  const [agreementStatus, clientsWithMilestones] = await Promise.all([
    getAgreementStatusByClient(activeClientRecords),
    Promise.all(activeClientRecords.map(async (client) => ({ client, milestones: await getMilestones(client.id) }))),
  ]);
  const agreementByClient = new Map(agreementStatus.map((agreement) => [agreement.client_id, agreement]));
  const metrics = [
    { label: "Active Clients", value: summary.activeClients, icon: Users, iconSize: 20, href: "/clients?filter=active", tone: "clients" },
    { label: "Awaiting Integration", value: summary.awaitingIntegration, icon: IntegrationLink, iconSize: 20, href: "/clients?filter=awaiting_integration", tone: "integration" },
    { label: "Outstanding Forms / Tasks", value: summary.outstandingTasksCount, icon: OutstandingTasks, iconSize: 20, href: "/outstanding", tone: "outstanding" },
    {
      label: "Revenue Collected",
      value: `$${summary.revenueTotal.toLocaleString()}`,
      icon: DollarSign,
      iconSize: 20,
      href: "/reports/revenue",
      tone: "revenue",
    },
  ];
  const dashboardOutstandingItems = summary.outstandingTasks.slice(0, 4);
  const dashboardSessions = allSessions.filter((session) => session.status === "scheduled");

  return (
    <AppShell title="Dashboard">
      <div className="dashboard-welcome">
        <div><h2>Hello, {practitioner.full_name}</h2></div>
        <p>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
      </div>
      <div className="dashboard-metrics" aria-label="Practice summary">
        {metrics.map(({ label, value, icon: Icon, iconSize, href, tone }) => (
          <Link key={label} href={href} className={cx("dashboard-metric", `dashboard-metric--${tone}`)}>
            <span className={cx("dashboard-metric-icon", `dashboard-metric-icon--${tone}`)}><Icon aria-hidden="true" width={iconSize} height={iconSize} strokeWidth={1.75} /></span>
            <span className="dashboard-metric-copy"><strong>{value}</strong><span>{label}</span></span>
            <ChevronRight aria-hidden="true" className="dashboard-metric-arrow" />
          </Link>
        ))}
      </div>

      <div className="dashboard-layout">
        <section className="dashboard-panel dashboard-sessions-panel">
          <DashboardDateStrip sessions={dashboardSessions} />
        </section>

        <aside className="dashboard-rail">
          <section className="dashboard-panel dashboard-clients-panel">
            <div className="dashboard-panel-header dashboard-panel-header-compact">
              <h2 className="dashboard-accent-title dashboard-section-title"><span className="dashboard-section-icon"><Users aria-hidden="true" width={20} height={20} strokeWidth={1.75} /></span>Active Clients</h2>
              <Link href="/clients" className="dashboard-clients-view-all">View all</Link>
            </div>
            <div className="dashboard-compact-list dashboard-client-list">
              {clientsWithMilestones.map(({ client, milestones }) => {
                const agreement = agreementByClient.get(client.id);
                const avatarSrc = clientAvatarSrc(client.full_name);
                return (
                  <Link key={client.id} href={clientJourneyWorkspaceHref(client)} className="dashboard-active-client">
                    <div className="dashboard-active-client-top">
                      <span className="dashboard-active-client-identity">
                        <span className="dashboard-active-client-avatar" aria-hidden="true">
                          {avatarSrc ? (
                            <ClientAvatarImage clientName={client.full_name} src={avatarSrc} width={30} height={30} sizes="30px" />
                          ) : (
                            initials(client.full_name)
                          )}
                        </span>
                        <strong>{client.full_name}</strong>
                      </span>
                      <span className={cx("badge", clientStatusBadgeClasses(client.status))}>{STATUS_LABELS[client.status]}</span>
                    </div>
                    <JourneyProgressBar client={client} milestones={milestones} compact />
                    <div className="dashboard-agreement-status">
                      {agreement?.complete ? <><CheckCircle2 /> Agreements signed</> : <><FileText /> Agreements {agreement?.signed_count ?? 0}/{agreement?.total_count ?? 3}</>}
                    </div>
                  </Link>
                );
              })}
              {clientsWithMilestones.length === 0 && <p className="dashboard-empty-copy">No active clients.</p>}
            </div>
          </section>

          <section className="dashboard-panel dashboard-attention-panel">
            <div className="dashboard-panel-header dashboard-panel-header-compact">
              <div>
                <h2 className="dashboard-section-title"><span className="dashboard-section-icon"><OutstandingTasks aria-hidden="true" width={20} height={20} strokeWidth={1.75} /></span>Outstanding Forms &amp; Tasks</h2>
                <p className="dashboard-attention-summary">
                  {summary.outstandingTasksCount} outstanding · {summary.overdueTasksCount} overdue
                </p>
              </div>
              <Link href="/outstanding" className="dashboard-attention-view-all">View all</Link>
            </div>
            <div className="dashboard-compact-list">
              {dashboardOutstandingItems.map((item) => {
                const overdue = item.status === "overdue" || isPastDue(item);
                const dueStatus = "kind" in item
                  ? (item.status === "in_progress" ? "In progress" : "Not started")
                  : relativeDueLabel(item.due_at) || "No due date";
                return (
                <article key={item.id} className="dashboard-attention-row">
                  <Link href={outstandingItemHref(item)} className="dashboard-attention-content">
                    <span className={cx("dashboard-attention-marker", overdue && "is-urgent")}>
                      {overdue ? <CircleAlert aria-hidden="true" /> : <FileText aria-hidden="true" />}
                    </span>
                    <span className="dashboard-list-copy">
                      <strong>{item.title}</strong>
                      <small>{item.client_name} · <span className={cx(overdue && "is-urgent")}>{dueStatus}</span></small>
                    </span>
                  </Link>
                  <DashboardOutstandingActions
                    clientId={item.client_id}
                    title={item.title}
                    taskId={"kind" in item ? undefined : item.id}
                  />
                </article>
                );
              })}
              {summary.outstandingTasksCount === 0 && (
                <div className="dashboard-all-clear"><CheckCircle2 /><span><strong>All caught up</strong><small>Nothing needs your attention right now.</small></span></div>
              )}
            </div>
          </section>

        </aside>
      </div>
    </AppShell>
  );
}
