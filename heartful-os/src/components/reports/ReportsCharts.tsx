"use client";

import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ChartDatum = { name: string; value: number };
const axis = { fill: "var(--text-muted)", fontSize: 12 };
const tooltip = { background: "var(--surface-nested)", border: "1px solid var(--divider)", borderRadius: 10, boxShadow: "0 8px 24px rgba(39, 41, 61, .08)", fontSize: 12 };

export function ClientGrowthChart({ data }: { data: ChartDatum[] }) {
  return <ResponsiveContainer width="100%" height={240}>
    <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
      <CartesianGrid stroke="var(--divider)" strokeOpacity={0.55} vertical={false} />
      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axis} dy={8} />
      <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={axis} />
      <Tooltip contentStyle={tooltip} cursor={{ fill: "var(--surface-hover)" }} formatter={(value) => [Number(value), "New clients"]} />
      <Bar dataKey="value" fill="var(--report-chart-primary, var(--brand-accent))" radius={[5, 5, 0, 0]} maxBarSize={28} />
    </BarChart>
  </ResponsiveContainer>;
}

export function StatusDonutChart({ data }: { data: ChartDatum[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const colors = [
    "var(--report-chart-primary, #f3774d)",
    "var(--report-chart-secondary, #74768a)",
    "var(--report-status-third, var(--report-chart-sage, #45a06f))",
    "var(--report-chart-rust, #c14a27)",
    "var(--report-chart-cream, #e4dbc4)",
    "var(--report-status-sixth, var(--report-chart-dark, #27293d))",
  ];
  return <div className="status-chart-layout">
    <div className="status-donut">
      <ResponsiveContainer width="100%" height={230}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="var(--surface-nested)" strokeWidth={2}>
            {data.map((item, index) => <Cell key={item.name} fill={colors[index % colors.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltip} formatter={(value) => [Number(value), "Clients"]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="status-donut-total"><strong>{total}</strong><span>Total clients</span></div>
    </div>
    <div className="status-breakdown" aria-label="Journey status breakdown">
      {data.map((item, index) => {
        const percentage = total ? Math.round(item.value / total * 100) : 0;
        return <div className="status-breakdown-row" key={item.name}>
          <span className="status-breakdown-label"><i style={{ background: colors[index % colors.length] }} />{item.name}</span>
          <span className="status-breakdown-value"><strong>{item.value}</strong><small>{percentage}%</small></span>
        </div>;
      })}
    </div>
  </div>;
}

export function ReferralBarChart({ data }: { data: { name: string; count: number }[] }) {
  return <ResponsiveContainer width="100%" height={Math.max(260, data.length * 56)}>
    <BarChart data={data} layout="vertical" margin={{ top: 2, right: 14, left: 10, bottom: 4 }}>
      <CartesianGrid stroke="var(--divider)" strokeDasharray="3 4" strokeOpacity={0.8} horizontal={false} />
      <XAxis type="number" allowDecimals={false} axisLine={{ stroke: "var(--text-muted)" }} tickLine={false} tick={axis} dy={6} />
      <YAxis type="category" dataKey="name" width={150} axisLine={false} tickLine={false} tick={{ ...axis, textAnchor: "start", dx: -144 }} />
      <Tooltip contentStyle={tooltip} cursor={{ fill: "var(--surface-hover)" }} formatter={(value) => [Number(value), "Clients"]} />
      <Bar dataKey="count" fill="var(--report-chart-secondary, #74768a)" radius={[0, 6, 6, 0]} barSize={36} />
    </BarChart>
  </ResponsiveContainer>;
}

export function RevenueOverTimeChart({ data }: { data: Array<ChartDatum & { activeClients: number }> }) {
  return <ResponsiveContainer width="100%" height={280}>
    <ComposedChart data={data} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
      <defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--report-chart-sage, var(--color-green-500))" stopOpacity={0.26} /><stop offset="100%" stopColor="var(--report-chart-sage, var(--color-green-500))" stopOpacity={0.02} /></linearGradient></defs>
      <CartesianGrid stroke="var(--divider)" strokeOpacity={0.42} vertical={false} />
      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axis} dy={8} />
      <YAxis yAxisId="revenue" axisLine={false} tickLine={false} tick={axis} tickFormatter={(value) => Number(value) >= 1000 ? `$${Number(value) / 1000}k` : `$${Number(value)}`} />
      <YAxis yAxisId="clients" orientation="right" allowDecimals={false} axisLine={false} tickLine={false} tick={axis} width={28} />
      <Tooltip
        contentStyle={tooltip}
        cursor={{ stroke: "var(--divider)", strokeWidth: 1 }}
        formatter={(value, name) => name === "Active clients"
          ? [Number(value), name]
          : [`$${Number(value).toLocaleString()}`, name]}
      />
      <Area yAxisId="revenue" type="monotone" dataKey="value" name="Revenue collected" stroke="var(--report-chart-sage, var(--color-green-600))" strokeWidth={2.5} fill="url(#revenueFill)" dot={{ r: 3, fill: "var(--surface-nested)", stroke: "var(--report-chart-sage, var(--color-green-600))", strokeWidth: 2 }} activeDot={{ r: 5 }} />
      <Line yAxisId="clients" type="monotone" dataKey="activeClients" name="Active clients" stroke="var(--report-chart-primary, var(--brand-accent))" strokeWidth={2.25} strokeDasharray="5 4" dot={{ r: 3, fill: "var(--surface-nested)", stroke: "var(--report-chart-primary, var(--brand-accent))", strokeWidth: 2 }} activeDot={{ r: 5 }} />
    </ComposedChart>
  </ResponsiveContainer>;
}
