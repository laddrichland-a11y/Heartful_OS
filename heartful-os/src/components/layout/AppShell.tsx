"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/components/RoleContext";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
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
    <div className="flex min-h-screen bg-[var(--background)]">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <Topbar title={title} />
        <main className="px-4 md:px-6 py-6 max-w-7xl mx-auto">{children}</main>
      </div>
    </div>
  );
}
