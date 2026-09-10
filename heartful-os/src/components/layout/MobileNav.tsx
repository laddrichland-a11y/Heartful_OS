"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { X, LayoutDashboard, Users, CalendarDays, Search, BarChart3, Sparkles, Settings, HeartHandshake, UserPlus } from "lucide-react";
import { cx } from "@/lib/utils";
import { useRole } from "@/components/RoleContext";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/prospects", label: "Prospects", icon: UserPlus },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/copilot", label: "Prep Center", icon: Sparkles },
  { href: "/search", label: "Search", icon: Search },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, setRole, setIsPreview } = useRole();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 md:hidden">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl flex flex-col">
        <div className="px-5 py-5 flex items-center justify-between border-b border-ink-100">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-clay-500 text-white flex items-center justify-center">
              <HeartHandshake className="h-4.5 w-4.5" />
            </div>
            <span className="font-semibold text-ink-900">Heartful OS</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-50">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 pt-4">
          <div className="flex items-center text-xs bg-ink-50 rounded-full p-1">
            <button
              onClick={() => {
                setRole("practitioner");
                router.push("/dashboard");
                onClose();
              }}
              className={cx(
                "flex-1 px-3 py-1.5 rounded-full transition-colors",
                role === "practitioner" ? "bg-white shadow text-ink-900 font-medium" : "text-ink-500"
              )}
            >
              Practitioner View
            </button>
            <button
              onClick={() => {
                setRole("client");
                setIsPreview(true);
                router.push("/portal");
                onClose();
              }}
              className={cx(
                "flex-1 px-3 py-1.5 rounded-full transition-colors",
                role === "client" ? "bg-white shadow text-ink-900 font-medium" : "text-ink-500"
              )}
            >
              Client Portal View
            </button>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cx(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium",
                  active ? "bg-clay-50 text-clay-700" : "text-ink-600 hover:bg-ink-50"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
