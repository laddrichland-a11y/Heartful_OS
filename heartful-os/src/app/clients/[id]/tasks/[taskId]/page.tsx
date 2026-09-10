import AppShell from "@/components/layout/AppShell";
import { getClient, getTask } from "@/lib/data";
import { notFound } from "next/navigation";
import BackButton from "@/components/layout/BackButton";
import TaskDetailWorkspace from "@/components/client/TaskDetailWorkspace";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id, taskId } = await params;
  const [client, task] = await Promise.all([getClient(id), getTask(taskId)]);
  if (!client || !task) notFound();

  return (
    <AppShell title={`Task — ${client.full_name}`}>
      <BackButton label="Back to client record" />
      <TaskDetailWorkspace clientId={id} task={task} />
    </AppShell>
  );
}
