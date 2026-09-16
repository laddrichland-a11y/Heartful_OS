import AppShell from "@/components/layout/AppShell";
import JourneyProgressBar from "@/components/JourneyProgressBar";
import DashboardOutstandingActions from "@/components/dashboard/DashboardOutstandingActions";
import DashboardDateStrip from "@/components/dashboard/DashboardDateStrip";
import { getAgreementStatusByClient, getDashboardSummary, getMilestones } from "@/lib/data";
import {
  Activity, ArrowRight, CalendarDays, CheckCircle2, ChevronRight, CircleAlert,
  ClipboardCheck, Clock3, DollarSign, FileText, Plus, Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  clientAvatarSrc, cx, formatDateTime, initials, isPastDue, outstandingItemHref,
  relativeDueLabel, SESSION_TYPE_LABELS, statusBadgeClasses,
} from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const summary = await getDashboardSummary();
  const agreementStatus = await getAgreementStatusByClient();
  const agreementByClient = new Map(agreementStatus.map((agreement) => [agreement.client_id, agreement]));
  const clientsWithMilestones = await Promise.all(
    summary.activeClientRecords.slice(0, 5).map(async (client) => ({ client, milestones: await getMilestones(client.id) }))
  );
  const metrics = [
    { label: "Active Clients", value: summary.activeClients, icon: Users, href: "/clients?filter=active", tone: "clients" },
    { label: "Awaiting Integration", value: summary.awaitingIntegration, icon: Activity, href: "/clients?filter=awaiting_integration", tone: "integration" },
    { label: "Outstanding Forms / Tasks", value: summary.outstandingTasksCount, icon: ClipboardCheck, href: "/outstanding", tone: "outstanding" },
    {
      label: "Revenue Collected",
      value: `$${summary.revenueTotal.toLocaleString()}`,
      icon: DollarSign,
      href: "/reports/revenue",
      tone: "revenue",
    },
  ];
  const dashboardOutstandingItems = summary.outstandingTasks.slice(0, 4);
  const calendarAnchor = summary.upcomingSessions[0]?.scheduled_at
    ? new Date(summary.upcomingSessions[0].scheduled_at)
    : new Date();

  return (
    <AppShell title="Dashboard">
      <div className="dashboard-welcome">
        <div><h2>Hello, Paul</h2></div>
        <p>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
      </div>
      <div className="dashboard-metrics" aria-label="Practice summary">
        {metrics.map(({ label, value, icon: Icon, href, tone }) => (
          <Link key={label} href={href} className={cx("dashboard-metric", `dashboard-metric--${tone}`)}>
            <span className={cx("dashboard-metric-icon", `dashboard-metric-icon--${tone}`)}><Icon aria-hidden="true" /></span>
            <span className="dashboard-metric-copy"><strong>{value}</strong><span>{label}</span></span>
            <ChevronRight aria-hidden="true" className="dashboard-metric-arrow" />
          </Link>
        ))}
      </div>

      <div className="dashboard-layout">
        <section className="dashboard-panel dashboard-sessions-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2 className="dashboard-accent-title">Upcoming Sessions</h2>
            </div>
            <div className="dashboard-header-actions">
              <Link href="/calendar" className="dashboard-add-action"><Plus aria-hidden="true" /> Add session</Link>
            </div>
          </div>
          <DashboardDateStrip initialDate={`${calendarAnchor.getFullYear()}-${String(calendarAnchor.getMonth() + 1).padStart(2, "0")}-${String(calendarAnchor.getDate()).padStart(2, "0")}`} />
          <div className="dashboard-session-table">
            <div className="dashboard-session-list">
              {summary.upcomingSessions.length === 0 && (
                <div className="dashboard-empty"><CalendarDays aria-hidden="true" /><p>No sessions scheduled.</p></div>
              )}
              {summary.upcomingSessions.map((session, index) => {
                const avatarSrc = clientAvatarSrc(session.client_name);
                const displaySessionType = index === summary.upcomingSessions.length - 1
                  ? "Completed"
                  : SESSION_TYPE_LABELS[session.session_type] ?? session.session_type.replace(/_/g, " ");
                return (
                <div key={session.id} className="dashboard-session-row">
                  <div className="dashboard-session-time"><Clock3 aria-hidden="true" /><span>{formatDateTime(session.scheduled_at)}</span></div>
                  <Link href={`/clients/${session.client_id}`} className="dashboard-client-link dashboard-session-client">
                    <span className="dashboard-session-avatar" aria-hidden="true">
                      {avatarSrc ? <Image src={avatarSrc} alt="" width={24} height={24} sizes="24px" /> : initials(session.client_name)}
                    </span>
                    <span className="dashboard-session-client-name">{session.client_name}</span>
                  </Link>
                  <span className="dashboard-session-type">{displaySessionType}</span>
                  <span className="badge status-pill--success">Scheduled</span>
                  <Link href={`/clients/${session.client_id}/sessions/${session.id}`} className="dashboard-row-action">
                    {session.location?.startsWith("http") ? "Join" : "Prepare"}<ArrowRight aria-hidden="true" />
                  </Link>
                </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="dashboard-rail">
          <section className="dashboard-panel dashboard-clients-panel">
            <div className="dashboard-panel-header dashboard-panel-header-compact">
              <h2 className="dashboard-accent-title">Active Clients</h2>
              <Link href="/clients" className="dashboard-clients-view-all">View all</Link>
            </div>
            <div className="dashboard-compact-list dashboard-client-list">
              {clientsWithMilestones.map(({ client, milestones }) => {
                const agreement = agreementByClient.get(client.id);
                const avatarSrc = clientAvatarSrc(client.full_name);
                return (
                  <Link key={client.id} href={`/clients/${client.id}`} className="dashboard-active-client">
                    <div className="dashboard-active-client-top">
                      <span className="dashboard-active-client-identity">
                        <span className="dashboard-active-client-avatar" aria-hidden="true">
                          {avatarSrc ? (
                            <Image src={avatarSrc} alt="" width={30} height={30} sizes="30px" />
                          ) : (
                            initials(client.full_name)
                          )}
                        </span>
                        <strong>{client.full_name}</strong>
                      </span>
                      <span className={cx("badge", statusBadgeClasses(client.status))}>{STATUS_LABELS[client.status]}</span>
                    </div>
                    <JourneyProgressBar milestones={milestones} compact />
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
                <h2><ClipboardCheck aria-hidden="true" /> Outstanding Forms &amp; Tasks</h2>
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
