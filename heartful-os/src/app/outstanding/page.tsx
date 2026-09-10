import AppShell from "@/components/layout/AppShell";
import { getOutstandingTasks, getOutstandingForms } from "@/lib/data";
import { cx, relativeDueLabel } from "@/lib/utils";
import Link from "next/link";
import { ClipboardList, FileText, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OutstandingPage() {
  const [tasks, forms] = await Promise.all([getOutstandingTasks(), getOutstandingForms()]);

  // Group by client
  const byClient = new Map<string, { clientName: string; clientId: string; tasks: typeof tasks; forms: typeof forms }>();

  for (const t of tasks) {
    if (!byClient.has(t.client_id)) {
      byClient.set(t.client_id, { clientName: t.client_name, clientId: t.client_id, tasks: [], forms: [] });
    }
    byClient.get(t.client_id)!.tasks.push(t);
  }
  for (const f of forms) {
    if (!byClient.has(f.client_id)) {
      byClient.set(f.client_id, { clientName: f.client_name, clientId: f.client_id, tasks: [], forms: [] });
    }
    byClient.get(f.client_id)!.forms.push(f);
  }

  const groups = [...byClient.values()].sort((a, b) => a.clientName.localeCompare(b.clientName));
  const total = tasks.length + forms.length;

  return (
    <AppShell title="Outstanding Items">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Outstanding Forms &amp; Tasks</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {total === 0 ? "All caught up." : `${total} item${total !== 1 ? "s" : ""} across ${groups.length} client${groups.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link href="/dashboard" className="text-sm text-ink-400 hover:text-ink-700 flex items-center gap-1">
          ← Dashboard
        </Link>
      </div>

      {total === 0 && (
        <div className="card p-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-sage-400 mx-auto mb-3" />
          <p className="text-ink-500">Nothing outstanding. You&apos;re all caught up!</p>
        </div>
      )}

      <div className="space-y-5">
        {groups.map(({ clientName, clientId, tasks: clientTasks, forms: clientForms }) => (
          <div key={clientId} className="card p-4">
            <Link
              href={`/clients/${clientId}`}
              className="flex items-center gap-2 font-semibold text-ink-900 hover:text-clay-600 mb-3"
            >
              {clientName}
              <span className="text-xs font-normal text-ink-400 ml-1">
                {clientTasks.length + clientForms.length} item{clientTasks.length + clientForms.length !== 1 ? "s" : ""}
              </span>
            </Link>

            <div className="space-y-1.5">
              {clientTasks.map((t) => (
                <Link
                  key={t.id}
                  href={`/clients/${clientId}`}
                  className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-ink-50 group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ClipboardList className="h-3.5 w-3.5 text-ink-400 shrink-0" />
                    <span className="text-sm text-ink-800 truncate">{t.title}</span>
                  </div>
                  <span
                    className={cx(
                      "badge shrink-0 ml-3",
                      t.status === "overdue" ? "bg-clay-100 text-clay-700" : "bg-ink-100 text-ink-600"
                    )}
                  >
                    {relativeDueLabel(t.due_at)}
                  </span>
                </Link>
              ))}

              {clientForms.map((f) => (
                <Link
                  key={f.id}
                  href={`/clients/${clientId}?tab=Documents`}
                  className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-ink-50 group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-3.5 w-3.5 text-ink-400 shrink-0" />
                    <span className="text-sm text-ink-800 truncate">{f.title}</span>
                  </div>
                  <span className={cx(
                    "badge shrink-0 ml-3",
                    f.status === "in_progress" ? "bg-plum-100 text-plum-700" : "bg-ink-100 text-ink-600"
                  )}>
                    {f.status === "in_progress" ? "In Progress" : "Not Started"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
