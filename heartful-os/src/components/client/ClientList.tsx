"use client";

import ClientAvatarImage from "@/components/client/ClientAvatarImage";
import Link from "next/link";
import { Search, SlidersHorizontal } from "@/components/ui/HeartfulIcon";
import JourneyProgressBar from "@/components/JourneyProgressBar";
import FilterSelect from "@/components/client/FilterSelect";
import { Client, ClientStatus, JourneyMilestone } from "@/lib/types";
import { clientAvatarSrc, clientStatusBadgeClasses, cx, formatDate, initials } from "@/lib/utils";
import { useMemo, useState } from "react";

type StageFilter = "all" | "intake" | "preparation" | "journey" | "integration";
type PaymentFilter = "all" | "paid" | "balance";
type PortalFilter = "all" | "enabled" | "not_enabled";
type SessionFilter = "all" | "scheduled" | "not_scheduled";

export interface ClientListItem {
  client: Client;
  milestones: JourneyMilestone[];
  referralName?: string;
  hasScheduledSession: boolean;
}

const CLIENT_LIST_STATUS_LABELS: Record<ClientStatus, string> = {
  inquiry: "Inquiry",
  intake_scheduled: "Intake",
  intake_complete: "Intake",
  preparation: "Preparation",
  preparation_complete: "Preparation",
  journey_scheduled: "Journey",
  journey_complete: "Awaiting Integration",
  check_in_complete: "Check-in",
  integration_1: "Integration 1",
  integration_1_complete: "Integration 1",
  integration_2: "Integration 2",
  integration_2_complete: "Integration 2",
  journey_closed: "Completed",
  inactive: "Inactive",
};

function isCompletedClient(status: ClientStatus) {
  return status === "journey_complete" || status === "journey_closed" || status === "inactive";
}

function clientActionLabel(status: ClientStatus) {
  if (isCompletedClient(status)) return "View client →";
  if (status === "intake_scheduled" || status === "intake_complete") return "Open intake →";
  if (status === "preparation" || status === "preparation_complete") return "Continue preparation →";
  if (status === "journey_scheduled") return "Open journey →";
  if (status === "check_in_complete") return "Review check-in →";
  if (status.startsWith("integration")) return "Continue integration →";
  return "Open client →";
}

function stageForStatus(status: ClientStatus): Exclude<StageFilter, "all"> {
  if (status === "inquiry" || status.startsWith("intake")) return "intake";
  if (status.startsWith("preparation")) return "preparation";
  if (status === "journey_scheduled" || status === "journey_complete" || status === "journey_closed") {
    return "journey";
  }
  return "integration";
}

const controlClass =
  "h-9 rounded-lg border border-ink-100 bg-[var(--surface-control)] text-sm text-ink-600 outline-none transition-colors hover:border-ink-200 focus:border-clay-300 focus:ring-2 focus:ring-clay-100";

const STAGE_OPTIONS = [
  { value: "all", label: "Stage" },
  { value: "intake", label: "Intake" },
  { value: "preparation", label: "Preparation" },
  { value: "journey", label: "Journey" },
  { value: "integration", label: "Integration" },
];

const PAYMENT_OPTIONS = [
  { value: "all", label: "Any payment status" },
  { value: "paid", label: "Paid in full" },
  { value: "balance", label: "Balance remaining" },
];

const PORTAL_OPTIONS = [
  { value: "all", label: "Any portal status" },
  { value: "enabled", label: "Access enabled" },
  { value: "not_enabled", label: "Access not enabled" },
];

const SESSION_OPTIONS = [
  { value: "all", label: "Any schedule" },
  { value: "scheduled", label: "Session scheduled" },
  { value: "not_scheduled", label: "No session scheduled" },
];

