import AppShell from "@/components/layout/AppShell";
import { getClients, getOnHoldClients, getMilestones, getReferralSources, getSessions } from "@/lib/data";
import Link from "next/link";
import { cx, isActiveClient, isAwaitingIntegrationClient, isCompletedClient } from "@/lib/utils";
import { selectCurrentOrNextSession } from "@/lib/sessionSelectors";
import ClientList from "@/components/client/ClientList";
import NewClientButton from "@/components/client/NewClientButton";
import { PauseCircle } from "@/components/ui/HeartfulIcon";

export const dynamic = "force-dynamic";

type ClientFilter = "all" | "active" | "awaiting_integration" | "completed" | "inactive";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; new?: string; filter?: string }>;
}) {
  const { view, new: newClient, filter } = await searchParams;
  const showingHeld = view === "hold";
  const selectedFilter: ClientFilter =
    filter === "active" || filter === "awaiting_integration" || filter === "completed" || filter === "inactive" ? filter : "all";

  const [allClients, held, referralSources] = await Promise.all([
    getClients(),
    getOnHoldClients(),
    getReferralSources(),
  ]);
  const completedCount = allClients.filter((client) => isCompletedClient(client.status)).length;
  const activeCount = allClients.filter((client) => isActiveClient(client.status)).length;
  const awaitingIntegrationCount = allClients.filter((client) => isAwaitingIntegrationClient(client.status)).length;
  const inactiveCount = allClients.filter((client) => client.status === "inactive").length;
  const filterOptions: Array<{ key: ClientFilter; label: string; count: number; href: string }> = [
    { key: "all", label: "All", count: allClients.length, href: "/clients" },
    { key: "active", label: "Active", count: activeCount, href: "/clients?filter=active" },
    { key: "awaiting_integration", label: "Awaiting Integration", count: awaitingIntegrationCount, href: "/clients?filter=awaiting_integration" },
    { key: "completed", label: "Completed", count: completedCount, href: "/clients?filter=completed" },
    { key: "inactive", label: "Inactive", count: inactiveCount, href: "/clients?filter=inactive" },
  ];
  const filteredClients = allClients.filter((client) => {
    if (selectedFilter === "active") return isActiveClient(client.status);
    if (selectedFilter === "awaiting_integration") return isAwaitingIntegrationClient(client.status);
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
            <nav aria-label="Filter clients" className="inline-flex flex-wrap items-center rounded-full bg-ink-50 p-1">
              {filterOptions.map((option) => {
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
              : selectedFilter === "awaiting_integration"
                ? "No clients are awaiting integration."
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
