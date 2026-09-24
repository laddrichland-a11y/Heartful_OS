"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Task } from "@/lib/types";
import { cx, formatDate } from "@/lib/utils";
import { CheckCircle2, Clock, User, Tag, Loader2, Pencil, Save } from "@/components/ui/HeartfulIcon";
import { completeTaskAction, updateTaskAction } from "@/lib/actions";

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
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(task.status === "completed");
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState(task.due_at?.slice(0, 10) ?? "");
  const [isReminder, setIsReminder] = useState(task.task_type === "reminder");
  const [saveError, setSaveError] = useState("");

  async function markComplete() {
    setBusy(true);
    await completeTaskAction(task.id, clientId);
    setDone(true);
    setBusy(false);
  }

  function cancelEdit() {
    setTitle(task.title);
    setDueDate(task.due_at?.slice(0, 10) ?? "");
    setIsReminder(task.task_type === "reminder");
    setSaveError("");
    setIsEditing(false);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) {
      setSaveError("Enter a task title.");
      return;
    }

    setBusy(true);
    try {
      await updateTaskAction(
        task.id,
        clientId,
        {
          title: nextTitle,
          dueAt: dueDate ? new Date(`${dueDate}T09:00:00`).toISOString() : undefined,
          taskType: isReminder ? "reminder" : "follow_up",
        }
      );
      setIsEditing(false);
      setSaveError("");
      router.refresh();
    } catch {
      setSaveError("Task could not be updated. Please try again.");
    } finally {
      setBusy(false);
    }
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

        {isEditing && (
          <form className="task-detail-edit-form" onSubmit={saveEdit}>
            <label>
              <span>Task or reminder title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} disabled={busy} autoFocus />
            </label>
            <label>
              <span>Due date</span>
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={busy} />
            </label>
            <label className="task-detail-reminder-toggle">
              <input type="checkbox" checked={isReminder} onChange={(event) => setIsReminder(event.target.checked)} disabled={busy} />
              <span>Set reminder</span>
            </label>
            {saveError && <p className="task-detail-edit-error" role="alert">{saveError}</p>}
            <div className="task-detail-edit-actions">
              <button type="button" className="btn-secondary" onClick={cancelEdit} disabled={busy}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save"}</button>
            </div>
          </form>
        )}

        <div className="task-detail-actions">
          <button type="button" className="btn-secondary" onClick={() => { setSaveError(""); setIsEditing(true); }} disabled={busy || isEditing}>
            <Pencil className="h-4 w-4" /> Edit
          </button>
          {!done && (
            <button disabled={busy || isEditing} onClick={markComplete} className="btn-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Mark Complete
            </button>
          )}
          {done && <span className="task-detail-complete"><CheckCircle2 className="h-4 w-4" /> Task completed</span>}
        </div>
      </div>
    </div>
  );
}
