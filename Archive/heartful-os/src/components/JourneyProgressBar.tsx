import { JourneyMilestone } from "@/lib/types";
import { cx } from "@/lib/utils";
import { Check } from "lucide-react";

export default function JourneyProgressBar({
  milestones,
  compact = false,
}: {
  milestones: JourneyMilestone[];
  compact?: boolean;
}) {
  const sorted = [...milestones].sort((a, b) => a.sort_order - b.sort_order);
  const completedCount = sorted.filter((m) => m.completed).length;

  return (
    <div className="w-full">
      {!compact && (
        <div className="mb-1.5 flex items-center justify-between text-xs text-ink-500">
          <span>Journey Progress</span>
          <span>
            {completedCount}/{sorted.length} milestones
          </span>
        </div>
      )}
      <div className="flex items-center w-full">
        {sorted.map((m, i) => (
          <div key={m.id} className="flex items-center flex-1 last:flex-none group relative">
            <div
              title={m.label}
              className={cx(
                "flex items-center justify-center rounded-full shrink-0 transition-colors",
                compact ? "h-4 w-4" : "h-6 w-6",
                m.completed ? "bg-sage-500 text-white" : "bg-ink-100 text-ink-400"
              )}
            >
              {m.completed ? <Check className={compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} /> : (
                <span className={compact ? "text-[8px]" : "text-[10px]"}>{i + 1}</span>
              )}
            </div>
            {i < sorted.length - 1 && (
              <div
                className={cx(
                  "flex-1 h-0.5 mx-1 rounded",
                  m.completed ? "bg-sage-400" : "bg-ink-100"
                )}
              />
            )}
            {!compact && (
              <div className="absolute top-full mt-1 left-0 -translate-x-1/3 hidden group-hover:block bg-ink-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-10">
                {m.label}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
