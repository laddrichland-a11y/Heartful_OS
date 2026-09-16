"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/components/RoleContext";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppShell({
  title,
  children,
  variant,
}: {
  title: string;
  children: React.ReactNode;
  variant?: "wellnest-client";
}) {
  const { role, hydrated } = useRole();
  const router = useRouter();

  // Practitioner-only surface (dashboard, clients, reports, settings, etc).
  // Clients should only ever see their own portal/file — bounce them back
  // if they land here (e.g. via a stale link or typed URL).
  //
  // Gated on `hydrated`: until RoleContext has read localStorage, `role` is
  // the "practitioner" placeholder for everyone, so an ungated version of
  // this guard and its mirror image in /portal fired against a value neither
  // of them could trust, and ping-ponged.
  useEffect(() => {
    if (!hydrated) return;
    if (role === "client") router.replace("/portal");
  }, [hydrated, role, router]);

  if (hydrated && role === "client") return null;

  return (
    <div
      className={`app-frame heartful-site-shell flex min-h-screen ${variant === "wellnest-client" ? "wellnest-client-screen" : ""}${title === "Clients" ? " app-frame--clients-typography" : ""}`}
      data-shell-variant={variant ?? "practitioner"}
    >
      <Sidebar />
      <div className="app-workspace-frame flex-1 min-w-0">
        <Topbar title={title} showClientSwitcher={variant === "wellnest-client"} />
        <main className={`app-workspace px-4 py-5 md:px-7 md:py-7 max-w-7xl mx-auto${title === "Prep Center" ? " app-workspace--wide" : ""}`}>{children}</main>
      </div>
    </div>
  );
}
