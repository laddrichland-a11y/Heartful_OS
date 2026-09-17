"use client";

import { useState } from "react";
import { Task } from "@/lib/types";
import { cx, formatDate } from "@/lib/utils";
import { CheckCircle2, Clock, User, Tag, Loader2 } from "@/components/ui/HeartfulIcon";
import { completeTaskAction } from "@/lib/actions";

const TASK_TYPE_LABELS: Record<string, string> = {
  form: "Form",
  reminder: "Reminder",
  reflection: "Reflection",
  session_prep: "Session Prep",
  follow_up: "Follow-Up",
};

export default function TaskDetailWorkspace({
  clientId,
  task,
}: {
  clientId: string;
  task: Task;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(task.status === "completed");

  async function markComplete() {
    setBusy(true);
    await completeTaskAction(task.id, clientId);
    setDone(true);
    setBusy(false);
  }

  return (
    <div className="max-w-lg">
      <div className="card p-5 space-y-4">
        {/* Title + status */}
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-ink-900">{task.title}</h2>
          <span
            className={cx(
              "badge shrink-0",
              done ? "bg-sage-100 text-sage-700" : "bg-clay-100 text-clay-700"
            )}
          >
            {done ? "Completed" : task.status}
          </span>
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-sm text-ink-600">{task.description}</p>
        )}

        {/* Meta */}
        <div className="space-y-2 text-sm text-ink-500">
          {task.due_at && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-ink-400 shrink-0" />
              <span>Due {formatDate(task.due_at)}</span>
            </div>
          )}
          {task.task_type && (
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-ink-400 shrink-0" />
              <span>{TASK_TYPE_LABELS[task.task_type] ?? task.task_type}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-ink-400 shrink-0" />
            <span className="capitalize">Assigned to: {task.assigned_to}</span>
          </div>
        </div>

        {/* Action */}
        {!done && (
          <button
            disabled={busy}
            onClick={markComplete}
            className="btn-primary text-sm px-4 py-2 flex items-center gap-2 w-fit"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Mark Complete
          </button>
        )}

        {done && (
          <div className="flex items-center gap-2 text-sm text-sage-700">
            <CheckCircle2 className="h-4 w-4" />
            Task completed
          </div>
        )}
      </div>
    </div>
  );
}
