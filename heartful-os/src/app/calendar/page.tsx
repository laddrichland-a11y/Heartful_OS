import AppShell from "@/components/layout/AppShell";
import { getAllSessions, getClients, getAllProspectCalls, getExternalCalendarEvents, getMilestones } from "@/lib/data";
import CalendarView from "@/components/calendar/CalendarView";
import { canCompleteJourneySession } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const [sessions, clients, prospectCalls, externalEvents] = await Promise.all([
    getAllSessions(),
    getClients(),
    getAllProspectCalls(),
    getExternalCalendarEvents(),
  ]);
  const milestonesByClient = new Map(
    await Promise.all(clients.map(async (client) => [client.id, await getMilestones(client.id)] as const)),
  );
  const completableSessionIds = sessions
    .filter((session) => canCompleteJourneySession(milestonesByClient.get(session.client_id) ?? [], session.session_type))
    .map((session) => session.id);

  return (
    <AppShell title="Calendar">
      <CalendarView
        sessions={sessions}
        clients={clients.map((c) => ({ id: c.id, full_name: c.full_name }))}
        completableSessionIds={completableSessionIds}
        prospectCalls={prospectCalls}
        externalEvents={externalEvents}
      />
    </AppShell>
  );
}
