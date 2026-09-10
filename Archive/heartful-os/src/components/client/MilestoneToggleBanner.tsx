"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toggleMilestoneAction } from "@/lib/actions";
import { cx } from "@/lib/utils";

export default function MilestoneToggleBanner({
  clientId,
  milestoneKey,
  label,
  initialCompleted,
}: {
  clientId: string;
  milestoneKey: string;
  label: string;
  initialCompleted: boolean;
}) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !completed;
    setCompleted(next);
    startTransition(async () => {
      await toggleMilestoneAction(clientId, milestoneKey, next);
    });
  }

  return (
    <div className="flex items-center gap-3 mb-5">
      <span className={cx("text-sm font-medium", completed ? "text-sage-700" : "text-ink-600")}>
        {label} — {completed ? "Complete" : "Mark Complete"}
      </span>

      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin text-ink-400" />
      ) : (
        <button
          onClick={toggle}
          role="switch"
          aria-checked={completed}
          className={cx(
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-500",
            completed ? "bg-sage-500" : "bg-ink-200 hover:bg-ink-300"
          )}
        >
          <span
            className={cx(
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200",
              completed ? "translate-x-5" : "translate-x-0"
            )}
          />
        </button>
      )}
    </div>
  );
}
