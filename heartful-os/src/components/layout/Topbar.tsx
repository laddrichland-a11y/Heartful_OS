"use client";

import { useRouter } from "next/navigation";
import { useRole } from "@/components/RoleContext";
import { useClientSwitcher } from "@/components/client/ClientSwitcherContext";
import { ArrowRight, Bell, Check, ChevronDown, LogOut, Menu, MessageCircle, Plus, Search, Settings } from "@/components/ui/HeartfulIcon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MobileNav from "./MobileNav";
import { logoutAction } from "@/lib/actions";
import { initials } from "@/lib/utils";
import GlobalSearchOverlay from "./GlobalSearchOverlay";

export default function Topbar({
  title,
  showClientSwitcher = false,
}: {
  title: string;
  showClientSwitcher?: boolean;
}) {
  const { role, setRole, setIsPreview } = useRole();
  const clientSwitcher = useClientSwitcher();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const clientMenuRef = useRef<HTMLDivElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const currentClientName = clientSwitcher?.clients.find(
    (client) => client.id === clientSwitcher.currentClientId
  )?.fullName ?? title;
  const visibleClients = useMemo(() => {
    const query = clientSearch.trim().toLocaleLowerCase();
    if (!query) return clientSwitcher?.clients ?? [];
    return (clientSwitcher?.clients ?? []).filter((client) =>
      client.fullName.toLocaleLowerCase().includes(query)
    );
  }, [clientSearch, clientSwitcher]);

  useEffect(() => {
    if (!clientMenuOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!clientMenuRef.current?.contains(event.target as Node)) {
        setClientMenuOpen(false);
        setClientSearch("");
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setClientMenuOpen(false);
        setClientSearch("");
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [clientMenuOpen]);

  useEffect(() => {
    if (!viewMenuOpen && !accountMenuOpen) return;
    function closeMenus(event: PointerEvent) {
      const target = event.target as Node;
      if (!viewMenuRef.current?.contains(target)) setViewMenuOpen(false);
      if (!accountMenuRef.current?.contains(target)) setAccountMenuOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setViewMenuOpen(false);
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeMenus);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenus);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountMenuOpen, viewMenuOpen]);

  function goToClient(clientId: string) {
    setClientMenuOpen(false);
    setClientSearch("");
    router.push(`/clients/${clientId}`);
  }

  return (
    <>
      <header className="app-topbar sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-ink-100">
        <div className="flex items-center justify-between px-4 md:px-7 py-3.5">
          <div className="flex items-center gap-3">
            <button className="topbar-menu-button md:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-ink-50" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            {showClientSwitcher ? (
              <div className="topbar-client-switcher" ref={clientMenuRef}>
                <button
                  type="button"
                  className="topbar-client-trigger"
                  aria-haspopup="dialog"
                  aria-expanded={clientMenuOpen}
                  onClick={() => setClientMenuOpen((open) => !open)}
                >
                  <span className="topbar-client-label">Client:</span>
                  <span className="topbar-client-name">{currentClientName}</span>
                  <ChevronDown aria-hidden="true" />
                </button>

                {clientMenuOpen && clientSwitcher && (
                  <div className="topbar-client-menu" role="dialog" aria-label="Switch client">
                    <div className="topbar-client-search">
                      <Search aria-hidden="true" />
                      <input
                        autoFocus
                        type="search"
                        value={clientSearch}
                        onChange={(event) => setClientSearch(event.target.value)}
                        placeholder="Search clients..."
                        aria-label="Search clients"
                      />
                    </div>

                    <div className="topbar-client-options" role="listbox" aria-label="Clients">
                      {visibleClients.length > 0 ? (
                        visibleClients.map((client) => {
                          const selected = client.id === clientSwitcher.currentClientId;
                          return (
                            <button
                              type="button"
                              key={client.id}
                              role="option"
                              aria-selected={selected}
                              onClick={() => goToClient(client.id)}
                            >
                              <span className="topbar-client-avatar" aria-hidden="true">
                                {initials(client.fullName)}
                              </span>
                              <span>{client.fullName}</span>
                              {selected && <Check aria-hidden="true" />}
                            </button>
                          );
                        })
                      ) : (
                        <p className="topbar-client-empty">No clients found</p>
                      )}
                    </div>

                    <button
                      type="button"
                      className="topbar-client-menu-action"
                      onClick={() => {
                        setClientMenuOpen(false);
                        router.push("/clients");
                      }}
                    >
                      <span>View all clients</span>
                      <ArrowRight aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="topbar-client-menu-action topbar-client-add"
                      onClick={() => {
                        setClientMenuOpen(false);
                        router.push("/clients?new=1");
                      }}
                    >
                      <Plus aria-hidden="true" />
                      <span>Add client</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <h1 className="app-page-title text-ink-900">{title}</h1>
            )}
          </div>
          <div className="topbar-actions">
            <div className="topbar-view-menu" ref={viewMenuRef}>
              <button
                type="button"
                className="topbar-view-trigger"
                aria-haspopup="menu"
                aria-expanded={viewMenuOpen}
                onClick={() => setViewMenuOpen((open) => !open)}
              >
                <span>{role === "practitioner" ? "Practitioner View" : "Client Portal View"}</span>
                <ChevronDown aria-hidden="true" />
              </button>
              {viewMenuOpen && (
                <div className="topbar-popover topbar-view-options" role="menu">
                  <button role="menuitem" data-selected={role === "practitioner"} onClick={() => { setRole("practitioner"); setViewMenuOpen(false); router.push("/dashboard"); }}>
                    <span><strong>Practitioner View</strong><small>Manage your practice</small></span>{role === "practitioner" && <Check />}
                  </button>
                  <button role="menuitem" data-selected={role === "client"} onClick={() => { setRole("client"); setIsPreview(true); setViewMenuOpen(false); router.push("/portal"); }}>
                    <span><strong>Client Portal View</strong><small>Preview the client experience</small></span>{role === "client" && <Check />}
                  </button>
                </div>
              )}
            </div>
            <span className="topbar-action-divider" />
            <button type="button" className="topbar-icon-button" aria-label="Global search" title="Search" aria-haspopup="dialog" aria-expanded={searchOpen} onClick={() => setSearchOpen(true)}><Search /></button>
            <button className="topbar-icon-button" aria-label="Notifications" title="Notifications" onClick={() => router.push("/outstanding")}><Bell /></button>
            <button className="topbar-icon-button" aria-label="Messages" title="Messages" onClick={() => router.push("/clients")}><MessageCircle /></button>
            <div className="topbar-account" ref={accountMenuRef}>
              <button className="topbar-account-trigger" aria-label="Account menu" aria-haspopup="menu" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen((open) => !open)}>
                <span className="topbar-avatar">PA</span><ChevronDown aria-hidden="true" />
              </button>
              {accountMenuOpen && (
                <div className="topbar-popover topbar-account-menu" role="menu">
                  <div className="topbar-account-summary"><span className="topbar-avatar">PA</span><span><strong>Paul Austin</strong><small>Practitioner account</small></span></div>
                  <button role="menuitem" onClick={() => { setAccountMenuOpen(false); router.push("/settings"); }}><Settings /><span>Account settings</span></button>
                  <button role="menuitem" onClick={async () => { try { await logoutAction(); } catch (err) { if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err; } }}><LogOut /><span>Log out</span></button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
      {searchOpen && <GlobalSearchOverlay onClose={closeSearch} />}
    </>
  );
}
