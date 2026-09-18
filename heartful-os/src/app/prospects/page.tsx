import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { getAllProspectCalls, getProspects, getOnHoldProspects } from "@/lib/data";
import { PROSPECT_STATUS_LABELS, type Prospect, type ProspectCall } from "@/lib/types";
import { cx, formatDate } from "@/lib/utils";
import { UserPlus, ArrowRight, PauseCircle, CalendarDays, Tag } from "@/components/ui/HeartfulIcon";
import NewProspectButton from "./NewProspectButton";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-ink-100 text-ink-600",
  intro_scheduled: "bg-clay-100 text-clay-700",
  intro_complete: "bg-sage-100 text-sage-700",
  considering: "bg-plum-100 text-plum-700",
  converted: "bg-sage-200 text-sage-800",
  declined: "bg-ink-100 text-ink-400",
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function addedLabel(date: string) {
  const added = new Date(date);
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startAdded = new Date(added.getFullYear(), added.getMonth(), added.getDate()).getTime();
  const difference = Math.round((startToday - startAdded) / 86_400_000);
  if (difference === 0) return "Added today";
  if (difference === 1) return "Added yesterday";
  return `Added ${formatDate(date)}`;
}

function introCallLabel(prospect: Prospect, calls: ProspectCall[]) {
  const introCalls = calls.filter((call) => call.call_type === "intro_call");
  if (introCalls.some((call) => call.status === "scheduled" && new Date(call.scheduled_at) >= new Date())) {
    return "Intro call scheduled";
  }
  if (prospect.intro_call_at || introCalls.some((call) => call.status === "completed")) return "Intro call complete";
  return "Intro call not scheduled";
}

function ProspectListItem({ prospect, calls, tone = "active" }: { prospect: Prospect; calls: ProspectCall[]; tone?: "active" | "hold" | "archived" }) {
  const contact = [prospect.email, prospect.phone].filter(Boolean).join(" · ") || "No contact info";

  return (
    <Link href={`/prospects/${prospect.id}`} className={cx("prospect-list-item", `prospect-list-item--${tone}`)}>
      <div className="prospect-list-item-main">
        <div className="prospect-list-avatar" aria-hidden="true">{initials(prospect.full_name)}</div>
        <div className="prospect-list-copy">
          <strong>{prospect.full_name}</strong>
          <span className="prospect-list-contact">{contact}</span>
          <div className="prospect-list-meta" aria-label="Prospect details">
            <span><Tag aria-hidden="true" />{prospect.referral_source ?? "Interest not specified"}</span>
            <span><CalendarDays aria-hidden="true" />{addedLabel(prospect.created_at)}</span>
            <span>{introCallLabel(prospect, calls)}</span>
          </div>
        </div>
      </div>
      <div className="prospect-list-item-side">
        <span className={cx("badge text-xs", STATUS_COLORS[prospect.status])}>{PROSPECT_STATUS_LABELS[prospect.status]}</span>
        <span className="prospect-list-view">View prospect <ArrowRight aria-hidden="true" /></span>
      </div>
    </Link>
  );
}

export default async function ProspectsPage() {
  const [prospects, held, allCalls] = await Promise.all([getProspects(), getOnHoldProspects(), getAllProspectCalls()]);
  const callsByProspect = new Map<string, ProspectCall[]>();
  for (const call of allCalls) {
    if (!call.prospect_id) continue;
    callsByProspect.set(call.prospect_id, [...(callsByProspect.get(call.prospect_id) ?? []), call]);
  }

  const active = prospects.filter((p) => !["converted", "declined"].includes(p.status));
  const archived = prospects.filter((p) => ["converted", "declined"].includes(p.status));

  return (
    <AppShell title="Prospects">
      <div className="space-y-6">
        {/* Header */}
          <div className="flex items-center justify-between">
            <div>
            <h2 className="app-section-title text-ink-900">
              Early-stage contacts before onboarding
            </h2>
          </div>
          <NewProspectButton />
        </div>

        {/* Active prospects */}
        <div className="card p-5">
          <h2 className="prospects-section-title text-sm font-semibold text-ink-700 mb-4 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-clay-500" />
            Active ({active.length})
          </h2>
          {active.length === 0 ? (
            <p className="text-sm text-ink-400">No active prospects. Add one to get started.</p>
          ) : (
            <div className="prospect-list">
              {active.map((p) => (
                <ProspectListItem key={p.id} prospect={p} calls={callsByProspect.get(p.id) ?? []} />
              ))}
            </div>
          )}
        </div>

        {/* On hold — hidden from every other view, reachable only here */}
        {held.length > 0 && (
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-ink-700 mb-4 flex items-center gap-2">
              <PauseCircle className="h-4 w-4 text-amber-500" />
              On hold ({held.length})
            </h2>
            <div className="prospect-list">
              {held.map((p) => (
                <ProspectListItem key={p.id} prospect={p} calls={callsByProspect.get(p.id) ?? []} tone="hold" />
              ))}
            </div>
          </div>
        )}

        {/* Converted / Declined */}
        {archived.length > 0 && (
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-ink-400 mb-4">
              Converted &amp; Declined ({archived.length})
            </h2>
            <div className="prospect-list">
              {archived.map((p) => (
                <ProspectListItem key={p.id} prospect={p} calls={callsByProspect.get(p.id) ?? []} tone="archived" />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
