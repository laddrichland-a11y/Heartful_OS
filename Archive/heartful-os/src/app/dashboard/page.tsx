import AppShell from "@/components/layout/AppShell";
import StatCard from "@/components/ui/StatCard";
import JourneyProgressBar from "@/components/JourneyProgressBar";
import { getAgreementStatusByClient, getDashboardSummary, getMilestones } from "@/lib/data";
import { Users, Activity, Sparkles, DollarSign, Calendar, ClipboardList, MessageSquare, FileSignature, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { cx, formatCurrency, formatDateTime, relativeDueLabel, statusBadgeClasses } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const summary = await getDashboardSummary();
  const agreementStatus = await getAgreementStatusByClient();
  const agreementsPending = agreementStatus.filter((a) => !a.complete);
  // Recently finished — shown briefly so a completed set registers as news
  // rather than just silently vanishing from the pending list.
  const agreementsRecentlyDone = agreementStatus
    .filter((a) => a.complete && a.completed_at)
    .slice(0, 3);
  const clientsWithMilestones = await Promise.all(
    summary.clients.slice(0, 8).map(async (c) => ({ client: c, milestones: await getMilestones(c.id) }))
  );

  return (
    <AppShell title="Dashboard">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Clients" value={summary.activeClients} icon={Users} accent="clay" href="/clients" />
        <StatCard label="Awaiting Integration" value={summary.awaitingIntegration} icon={Activity} accent="plum" href="/clients" />
        <StatCard label="Outstanding Forms / Tasks" value={summary.outstandingTasksCount} icon={ClipboardList} accent="ink" href="/outstanding" />
        <StatCard
          label="Revenue Collected"
          value={formatCurrency(summary.revenueTotal)}
          icon={DollarSign}
          accent="sage"
          sub={`MTD ${formatCurrency(summary.revenueMTD)} · YTD ${formatCurrency(summary.revenueYTD)} · ${formatCurrency(summary.outstandingBalance)} outstanding`}
          href="/settings"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-ink-900">Client Journey Status</h2>
              <Link href="/clients" className="text-sm text-clay-600 hover:underline">
                View all clients
              </Link>
            </div>
            <div className="space-y-5">
              {clientsWithMilestones.map(({ client, milestones }) => (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="block p-3 -mx-3 rounded-xl hover:bg-ink-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-ink-900">{client.full_name}</div>
                    <span className={cx("badge", statusBadgeClasses(client.status))}>{STATUS_LABELS[client.status]}</span>
                  </div>
                  <JourneyProgressBar milestones={milestones} />
                </Link>
              ))}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-semibold text-ink-900 mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-clay-500" /> Upcoming Sessions
            </h2>
            <div className="divide-y divide-ink-100">
              {summary.upcomingSessions.length === 0 && (
                <p className="text-sm text-ink-400 py-2">No sessions scheduled.</p>
              )}
              {summary.upcomingSessions.map((s) => (
                <Link
                  key={s.id}
                  href={`/clients/${s.client_id}`}
                  className="flex items-center justify-between py-2.5 hover:bg-ink-50 -mx-2 px-2 rounded-lg"
                >
                  <div>
                    <div className="text-sm font-medium text-ink-900">{s.client_name}</div>
                    <div className="text-xs text-ink-500 capitalize">{s.session_type.replace(/_/g, " ")}</div>
                  </div>
                  <div className="text-xs text-ink-500">{formatDateTime(s.scheduled_at)}</div>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          {summary.unreadMessageThreads.length > 0 && (
            <section className="card p-5">
              <h2 className="font-semibold text-ink-900 mb-4 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-clay-500" /> Unread Messages
                <span className="ml-auto text-xs font-semibold bg-clay-500 text-white rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center">
                  {summary.unreadMessageCount}
                </span>
              </h2>
              <div className="space-y-2">
                {summary.unreadMessageThreads.map((t) => (
                  <Link
                    key={t.client_id}
                    href={`/clients/${t.client_id}?tab=Messages`}
                    className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-ink-50"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink-900">{t.client_name}</div>
                      <div className="text-xs text-ink-500 truncate">{t.latest_body}</div>
                    </div>
                    <span className="badge bg-clay-100 text-clay-700 shrink-0">{t.count}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Agreements & consents — the three forms the portal blocks a new
              client on. Kept separate from "Outstanding Forms & Tasks" on
              purpose: this is onboarding paperwork the practitioner is
              waiting on, not per-session work. */}
          <section className="card p-5">
            <h2 className="font-semibold text-ink-900 mb-1 flex items-center gap-2">
              <FileSignature className="h-4 w-4 text-clay-500" /> Client Agreements
              {agreementsPending.length > 0 && (
                <span className="ml-auto text-xs font-semibold bg-amber-500 text-white rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center">
                  {agreementsPending.length}
                </span>
              )}
            </h2>
            <p className="text-xs text-ink-400 mb-4">Signed once, in the client portal, before anything else opens up</p>

            {agreementsPending.length === 0 && agreementsRecentlyDone.length === 0 ? (
              <p className="text-sm text-ink-400">No clients yet.</p>
            ) : (
              <div className="space-y-2">
                {agreementsPending.length === 0 && (
                  <p className="text-sm text-sage-700 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Everyone&apos;s paperwork is signed.
                  </p>
                )}

                {agreementsPending.map((a) => (
                  <Link
                    key={a.client_id}
                    href={`/clients/${a.client_id}?tab=Documents`}
                    className="flex items-center justify-between gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-ink-50"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink-900 truncate">{a.client_name}</div>
                      <div className="text-xs text-ink-400 truncate">
                        {a.portal_account_created
                          ? a.signed_count === 0
                            ? "Portal set up — hasn't started"
                            : `Still owes: ${a.outstanding_titles.join(", ")}`
                          : "Hasn't set up their portal login yet"}
                      </div>
                    </div>
                    <span
                      className={cx(
                        "badge shrink-0",
                        a.signed_count === 0 ? "bg-ink-100 text-ink-600" : "bg-amber-100 text-amber-700"
                      )}
                    >
                      {a.signed_count} of {a.total_count}
                    </span>
                  </Link>
                ))}

                {agreementsRecentlyDone.map((a) => (
                  <Link
                    key={a.client_id}
                    href={`/clients/${a.client_id}?tab=Documents`}
                    className="flex items-center justify-between gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-ink-50"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-ink-900 truncate">{a.client_name}</div>
                      <div className="text-xs text-ink-400">Signed {formatDateTime(a.completed_at)}</div>
                    </div>
                    <span className="badge shrink-0 bg-sage-100 text-sage-700 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> All signed
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="card p-5">
            <h2 className="font-semibold text-ink-900 mb-4 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-clay-500" /> Outstanding Forms &amp; Tasks
            </h2>
            <div className="space-y-2">
              {summary.outstandingTasks.length === 0 && <p className="text-sm text-ink-400">All caught up.</p>}
              {summary.outstandingTasks.map((t) => (
                <Link
                  key={t.id}
                  href={`/clients/${t.client_id}`}
                  className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-ink-50"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-ink-900 truncate">{t.title}</div>
                    <div className="text-xs text-ink-400">{t.client_name}</div>
                  </div>
                  <span
                    className={cx(
                      "badge shrink-0",
                      t.status === "overdue" ? "bg-clay-100 text-clay-700" : "bg-ink-100 text-ink-600"
                    )}
                  >
                    {"kind" in t && t.kind === "form"
                      ? t.status === "in_progress"
                        ? "In Progress"
                        : "Not Started"
                      : relativeDueLabel(t.due_at)}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-semibold text-ink-900 mb-4">Referral Sources</h2>
            <div className="space-y-2">
              {summary.referralBreakdown
                .sort((a, b) => b.count - a.count)
                .map((r) => (
                  <div key={r.name} className="flex items-center justify-between text-sm">
                    <span className="text-ink-700">{r.name}</span>
                    <span className="text-ink-400">{r.count}</span>
                  </div>
                ))}
            </div>
          </section>

          <Link
            href="/copilot"
            className="card p-5 flex items-center gap-3 bg-gradient-to-br from-plum-50 to-clay-50 hover:shadow-md transition-shadow"
          >
            <div className="h-10 w-10 rounded-xl bg-plum-500 text-white flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="font-medium text-ink-900">Prep Center</div>
              <div className="text-xs text-ink-500">Prepare for your next session</div>
            </div>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
