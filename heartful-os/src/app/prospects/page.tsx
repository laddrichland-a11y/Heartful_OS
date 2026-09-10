import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { getProspects, getOnHoldProspects } from "@/lib/data";
import { PROSPECT_STATUS_LABELS } from "@/lib/types";
import { cx, formatDate } from "@/lib/utils";
import { UserPlus, ArrowRight, PauseCircle } from "lucide-react";
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

export default async function ProspectsPage() {
  const [prospects, held] = await Promise.all([getProspects(), getOnHoldProspects()]);

  const active = prospects.filter((p) => !["converted", "declined"].includes(p.status));
  const archived = prospects.filter((p) => ["converted", "declined"].includes(p.status));

  return (
    <AppShell title="Prospects">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-ink-900">Prospects</h1>
            <p className="text-sm text-ink-400 mt-0.5">
              Introductory call contacts — not yet full clients
            </p>
          </div>
          <NewProspectButton />
        </div>

        {/* Active prospects */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-ink-700 mb-4 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-clay-500" />
            Active ({active.length})
          </h2>
          {active.length === 0 ? (
            <p className="text-sm text-ink-400">No active prospects. Add one to get started.</p>
          ) : (
            <div className="divide-y divide-ink-100">
              {active.map((p) => (
                <Link
                  key={p.id}
                  href={`/prospects/${p.id}`}
                  className="flex items-center justify-between py-3 hover:bg-ink-50/50 -mx-2 px-2 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-plum-100 text-plum-700 flex items-center justify-center text-sm font-semibold">
                      {p.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-ink-900 text-sm">{p.full_name}</div>
                      <div className="text-xs text-ink-400">
                        {p.email ?? p.phone ?? "No contact info"}
                        {p.referral_source && ` · ${p.referral_source}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cx("badge text-xs", STATUS_COLORS[p.status])}>
                      {PROSPECT_STATUS_LABELS[p.status]}
                    </span>
                    <ArrowRight className="h-4 w-4 text-ink-300 group-hover:text-ink-500 transition-colors" />
                  </div>
                </Link>
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
            <div className="divide-y divide-ink-100">
              {held.map((p) => (
                <Link
                  key={p.id}
                  href={`/prospects/${p.id}`}
                  className="flex items-center justify-between py-3 hover:bg-ink-50/50 -mx-2 px-2 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-semibold">
                      {p.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-ink-700 text-sm">{p.full_name}</div>
                      <div className="text-xs text-ink-400">
                        {p.hold_reason ? `${p.hold_reason} · ` : ""}
                        {p.hold_follow_up_at ? `Follow up ${formatDate(p.hold_follow_up_at)}` : "No follow-up set"}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-ink-300 group-hover:text-ink-500 transition-colors" />
                </Link>
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
            <div className="divide-y divide-ink-100">
              {archived.map((p) => (
                <Link
                  key={p.id}
                  href={`/prospects/${p.id}`}
                  className="flex items-center justify-between py-3 hover:bg-ink-50/50 -mx-2 px-2 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-ink-100 text-ink-500 flex items-center justify-center text-sm font-semibold">
                      {p.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="font-medium text-ink-600 text-sm">{p.full_name}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cx("badge text-xs", STATUS_COLORS[p.status])}>
                      {PROSPECT_STATUS_LABELS[p.status]}
                    </span>
                    <ArrowRight className="h-4 w-4 text-ink-300 group-hover:text-ink-500 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
