"use client";

import { useMemo, useState } from "react";
import FilterSelect from "@/components/client/FilterSelect";
import { RevenueOverTimeChart } from "@/components/reports/ReportsCharts";

type Period = "month" | "3-months" | "6-months" | "year" | "custom";
type PaymentPoint = { date: string; amount: number };
type ClientActivityPoint = { key: string; activeClients: number };

const periodOptions = [
  { value: "month", label: "This month" },
  { value: "3-months", label: "Last 3 months" },
  { value: "6-months", label: "Last 6 months" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Custom range" },
];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function periodStart(period: Period, now: Date) {
  if (period === "month") return startOfMonth(now);
  if (period === "3-months") return new Date(now.getFullYear(), now.getMonth() - 2, 1);
  if (period === "6-months") return new Date(now.getFullYear(), now.getMonth() - 5, 1);
  return new Date(now.getFullYear(), 0, 1);
}

export default function RevenueChartCard({ payments, clientActivity }: { payments: PaymentPoint[]; clientActivity: ClientActivityPoint[] }) {
  const now = useMemo(() => new Date(), []);
  const [period, setPeriod] = useState<Period>("year");
  const [customStart, setCustomStart] = useState(dateKey(new Date(now.getFullYear(), 0, 1)));
  const [customEnd, setCustomEnd] = useState(dateKey(now));

  const chartData = useMemo(() => {
    const start = period === "custom" ? new Date(`${customStart}T00:00:00`) : periodStart(period, now);
    const end = period === "custom" ? new Date(`${customEnd}T23:59:59`) : now;
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

    const buckets = [];
    for (let cursor = startOfMonth(start); cursor <= end; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      const crossesYears = start.getFullYear() !== end.getFullYear();
      buckets.push({
        key,
        name: cursor.toLocaleDateString("en-US", { month: "short", ...(crossesYears ? { year: "2-digit" } : {}) }),
        value: 0,
      });
    }

    const byMonth = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    const activeClientsByMonth = new Map(clientActivity.map((month) => [month.key, month.activeClients]));
    for (const payment of payments) {
      const paidAt = new Date(`${payment.date.slice(0, 10)}T12:00:00`);
      if (paidAt < start || paidAt > end) continue;
      const bucket = byMonth.get(payment.date.slice(0, 7));
      if (bucket) bucket.value += payment.amount;
    }
    return buckets.map(({ key, name, value }) => ({ name, value, activeClients: activeClientsByMonth.get(key) ?? 0 }));
  }, [clientActivity, customEnd, customStart, now, payments, period]);

  const invalidRange = period === "custom" && customStart > customEnd;

  return <section className="card report-card report-card--wide revenue-chart-card">
    <div className="report-card-heading-row">
      <div className="report-card-heading"><h2>Revenue over time</h2><p>Collected revenue and active clients by month</p></div>
      <FilterSelect
        ariaLabel="Revenue chart period"
        value={period}
        options={periodOptions}
        onChange={(value) => setPeriod(value as Period)}
        active={period !== "year"}
        className="revenue-period-select"
        menuClassName="left-auto right-0 w-48"
      />
    </div>
    {period === "custom" && <div className="revenue-date-range" aria-label="Custom revenue date range">
      <label><span>From</span><input type="date" value={customStart} max={customEnd} onChange={(event) => setCustomStart(event.target.value)} /></label>
      <label><span>To</span><input type="date" value={customEnd} min={customStart} max={dateKey(now)} onChange={(event) => setCustomEnd(event.target.value)} /></label>
      {invalidRange && <p role="alert">Choose an end date after the start date.</p>}
    </div>}
    {chartData.length ? <RevenueOverTimeChart data={chartData} /> : <div className="revenue-chart-empty">No revenue recorded for this range.</div>}
  </section>;
}
