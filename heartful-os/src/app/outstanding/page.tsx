import AppShell from "@/components/layout/AppShell";
import OutstandingQueue, {
  type OutstandingQueueGroup,
  type OutstandingQueueItem,
} from "@/components/outstanding/OutstandingQueue";
import { getOutstandingForms, getOutstandingTasks } from "@/lib/data";
import {
  isPastDue,
  outstandingActionLabel,
  outstandingItemHref,
  relativeDueLabel,
} from "@/lib/utils";
import Link from "next/link";
import "./outstanding.css";

export const dynamic = "force-dynamic";

const DUE_SOON_DAYS = 7;

function taskType(task: Awaited<ReturnType<typeof getOutstandingTasks>>[number]): OutstandingQueueItem["type"] {
  if (task.task_type === "session_prep") return "Session";
  if (task.task_type === "form") return "Form";
  return "Task";
}

function formType(title: string): OutstandingQueueItem["type"] {
  return /agreement|consent/i.test(title) ? "Agreement" : "Form";
}

function urgencyFor(dueAt?: string): OutstandingQueueItem["urgency"] {
  if (!dueAt) return "pending";
  if (new Date(dueAt).getTime() < Date.now()) return "overdue";
  const dueSoonCutoff = Date.now() + DUE_SOON_DAYS * 24 * 60 * 60 * 1000;
  return new Date(dueAt).getTime() <= dueSoonCutoff ? "due-soon" : "pending";
}

function actionLabel(item: Parameters<typeof outstandingActionLabel>[0]) {
  const label = outstandingActionLabel(item);
  return label === "Request" ? "Send request" : label;
}

export default async function OutstandingPage() {
  const [tasks, forms] = await Promise.all([getOutstandingTasks(), getOutstandingForms()]);
  const byClient = new Map<string, OutstandingQueueGroup>();

  function groupFor(clientId: string, clientName: string) {
    if (!byClient.has(clientId)) {
      byClient.set(clientId, { clientId, clientName, items: [] });
    }
    return byClient.get(clientId)!;
  }

  for (const task of tasks) {
    const overdue = task.status === "overdue" || isPastDue(task);
    groupFor(task.client_id, task.client_name).items.push({
      id: `task-${task.id}`,
      title: task.title,
      type: taskType(task),
      href: outstandingItemHref(task),
      action: actionLabel(task),
      urgency: overdue ? "overdue" : urgencyFor(task.due_at),
      statusLabel: task.due_at ? relativeDueLabel(task.due_at) : "Pending",
      dueAt: task.due_at,
    });
  }

  for (const form of forms) {
    groupFor(form.client_id, form.client_name).items.push({
      id: `form-${form.id}`,
      title: form.title,
      type: formType(form.title),
      href: outstandingItemHref(form),
      action: actionLabel(form),
      urgency: "pending",
      statusLabel: form.status === "in_progress" ? "In progress" : "Not started",
    });
  }

  const groups = [...byClient.values()].sort((a, b) => a.clientName.localeCompare(b.clientName));
  const total = tasks.length + forms.length;

  return (
    <AppShell title="Outstanding Items">
      <div className="outstanding-page-header">
        <Link href="/dashboard" className="outstanding-back-link">
          ← Dashboard
        </Link>
        <div>
          <h1 className="app-page-title text-ink-900">Outstanding Forms &amp; Tasks</h1>
          <p>
            {total === 0
              ? "All caught up."
              : `${total} item${total !== 1 ? "s" : ""} across ${groups.length} client${groups.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      <OutstandingQueue groups={groups} />
    </AppShell>
  );
}