export default function ClientList({ items, emptyMessage }: { items: ClientListItem[]; emptyMessage: string }) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<StageFilter>("all");
  const [referral, setReferral] = useState("all");
  const [payment, setPayment] = useState<PaymentFilter>("all");
  const [portal, setPortal] = useState<PortalFilter>("all");
  const [session, setSession] = useState<SessionFilter>("all");

  const referralOptions = useMemo(
    () =>
      Array.from(
        new Map(
          items
            .filter((item) => item.client.referral_source_id && item.referralName)
            .map((item) => [item.client.referral_source_id!, item.referralName!])
        ).entries()
      ).map(([id, name]) => ({ id, name })),
    [items]
  );

  const hasFilters =
    query.trim().length > 0 ||
    stage !== "all" ||
    referral !== "all" ||
    payment !== "all" ||
    portal !== "all" ||
    session !== "all";
  const hasMoreFilters = payment !== "all" || portal !== "all" || session !== "all";

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return items.filter(({ client, hasScheduledSession }) => {
      if (
        normalizedQuery &&
        !client.full_name.toLocaleLowerCase().includes(normalizedQuery) &&
        !client.email?.toLocaleLowerCase().includes(normalizedQuery)
      ) {
        return false;
      }
      if (stage !== "all" && stageForStatus(client.status) !== stage) return false;
      if (referral !== "all" && client.referral_source_id !== referral) return false;

      const paidInFull = Boolean(client.package_value && (client.amount_paid ?? 0) >= client.package_value);
      if (payment === "paid" && !paidInFull) return false;
      if (payment === "balance" && paidInFull) return false;

      const hasPortalAccess = Boolean(client.portal_user_id);
      if (portal === "enabled" && !hasPortalAccess) return false;
      if (portal === "not_enabled" && hasPortalAccess) return false;
      if (session === "scheduled" && !hasScheduledSession) return false;
      if (session === "not_scheduled" && hasScheduledSession) return false;
      return true;
    });
  }, [items, payment, portal, query, referral, session, stage]);

  function clearFilters() {
    setQuery("");
    setStage("all");
    setReferral("all");
    setPayment("all");
    setPortal("all");
    setSession("all");
  }

  return (
    <>
      <div
        className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center"
        aria-label="Search and filter clients"
      >
        <label
          className={cx(
            controlClass,
            "flex min-w-0 items-center gap-2 px-3 focus-within:border-clay-300 focus-within:ring-2 focus-within:ring-clay-100 lg:w-[360px] lg:shrink-0",
            query && "border-clay-300 bg-clay-50"
          )}
        >
          <Search className="h-4 w-4 shrink-0 text-ink-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search clients..."
            className="client-list-search-input min-w-0 flex-1 bg-transparent text-sm text-ink-600 outline-none placeholder:text-ink-400"
          />
        </label>

        <FilterSelect
          ariaLabel="Stage"
          value={stage}
          options={STAGE_OPTIONS}
          onChange={(value) => setStage(value as StageFilter)}
          active={stage !== "all"}
          className="w-full lg:w-40 lg:shrink-0"
          menuClassName="left-auto right-0 w-40"
        />

        <FilterSelect
          ariaLabel="Referral source"
          value={referral}
          options={[
            { value: "all", label: "Referral source" },
            ...referralOptions.map((option) => ({ value: option.id, label: option.name })),
          ]}
          onChange={setReferral}
          active={referral !== "all"}
          className="w-full lg:w-[300px] lg:shrink-0"
          menuClassName="w-72"
        />

        <details className="relative min-w-0 lg:flex-1">
          <summary
            className={cx(
              controlClass,
              "flex w-full cursor-pointer list-none items-center justify-start gap-1.5 px-3 [&::-webkit-details-marker]:hidden",
              hasMoreFilters && "border-clay-300 bg-clay-50 text-clay-800"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> More filters
          </summary>
          <div className="absolute right-0 top-full z-20 mt-1.5 w-56 space-y-3 rounded-xl border border-ink-100 bg-[var(--surface-control)] p-3 shadow-lg shadow-ink-900/5">
            <label className="block text-xs font-medium text-ink-500">
              Payment status
              <FilterSelect
                ariaLabel="Payment status"
                value={payment}
                options={PAYMENT_OPTIONS}
                onChange={(value) => setPayment(value as PaymentFilter)}
                active={payment !== "all"}
                className="mt-1 w-full"
              />
            </label>
            <label className="block text-xs font-medium text-ink-500">
              Portal access
              <FilterSelect
                ariaLabel="Portal access"
                value={portal}
                options={PORTAL_OPTIONS}
                onChange={(value) => setPortal(value as PortalFilter)}
                active={portal !== "all"}
                className="mt-1 w-full"
              />
            </label>
            <label className="block text-xs font-medium text-ink-500">
              Session
              <FilterSelect
                ariaLabel="Session"
                value={session}
                options={SESSION_OPTIONS}
                onChange={(value) => setSession(value as SessionFilter)}
                active={session !== "all"}
                className="mt-1 w-full"
              />
            </label>
          </div>
        </details>

        {hasFilters && (
          <button type="button" onClick={clearFilters} className="px-1.5 text-xs text-ink-500 hover:text-ink-800 lg:shrink-0">
            Clear filters
          </button>
        )}
      </div>

      {visibleItems.length === 0 ? (
        <div className="clients-empty-state card p-8 text-center text-ink-400">
          <h2>{hasFilters ? "No clients match these filters." : emptyMessage}</h2>
        </div>
      ) : (
        <div className="grid gap-3">
          {visibleItems.map(({ client, milestones, referralName }) => {
            const avatarSrc = clientAvatarSrc(client.full_name);
            const completed = isCompletedClient(client.status);
            const showAction = !client.on_hold_at;
            return (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className={cx(
                  "group/card card block border border-ink-100 p-4 transition-colors hover:border-ink-200 hover:bg-ink-50",
                  client.on_hold_at && "opacity-75"
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="client-list-avatar flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-clay-100 font-medium text-clay-700">
                      {avatarSrc ? (
                        <ClientAvatarImage clientName={client.full_name} src={avatarSrc} width={56} height={56} sizes="56px" />
                      ) : (
                        initials(client.full_name)
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="client-list-name truncate font-semibold text-ink-900">{client.full_name}</div>
                      <div className="client-list-meta truncate text-xs text-ink-500">
                        <span>{client.email}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="client-list-since">Client since {formatDate(client.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
                    {client.on_hold_at && (
                      <span className="badge flex items-center gap-1 bg-amber-100 text-amber-800">
                        {client.hold_follow_up_at ? `Follow up ${formatDate(client.hold_follow_up_at)}` : "On hold"}
                      </span>
                    )}
                    <span className={cx("badge client-list-status", clientStatusBadgeClasses(client.status))}>
                      {CLIENT_LIST_STATUS_LABELS[client.status]}
                    </span>
                    {referralName && (
                      <span className="client-list-referral">
                        <span>via</span> {referralName}
                      </span>
                    )}
                    {showAction && (
                      <span
                        className={cx(
                          "client-list-action text-xs font-semibold transition-colors group-hover/card:text-ink-900",
                          completed ? "text-ink-400" : "text-ink-600"
                        )}
                      >
                        {clientActionLabel(client.status)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="sm:ml-[68px]">
                  <JourneyProgressBar client={client} milestones={milestones} compact subdued={completed} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
