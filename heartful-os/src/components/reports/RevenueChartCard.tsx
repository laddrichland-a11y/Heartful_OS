import { RevenueOverTimeChart } from "@/components/reports/ReportsCharts";

type ClientActivityPoint = { key: string; name: string; value: number; activeClients: number };
export default function RevenueChartCard({ clientActivity }: { clientActivity: ClientActivityPoint[] }) {
  return <section className="card report-card report-card--wide revenue-chart-card">
    <div className="report-card-heading-row">
      <div className="report-card-heading"><h2>Revenue over time</h2><p>Collected revenue and active clients in the selected period</p></div>
    </div>
    {clientActivity.length ? <RevenueOverTimeChart data={clientActivity} /> : <div className="revenue-chart-empty">No revenue recorded for this range.</div>}
  </section>;
}
