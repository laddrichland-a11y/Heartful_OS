"use client";

import { completeTaskAction, sendMessageAction } from "@/lib/actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function DashboardOutstandingActions({
  clientId,
  title,
  taskId,
}: {
  clientId: string;
  title: string;
  taskId?: string;
}) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<"reminder" | "complete" | null>(null);
  const [reminderSent, setReminderSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function sendReminder() {
    setBusyAction("reminder");
    startTransition(async () => {
      await sendMessageAction(
        clientId,
        "practitioner",
        `Reminder: ${title} is still outstanding. Please complete it when you can.`
      );
      setReminderSent(true);
      setBusyAction(null);
      router.refresh();
    });
  }

  function markComplete() {
    if (!taskId) return;
    setBusyAction("complete");
    startTransition(async () => {
      await completeTaskAction(taskId, clientId);
      router.refresh();
    });
  }

  return (
    <div className="dashboard-attention-actions">
      <button
        type="button"
        className="dashboard-attention-action dashboard-attention-reminder"
        disabled={isPending || reminderSent}
        onClick={sendReminder}
      >
        {busyAction === "reminder" ? "Sending…" : reminderSent ? "Reminder sent" : "Send reminder"}
      </button>
      {taskId && (
        <button
          type="button"
          className="dashboard-attention-action dashboard-attention-complete"
          disabled={isPending}
          onClick={markComplete}
        >
          {busyAction === "complete" ? "Completing…" : "Mark Complete"}
        </button>
      )}
    </div>
  );
}
