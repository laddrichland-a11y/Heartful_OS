"use client";

import { createContext, useContext } from "react";

export type ClientSwitcherOption = {
  id: string;
  fullName: string;
};

type ClientSwitcherValue = {
  currentClientId: string;
  clients: ClientSwitcherOption[];
};

const ClientSwitcherContext = createContext<ClientSwitcherValue | null>(null);

export function ClientSwitcherProvider({
  currentClientId,
  clients,
  children,
}: ClientSwitcherValue & { children: React.ReactNode }) {
  return (
    <ClientSwitcherContext.Provider value={{ currentClientId, clients }}>
      {children}
    </ClientSwitcherContext.Provider>
  );
}

export function useClientSwitcher() {
  return useContext(ClientSwitcherContext);
}
