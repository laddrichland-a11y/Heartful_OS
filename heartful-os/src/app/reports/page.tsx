import AppShell from "@/components/layout/AppShell";
import { ClientGrowthChart, ReferralBarChart, StatusDonutChart } from "@/components/reports/ReportsCharts";
import ReportsNav from "@/components/reports/ReportsNav";
import { getReportsSummary } from "@/lib/data";
import { STATUS_LABELS } from "@/lib/types";
import { ClipboardList, TrendingUp, Users } from "@/components/ui/HeartfulIcon";

export const dynamic = "force-dynamic";

export default async function ReportsOverviewPage() {
  const summary = await getReportsSummary();
  const statusCounts = new Map<string, number>();
  for (const client of summary.clients) {
    const label = STATUS_LABELS[client.status];
    statusCounts.set(label, (statusCounts.get(label) ?? 0) + 1);
  }
  const statusData = Array.from(statusCounts.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const journeyMetrics = [
    { label: "Journeys completed", value: summary.journeyPerformance.completed },
    {
      label: "Average days between sessions",
      value: summary.journeyPerformance.averageDaysBetweenSessions === null
        ? "—"
        : `${summary.journeyPerformance.averageDaysBetweenSessions} days`,
      note: summary.journeyPerformance.averageDaysBetweenSessions === null
        ? "Available after a client completes two dated sessions"
        : "Average pace across completed client sessions",
    },
    {
      label: "Average sessions per journey",
      value: summary.journeyPerformance.averageSessionsPerJourney === null
        ? "—"
        : summary.journeyPerformance.averageSessionsPerJourney.toFixed(1),
      note: summary.journeyPerformance.averageSessionsPerJourney === null
        ? "Available after the first completed journey"
        : "Completed sessions before journey close",
    },
    {
      label: "Average time to completion",
      value: summary.journeyPerformance.averageDaysToCompletion ? `${summary.journeyPerformance.averageDaysToCompletion} days` : "—",
      note: summary.journeyPerformance.averageDaysToCompletion ? undefined : "Available as completion history grows",
    },
  ];

  return <AppShell title="Reports">
    <header className="reports-header">
      <div><h2 className="app-section-title text-ink-900">Practice analytics</h2><p>Understand how your practice is performing over time.</p></div>
      <ReportsNav current="overview" />
    </header>
    <section className="reports-kpi-grid" aria-label="Practice overview">
      <ReportMetric label="Total clients" value={summary.totalClients} icon={Users} tone="clay" />
      <ReportMetric label="Active clients" value={summary.activeClients} icon={TrendingUp} tone="sage" />
      <ReportMetric label="Journey completion rate" value={`${summary.journeyCompletionRate}%`} icon={ClipboardList} tone="vanilla" />
      <ReportMetric
        label="Average journey progress"
        value={`${summary.journeyPerformance.averageCompletionRate}%`}
        icon={TrendingUp}
        tone="sage"
      />
    </section>
    <div className="reports-grid reports-grid--balanced">
      <ReportCard title="Client growth" description="New clients over the last 12 months"><ClientGrowthChart data={summary.clientGrowth} /></ReportCard>
      <ReportCard title="Clients by journey status" description="Current distribution across the client journey"><StatusDonutChart data={statusData} /></ReportCard>
    </div>
    <div className="reports-grid reports-grid--referrals">
      <ReportCard title="Referral sources" description="Where current client relationships began"><ReferralBarChart data={summary.referralBreakdown} /></ReportCard>
      <ReportCard title="Journey performance" description="Aggregate progress across all client journeys">
        <div className="journey-performance-grid">
          {journeyMetrics.map((metric) => <div key={metric.label} className="journey-performance-metric"><strong>{metric.value}</strong><span>{metric.label}</span>{metric.note && <small>{metric.note}</small>}</div>)}
        </div>
      </ReportCard>
    </div>
  </AppShell>;
}

function ReportMetric({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: typeof Users; tone: "clay" | "sage" | "vanilla" }) {
  return <div className="report-metric report-metric--with-icon">
    <span className={`report-metric-icon report-metric-icon--${tone}`}><Icon aria-hidden="true" /></span>
    <span className="report-metric-copy"><strong>{value}</strong><span>{label}</span></span>
  </div>;
}

function ReportCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="card report-card"><div className="report-card-heading"><h2>{title}</h2><p>{description}</p></div>{children}</section>;
}
