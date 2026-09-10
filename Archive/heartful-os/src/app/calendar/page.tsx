import AppShell from "@/components/layout/AppShell";
import { getAllSessions, getClients, getAllProspectCalls, getExternalCalendarEvents } from "@/lib/data";
import CalendarView from "@/components/calendar/CalendarView";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const [sessions, clients, prospectCalls, externalEvents] = await Promise.all([
    getAllSessions(),
    getClients(),
    getAllProspectCalls(),
    getExternalCalendarEvents(),
  ]);

  return (
    <AppShell title="Calendar">
      <CalendarView
        sessions={sessions}
        clients={clients.map((c) => ({ id: c.id, full_name: c.full_name }))}
        prospectCalls={prospectCalls}
        externalEvents={externalEvents}
      />
    </AppShell>
  );
}
