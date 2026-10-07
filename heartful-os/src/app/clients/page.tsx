import AppShell from "@/components/layout/AppShell";
import { getAgreementStatusByClient, getClients, getOnHoldClients, getMilestones, getReferralSources, getSessions } from "@/lib/data";
import Link from "next/link";
import { cx, isActiveClient, isCompletedClient } from "@/lib/utils";
import { selectCurrentOrNextSession } from "@/lib/sessionSelectors";
import ClientList from "@/components/client/ClientList";
import NewClientButton from "@/components/client/NewClientButton";
import { PauseCircle } from "@/components/ui/HeartfulIcon";

export const dynamic = "force-dynamic";

type ClientFilter = "all" | "active" | "needs_scheduling" | "paperwork_missing" | "completed" | "inactive";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; new?: string; filter?: string }>;
}) {
  const { view, new: newClient, filter } = await searchParams;
  const showingHeld = view === "hold";
  const selectedFilter: ClientFilter =
    filter === "active" ||
    filter === "needs_scheduling" ||
    filter === "paperwork_missing" ||
    filter === "completed" ||
    filter === "inactive"
      ? filter
      : "all";

  const [allClients, held, referralSources] = await Promise.all([
    getClients(),
    getOnHoldClients(),
    getReferralSources(),
  ]);
  const completedCount = allClients.filter((client) => isCompletedClient(client.status)).length;
  const activeCount = allClients.filter((client) => isActiveClient(client.status)).length;
  const activeClients = allClients.filter((client) => isActiveClient(client.status));
  // Active clients with nothing current or upcoming on the calendar — the ones
  // most likely to slip through the cracks.
  const [activeSessions, activeAgreements] = await Promise.all([
    Promise.all(activeClients.map((client) => getSessions(client.id))),
    getAgreementStatusByClient(activeClients),
  ]);
  const needsSchedulingIds = new Set(
    activeClients
      .filter((_, index) => !selectCurrentOrNextSession(activeSessions[index]))
      .map((client) => client.id)
  );
  // Active clients who haven't completed all three signed-once agreements.
  const paperworkMissingIds = new Set(
    activeAgreements
      .filter((agreement) => agreement.total_count > 0 && !agreement.complete)
      .map((agreement) => agreement.client_id)
  );
  const inactiveCount = allClients.filter((client) => client.status === "inactive").length;
  const filterOptions: Array<{ key: ClientFilter; label: string; count: number; href: string }> = [
    { key: "all", label: "All", count: allClients.length, href: "/clients" },
    { key: "active", label: "Active", count: activeCount, href: "/clients?filter=active" },
    { key: "needs_scheduling", label: "Needs Scheduling", count: needsSchedulingIds.size, href: "/clients?filter=needs_scheduling" },
    { key: "paperwork_missing", label: "Paperwork Missing", count: paperworkMissingIds.size, href: "/clients?filter=paperwork_missing" },
    { key: "completed", label: "Completed", count: completedCount, href: "/clients?filter=completed" },
    { key: "inactive", label: "Inactive", count: inactiveCount, href: "/clients?filter=inactive" },
  ];
  const filteredClients = allClients.filter((client) => {
    if (selectedFilter === "active") return isActiveClient(client.status);
    if (selectedFilter === "needs_scheduling") return needsSchedulingIds.has(client.id);
    if (selectedFilter === "paperwork_missing") return paperworkMissingIds.has(client.id);
    if (selectedFilter === "completed") return isCompletedClient(client.status);
    if (selectedFilter === "inactive") return client.status === "inactive";
    return true;
  });
  const clients = showingHeld ? held : filteredClients;
  const withMilestones = await Promise.all(
    clients.map(async (client) => {
      const [milestones, sessions] = await Promise.all([getMilestones(client.id), getSessions(client.id)]);
      return {
        client,
        milestones,
        sessions,
        referralName: referralSources.find((source) => source.id === client.referral_source_id)?.name,
        hasScheduledSession: Boolean(selectCurrentOrNextSession(sessions)),
      };
    })
  );
  const orderedClients = [...withMilestones].sort(
    (a, b) => Number(isCompletedClient(a.client.status)) - Number(isCompletedClient(b.client.status))
  );

  return (
    <AppShell title="Clients">
      <div className="clients-typography">
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/dashboard" className="text-sm text-ink-400 hover:text-ink-700 flex items-center gap-1">
            ← Dashboard
          </Link>
          {showingHeld ? (
            <p className="text-sm text-ink-500">{held.length} on hold</p>
          ) : (
            <>
              {/* Status pills always add up to "All". The to-do filters are
                  subsets of Active, so they sit in their own group. */}
              {[
                { label: "Filter clients by status", keys: ["all", "active", "completed", "inactive"] },
                { label: "Clients needing action", keys: ["needs_scheduling", "paperwork_missing"] },
              ].map((group) => (
                <nav key={group.label} aria-label={group.label} className="inline-flex flex-wrap items-center rounded-full bg-ink-50 p-1">
                  {filterOptions
                    .filter((option) => group.keys.includes(option.key))
                    .map((option) => {
                      const selected = selectedFilter === option.key;
                      return (
                        <Link
                          key={option.key}
                          href={option.href}
                          aria-current={selected ? "page" : undefined}
                          className={cx(
                            "inline-flex h-7 items-center gap-1.5 rounded-full px-4 py-0 text-sm font-semibold transition-colors",
                            selected
                              ? "bg-clay-50 text-clay-800"
                              : "text-ink-500 hover:bg-white hover:text-ink-700"
                          )}
                        >
                          {option.label}
                          <span className={selected ? "text-clay-700" : "text-ink-400"}>{option.count}</span>
                        </Link>
                      );
                    })}
                </nav>
              ))}
            </>
          )}
        </div>
        <NewClientButton referralSources={referralSources} initialOpen={newClient === "1"} />
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
            Clients ({allClients.length})
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

      <ClientList
        items={orderedClients}
        emptyMessage={
          showingHeld
            ? "Nobody is on hold right now."
            : selectedFilter === "active"
              ? "No active clients."
              : selectedFilter === "needs_scheduling"
                ? "Every active client has a session on the calendar."
              : selectedFilter === "paperwork_missing"
                ? "Every active client has signed all their agreements."
              : selectedFilter === "completed"
                ? "No completed clients."
                : selectedFilter === "inactive"
                  ? "No inactive clients."
                : "No clients yet."
        }
      />
      </div>
    </AppShell>
  );
}
