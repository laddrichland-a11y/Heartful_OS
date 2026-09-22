import { ClientSwitcherProvider } from "@/components/client/ClientSwitcherContext";
import { getClientsIncludingOnHold } from "@/lib/data";
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

  return (
    <ClientSwitcherProvider
      currentClientId={id}
      clients={clients.map((client) => ({
        id: client.id,
        fullName: client.full_name,
        workspaceHref: clientJourneyWorkspaceHref(client),
      }))}
    >
      {children}
    </ClientSwitcherProvider>
  );
}
