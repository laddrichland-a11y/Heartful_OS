"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FilterSelect from "@/components/client/FilterSelect";
import type { ReferralSource } from "@/lib/types";

const PERIODS = [
  { value: "all", label: "All time" },
  { value: "30d", label: "Last 30 days" },
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Custom range" },
];

const STATUSES = [{ value: "all", label: "All clients" }, { value: "active", label: "Active" }, { value: "completed", label: "Completed" }];
const STAGES = [
  { value: "all", label: "All stages" },
  { value: "intake", label: "Intake" },
  { value: "preparation", label: "Preparation" },
  { value: "harm_reduction_session", label: "Journey Day" },
  { value: "post_journey_check_in", label: "12-Hour Check-In" },
  { value: "integration_1", label: "Integration 1" },
  { value: "integration_2", label: "Integration 2" },
];

function today() { return new Date().toISOString().slice(0, 10); }

export default function ReportsFilterBar({ referralSources }: { referralSources: ReferralSource[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const period = params.get("period") ?? "all";
  const status = params.get("status") ?? "all";
  const stage = params.get("stage") ?? "all";
  const referral = params.get("referral") ?? "all";
  const start = params.get("start") ?? "";
  const end = params.get("end") ?? "";
  const active = period !== "all" || status !== "all" || stage !== "all" || referral !== "all";

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || (key !== "period" && value === "all")) next.delete(key); else next.set(key, value);
    if (key === "period" && value !== "custom") { next.delete("start"); next.delete("end"); }
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`);
  }
  function reset() { router.replace(pathname); }

  return <section className="reports-filter-bar" aria-label="Global report filters">
    <FilterSelect ariaLabel="Report period" value={period} options={PERIODS} onChange={(value) => update("period", value)} active={period !== "all"} className="reports-filter-control reports-filter-period" menuClassName="max-h-72 overflow-y-auto" />
    <FilterSelect ariaLabel="Client status" value={status} options={STATUSES} onChange={(value) => update("status", value)} active={status !== "all"} className="reports-filter-control" />
    <FilterSelect ariaLabel="Journey stage" value={stage} options={STAGES} onChange={(value) => update("stage", value)} active={stage !== "all"} className="reports-filter-control" menuClassName="max-h-72 overflow-y-auto" />
    <FilterSelect ariaLabel="Referral source" value={referral} options={[{ value: "all", label: "All sources" }, ...referralSources.map((source) => ({ value: source.id, label: source.name }))]} onChange={(value) => update("referral", value)} active={referral !== "all"} className="reports-filter-control reports-filter-referral" menuClassName="max-h-72 overflow-y-auto" />
    {period === "custom" && <div className="reports-filter-range" aria-label="Custom report date range"><input aria-label="Start date" type="date" value={start} max={end || today()} onChange={(event) => update("start", event.target.value)} /><input aria-label="End date" type="date" value={end} min={start} max={today()} onChange={(event) => update("end", event.target.value)} /></div>}
    {active && <button type="button" className="reports-filter-reset" onClick={reset}>Reset filters</button>}
  </section>;
}
