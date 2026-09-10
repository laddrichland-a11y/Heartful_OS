"use client";

import { useRouter } from "next/navigation";
import { useRole } from "@/components/RoleContext";
import { Menu, LogOut } from "lucide-react";
import { useState } from "react";
import MobileNav from "./MobileNav";
import { logoutAction } from "@/lib/actions";

export default function Topbar({ title }: { title: string }) {
  const { role, setRole, setIsPreview } = useRole();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-ink-100">
        <div className="flex items-center justify-between px-4 md:px-6 py-3.5">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-ink-50" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold text-ink-900">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center text-xs bg-ink-50 rounded-full p-1">
              <button
                onClick={() => {
                  setRole("practitioner");
                  router.push("/dashboard");
                }}
                className={`px-3 py-1 rounded-full transition-colors ${
                  role === "practitioner" ? "bg-white shadow text-ink-900 font-medium" : "text-ink-500"
                }`}
              >
                Practitioner View
              </button>
              <button
                onClick={() => {
                  setRole("client");
                  setIsPreview(true);
                  router.push("/portal");
                }}
                className={`px-3 py-1 rounded-full transition-colors ${
                  role === "client" ? "bg-white shadow text-ink-900 font-medium" : "text-ink-500"
                }`}
              >
                Client Portal View
              </button>
            </div>
            <button
              className="p-1.5 rounded-lg hover:bg-ink-50 text-ink-400"
              title="Log out"
              onClick={async () => {
                try {
                  await logoutAction();
                } catch (err) {
                  if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
                }
              }}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}
