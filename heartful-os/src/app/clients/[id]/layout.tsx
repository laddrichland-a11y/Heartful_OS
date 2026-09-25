import { ClientSwitcherProvider } from "@/components/client/ClientSwitcherContext";
import { getClientsIncludingOnHold, getSessions } from "@/lib/data";
import { clientJourneyWorkspaceHref } from "@/lib/utils";

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clients = await getClientsIncludingOnHold();
  const clientsWithSessions = await Promise.all(
    clients.map(async (client) => ({ client, sessions: await getSessions(client.id) }))
  );

  return (
    <ClientSwitcherProvider
      currentClientId={id}
      clients={clientsWithSessions.map(({ client, sessions }) => ({
        id: client.id,
        fullName: client.full_name,
        workspaceHref: clientJourneyWorkspaceHref(client, sessions),
      }))}
    >
      {children}
    </ClientSwitcherProvider>
  );
}
