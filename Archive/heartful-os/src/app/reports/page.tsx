import AppShell from "@/components/layout/AppShell";
import { getDashboardSummary, getJourneyCompletionRate } from "@/lib/data";
import { STATUS_LABELS } from "@/lib/types";
import StatCard from "@/components/ui/StatCard";
import { ReferralBarChart, StatusPieChart, RevenueBarChart } from "@/components/reports/ReportsCharts";
import { formatCurrency } from "@/lib/utils";
import { Users, TrendingUp, DollarSign, ClipboardList } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [summary, completionRate] = await Promise.all([getDashboardSummary(), getJourneyCompletionRate()]);

  const statusCounts = new Map<string, number>();
  for (const c of summary.clients) {
    const label = STATUS_LABELS[c.status];
    statusCounts.set(label, (statusCounts.get(label) ?? 0) + 1);
  }
  const statusData = Array.from(statusCounts.entries()).map(([name, value]) => ({ name, value }));

  const revenueData = [
    { name: "Collected", value: summary.revenueTotal },
    { name: "Outstanding", value: summary.outstandingBalance },
    { name: "Expected Total", value: summary.expectedTotal },
  ];

  return (
    <AppShell title="Reports">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Clients" value={summary.totalClients} icon={Users} accent="clay" />
        <StatCard label="Active Clients" value={summary.activeClients} icon={TrendingUp} accent="sage" />
        <StatCard label="Journey Completion Rate" value={`${completionRate}%`} icon={ClipboardList} accent="plum" />
        <StatCard label="Revenue Collected" value={formatCurrency(summary.revenueTotal)} icon={DollarSign} accent="clay" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-5">
          <h2 className="font-semibold text-ink-900 mb-3">Referral Sources</h2>
          <ReferralBarChart data={summary.referralBreakdown} />
        </div>
        <div className="card p-5">
          <h2 className="font-semibold text-ink-900 mb-3">Clients by Journey Status</h2>
          <StatusPieChart data={statusData} />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-semibold text-ink-900 mb-3">Revenue Overview</h2>
          <RevenueBarChart data={revenueData} />
        </div>
        <div className="card p-5">
          <h2 className="font-semibold text-ink-900 mb-3">Upcoming Sessions</h2>
          <ul className="space-y-2">
            {summary.upcomingSessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm border-b border-ink-100 pb-2 last:border-0">
                <span className="text-ink-800">{s.client_name}</span>
                <span className="text-ink-400 text-xs capitalize">{s.session_type.replace(/_/g, " ")}</span>
              </li>
            ))}
            {summary.upcomingSessions.length === 0 && <p className="text-sm text-ink-400">Nothing scheduled.</p>}
          </ul>
          <h2 className="font-semibold text-ink-900 mt-5 mb-3">Outstanding Forms &amp; Tasks ({summary.outstandingTasksCount})</h2>
          <ul className="space-y-2">
            {summary.outstandingTasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm border-b border-ink-100 pb-2 last:border-0">
                <span className="text-ink-800">{t.title}</span>
                <span className="text-ink-400 text-xs">{t.client_name}</span>
              </li>
            ))}
            {summary.outstandingTasks.length === 0 && <p className="text-sm text-ink-400">Nothing outstanding.</p>}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
