"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addTaskAction } from "@/lib/actions";
import { Task } from "@/lib/types";
import { relativeDueLabel } from "@/lib/utils";
import { Check, ChevronRight, ListTodo, Plus } from "@/components/ui/HeartfulIcon";

interface Props {
  clientId: string;
  practitionerId: string;
  tasks: Task[];
}

function dueDateValue() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export default function TaskReminderCard({ clientId, practitionerId, tasks }: Props) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(dueDateValue);
  const [isReminder, setIsReminder] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function openCreator() {
    setError("");
    setIsCreating(true);
  }

  function closeCreator() {
    if (isPending) return;
    setIsCreating(false);
    setError("");
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) {
      setError("Enter a title.");
      return;
    }

    startTransition(async () => {
      try {
        const dueAt = dueDate ? new Date(`${dueDate}T09:00:00`).toISOString() : undefined;
        await addTaskAction(clientId, practitionerId, nextTitle, isReminder ? "reminder" : "follow_up", dueAt);
        setTitle("");
        setDueDate(dueDateValue());
        setIsReminder(false);
        setIsCreating(false);
        router.refresh();
      } catch {
        setError("Task could not be saved. Please try again.");
      }
    });
  }

  return (
    <section className="wn-rail-card">
      <header className="wn-rail-heading wn-task-card-heading">
        <span className="wn-rail-heading-icon"><ListTodo aria-hidden="true" width={18} height={18} strokeWidth={1.75} /></span>
        <h2>Tasks &amp; Reminders</h2>
        <button type="button" className="wn-task-add-button" onClick={openCreator} aria-expanded={isCreating} aria-controls="task-reminder-create">
          <Plus aria-hidden="true" /> Add
        </button>
      </header>

      {isCreating && (
        <form id="task-reminder-create" className="wn-task-create-form" onSubmit={save}>
          <label>
            <span>Task or reminder title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Send integration notes" autoFocus disabled={isPending} />
          </label>
          <label>
            <span>Due date</span>
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={isPending} />
          </label>
          <label className="wn-task-reminder-toggle">
            <input type="checkbox" checked={isReminder} onChange={(event) => setIsReminder(event.target.checked)} disabled={isPending} />
            <span>Set reminder</span>
          </label>
          {error && <p className="wn-task-create-error" role="alert">{error}</p>}
          <div className="wn-task-create-actions">
            <button type="button" onClick={closeCreator} disabled={isPending}>Cancel</button>
            <button type="submit" disabled={isPending}>{isPending ? "Saving…" : "Save"}</button>
          </div>
        </form>
      )}

      {tasks.length > 0 ? (
        <div className="wn-task-list">
          {tasks.map((task) => (
            <div key={task.id} className="wn-task-item">
              <Link className="wn-task-copy" href={`/clients/${clientId}/tasks/${task.id}`}>
                <strong>{task.title}</strong>
                {task.due_at && <small>{task.status === "completed" ? "Completed" : relativeDueLabel(task.due_at)}</small>}
              </Link>
              {task.status === "completed" ? (
                <span className="wn-task-status is-complete"><Check aria-hidden="true" /> Done</span>
              ) : (
                <Link className="wn-task-open-button" href={`/clients/${clientId}/tasks/${task.id}`} aria-label={`Open task: ${task.title}`}>
                  Open task <ChevronRight aria-hidden="true" />
                </Link>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="wn-rail-empty">No tasks or reminders yet.</p>
      )}
    </section>
  );
}
