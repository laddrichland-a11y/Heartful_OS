"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

interface RoleContextValue {
  role: "practitioner" | "client";
  setRole: (r: "practitioner" | "client") => void;
  portalClientId: string;
  setPortalClientId: (id: string) => void;
  // True only when a practitioner is browsing the client portal from inside
  // the app's own demo client-picker (no real client involved). False when a
  // real client landed on /portal via their emailed deep link (?client=<id>)
  // — that link is the only "auth" a client has, so the UI must not show
  // practitioner-only escape hatches like "Switch client" / "Exit Preview"
  // in that case.
  isPreview: boolean;
  setIsPreview: (v: boolean) => void;
  // False until the mount effect below has read localStorage. Every
  // role-based redirect MUST wait for this — see the comment on the effect.
  hydrated: boolean;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

// iOS Safari throws QuotaExceededError on every localStorage write in
// Private Browsing, and Lockdown/ITP can make the API unavailable outright.
// An uncaught throw in setRole() would abort the caller mid-effect — including
// the /portal effect that flips role into "client" on a deep link — so all
// access here is best-effort. In-memory state still drives the session.
function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — this session just won't be remembered */
  }
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<"practitioner" | "client">("practitioner");
  const [portalClientId, setPortalClientIdState] = useState<string>("");
  const [isPreview, setIsPreviewState] = useState<boolean>(true);
  // `role` starts at "practitioner" because that is the only value available
  // during SSR and the first client render. React runs child effects BEFORE
  // parent effects, so without this flag every role-based guard in a
  // descendant fires while `role` is still that placeholder — which is what
  // made /portal and AppShell bounce each other in a redirect loop.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedRole = readStored("heartful_role");
    const storedClientId = readStored("heartful_portal_client_id");
    const storedIsPreview = readStored("heartful_is_preview");
    // One-time hydration of persisted demo state from localStorage on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (storedRole === "client" || storedRole === "practitioner") setRoleState(storedRole);
    if (storedClientId) setPortalClientIdState(storedClientId);
    if (storedIsPreview !== null) setIsPreviewState(storedIsPreview === "true");
    setHydrated(true);
  }, []);

  // These are dependency-array inputs for every consumer's effects, so their
  // identities must be stable. Recreating them each render (and handing out a
  // fresh context object) silently refires any effect that lists them.
  const setRole = useCallback((r: "practitioner" | "client") => {
    setRoleState(r);
    writeStored("heartful_role", r);
  }, []);
  const setPortalClientId = useCallback((id: string) => {
    setPortalClientIdState(id);
    writeStored("heartful_portal_client_id", id);
  }, []);
  const setIsPreview = useCallback((v: boolean) => {
    setIsPreviewState(v);
    writeStored("heartful_is_preview", String(v));
  }, []);

  const value = useMemo(
    () => ({ role, setRole, portalClientId, setPortalClientId, isPreview, setIsPreview, hydrated }),
    [role, setRole, portalClientId, setPortalClientId, isPreview, setIsPreview, hydrated]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
