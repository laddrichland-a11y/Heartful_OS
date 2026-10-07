import AppShell from "@/components/layout/AppShell";
import { getUpcomingSessionsWithinDays, getClients } from "@/lib/data";
import CopilotPanel from "@/components/copilot/CopilotPanel";
import { SESSION_TYPE_LABELS as SESSION_LABELS } from "@/lib/utils";

export const dynamic = "force-dynamic";

// 30 days covers a full journey arc (intake through Integration Session
// Two), so it's the window practitioners actually need to plan around —
// also used for Upcoming Sessions and the preparation session selector.
const OUTLOOK_DAYS = 30;

export default async function CopilotPage() {
  const [sessions, clients] = await Promise.all([getUpcomingSessionsWithinDays(OUTLOOK_DAYS), getClients()]);
  const completedJourneyClients = new Set(
    clients.filter((client) => client.status === "journey_closed").map((client) => client.id)
  );
  return (
    <AppShell title="Prep Center">
      <CopilotPanel
        sessions={sessions.map((s) => ({
          id: s.id,
          clientId: s.client_id,
          clientName: s.client_name,
          label:
            s.session_type === "other" && completedJourneyClients.has(s.client_id)
              ? "Follow-Up Call"
              : SESSION_LABELS[s.session_type] ?? s.session_type,
          scheduledAt: s.scheduled_at ?? new Date().toISOString(),
        }))}
        clients={clients.map((c) => ({ id: c.id, full_name: c.full_name }))}
      />
    </AppShell>
  );
}
