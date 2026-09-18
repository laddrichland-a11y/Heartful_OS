import Link from "next/link";
import ClientAvatarImage from "@/components/client/ClientAvatarImage";
import AppShell from "@/components/layout/AppShell";
import RevenueChartCard from "@/components/reports/RevenueChartCard";
import ReportsNav from "@/components/reports/ReportsNav";
import PaymentRowActions from "@/components/reports/PaymentRowActions";
import { getReportsSummary } from "@/lib/data";
import { clientAvatarSrc, formatCurrency, formatDate, initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RevenueReportsPage() {
  const summary = await getReportsSummary();
  return <AppShell title="Reports">
    <header className="reports-header">
      <div><h2 className="app-section-title text-ink-900">Revenue analytics</h2><p>Track collections and outstanding balances over time.</p></div>
      <ReportsNav current="revenue" />
    </header>
    <section className="reports-revenue-summary" aria-label="Revenue summary">
      <ReportMetric label="Revenue collected" value={formatCurrency(summary.revenueTotal)} />
      <ReportMetric label="Outstanding" value={formatCurrency(summary.outstandingBalance)} tone="warning" />
      <ReportMetric label="Expected revenue" value={formatCurrency(summary.expectedTotal)} />
      <ReportMetric label="Average payment" value={formatCurrency(summary.averagePayment)} />
    </section>
    <RevenueChartCard payments={summary.revenuePayments} clientActivity={summary.revenueByMonth} />
    <div className="reports-grid reports-grid--tables">
      <PaymentTable title="Outstanding payments" empty="No outstanding balances." headings={["Client", "Amount", "Due date", "Status", "Actions"]}>
        {summary.outstandingPayments.map((payment) => <tr key={payment.clientId}>
          <td><PaymentClientLink clientId={payment.clientId} clientName={payment.client} /></td><td>{formatCurrency(payment.amount)}</td><td>{payment.dueDate ? formatDate(payment.dueDate) : "—"}</td><td><span className="report-status report-status--outstanding">{payment.status}</span></td><td className="report-table-actions"><PaymentRowActions clientId={payment.clientId} outstanding={payment.amount} dueDate={payment.dueDate} /></td>
        </tr>)}
      </PaymentTable>
      <PaymentTable title="Recent payments" empty="No recorded payments yet." headings={["Client", "Amount", "Date", "Status", "Actions"]}>
        {summary.recentPayments.map((payment) => <tr key={payment.id}>
          <td><PaymentClientLink clientId={payment.clientId} clientName={payment.client} /></td><td>{formatCurrency(payment.amount)}</td><td>{formatDate(payment.date)}</td><td><span className="report-status report-status--paid">{payment.status}</span></td><td className="report-table-actions"><PaymentRowActions clientId={payment.clientId} payment={payment} /></td>
        </tr>)}
      </PaymentTable>
    </div>
  </AppShell>;
}

function ReportMetric({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return <div className="report-metric" data-tone={tone}><span>{label}</span><strong>{value}</strong></div>;
}

function PaymentClientLink({ clientId, clientName }: { clientId: string; clientName: string }) {
  const avatarSrc = clientAvatarSrc(clientName);
  return <Link href={`/clients/${clientId}`} className="report-client-link">
    <span className="report-client-avatar" aria-hidden="true">
      {avatarSrc ? <ClientAvatarImage clientName={clientName} src={avatarSrc} width={24} height={24} sizes="24px" /> : initials(clientName)}
    </span>
    <span>{clientName}</span>
  </Link>;
}

function PaymentTable({ title, headings, empty, children }: { title: string; headings: string[]; empty: string; children: React.ReactNode }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="card report-card"><div className="report-card-heading"><h2>{title}</h2></div><div className="report-table-wrap"><table className="report-table"><thead><tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{children}</tbody></table>{!hasRows && <p className="report-empty">{empty}</p>}</div></section>;
}
