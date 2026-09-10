import AppShell from "@/components/layout/AppShell";
import { getClients, getOnHoldClients, getMilestones, getReferralSources } from "@/lib/data";
import Link from "next/link";
import { cx, formatDate, initials, statusBadgeClasses } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/types";
import JourneyProgressBar from "@/components/JourneyProgressBar";
import NewClientButton from "@/components/client/NewClientButton";
import { PauseCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const showingHeld = view === "hold";

  const [active, held, referralSources] = await Promise.all([
    getClients(),
    getOnHoldClients(),
    getReferralSources(),
  ]);
  const clients = showingHeld ? held : active;
  const withMilestones = await Promise.all(
    clients.map(async (c) => ({ client: c, milestones: await getMilestones(c.id) }))
  );

  return (
    <AppShell title="Clients">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-ink-400 hover:text-ink-700 flex items-center gap-1">
            ← Dashboard
          </Link>
          <p className="text-sm text-ink-500">
            {showingHeld ? `${held.length} on hold` : `${active.length} active clients`}
          </p>
        </div>
        <NewClientButton referralSources={referralSources} />
      </div>

      {/* Active / On hold toggle — held clients are excluded everywhere else,
          so this is the way back to them. */}
      {(held.length > 0 || showingHeld) && (
        <div className="flex items-center gap-2 mb-5">
          <Link
            href="/clients"
            className={cx(
              "text-xs px-3 py-1.5 rounded-full border transition-colors",
              !showingHeld
                ? "border-clay-300 bg-clay-50 text-clay-700 font-medium"
                : "border-ink-200 text-ink-500 hover:bg-ink-50"
            )}
          >
            Active ({active.length})
          </Link>
          <Link
            href="/clients?view=hold"
            className={cx(
              "text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5",
              showingHeld
                ? "border-amber-300 bg-amber-50 text-amber-800 font-medium"
                : "border-ink-200 text-ink-500 hover:bg-ink-50"
            )}
          >
            <PauseCircle className="h-3 w-3" /> On hold ({held.length})
          </Link>
        </div>
      )}

      {withMilestones.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-400">
          {showingHeld ? "Nobody is on hold right now." : "No active clients yet."}
        </div>
      ) : (
        <div className="grid gap-4">
          {withMilestones.map(({ client, milestones }) => {
            const referral = referralSources.find((r) => r.id === client.referral_source_id);
            return (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className={cx("card p-5 hover:shadow-md transition-shadow block", client.on_hold_at && "opacity-75")}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-full bg-clay-100 text-clay-700 flex items-center justify-center font-medium">
                      {initials(client.full_name)}
                    </div>
                    <div>
                      <div className="font-medium text-ink-900">{client.full_name}</div>
                      <div className="text-xs text-ink-500">
                        {client.email} · Client since {formatDate(client.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {client.on_hold_at && (
                      <span className="badge bg-amber-100 text-amber-800 flex items-center gap-1">
                        <PauseCircle className="h-3 w-3" />
                        {client.hold_follow_up_at ? `Follow up ${formatDate(client.hold_follow_up_at)}` : "On hold"}
                      </span>
                    )}
                    <span className={cx("badge", statusBadgeClasses(client.status))}>{STATUS_LABELS[client.status]}</span>
                    {referral && <span className="text-xs text-ink-400">via {referral.name}</span>}
                  </div>
                </div>
                <div className="mt-4">
                  <JourneyProgressBar milestones={milestones} compact />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
