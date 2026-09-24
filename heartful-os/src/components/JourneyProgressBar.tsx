import { Client, JourneyMilestone } from "@/lib/types";
import { cx, getClientJourneyProgress, JOURNEY_PROGRESS_STAGE_COUNT } from "@/lib/utils";
import { Check, IntegrationLink } from "@/components/ui/HeartfulIcon";

export default function JourneyProgressBar({
  milestones,
  client,
  compact = false,
  subdued = false,
}: {
  milestones: JourneyMilestone[];
  client?: Pick<Client, "status" | "current_phase">;
  compact?: boolean;
  subdued?: boolean;
}) {
  const sorted = [...milestones]
    .filter((milestone) => milestone.sort_order <= JOURNEY_PROGRESS_STAGE_COUNT)
    .sort((a, b) => a.sort_order - b.sort_order);
  const calculated = client ? getClientJourneyProgress(client, milestones) : undefined;
  const completedCount = calculated?.completed ?? sorted.filter((m) => m.completed).length;
  const currentIndex = completedCount < sorted.length ? completedCount : -1;

  return (
    <div className="w-full">
      {!compact && (
        <div className="mb-1.5 flex items-center justify-between text-xs text-ink-500">
          <span className="flex items-center gap-1.5"><IntegrationLink className="h-4 w-4" />Journey Progress</span>
          <span>
            {completedCount}/{sorted.length} milestones
          </span>
        </div>
      )}
      <div className="flex items-center w-full">
        {sorted.map((m, i) => {
          const completed = i < completedCount;
          const isCurrent = !subdued && i === currentIndex;
          const label = m.milestone_key === "journey_complete" ? "Journey Day Complete" : m.label;

          return (
          <div key={m.id} className="group/step relative flex flex-1 items-center last:flex-none">
            <div
              aria-label={`${i + 1}. ${label}${completed ? ", completed" : isCurrent ? ", current stage" : ""}`}
              aria-current={isCurrent ? "step" : undefined}
              className={cx(
                "flex shrink-0 items-center justify-center rounded-full transition-colors",
                compact ? "h-5 w-5" : "h-6 w-6",
                isCurrent
                  ? "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] ring-1 ring-[var(--brand-accent-muted)]"
                  : completed
                    ? "bg-[var(--journey-complete-bg,var(--color-sage-200))] text-[var(--journey-complete-text,var(--color-sage-800))]"
                    : "bg-ink-100 text-ink-400"
              )}
            >
              {completed ? <Check strokeWidth={2.5} className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} /> : (
                <span className="text-xs">{i + 1}</span>
              )}
            </div>
            {i < sorted.length - 1 && (
              <div
                className={cx(
                  "mx-1 h-[2px] flex-1 rounded",
                  completed ? "bg-[var(--journey-complete-line,var(--color-sage-200))]" : "bg-ink-100"
                )}
              />
            )}
            <div
              className={cx(
                "pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded bg-ink-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover/step:opacity-100",
                i === 0
                  ? "left-0"
                  : i >= sorted.length - 2
                    ? "right-0"
                    : "left-1/2 -translate-x-1/2"
              )}
            >
              {i + 1}. {label}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
