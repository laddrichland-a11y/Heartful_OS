"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Search,
  BarChart3,
  Sparkles,
  Settings,
  HeartHandshake,
  UserPlus,
} from "lucide-react";
import { cx } from "@/lib/utils";
import { getUnreadMessageCountAction } from "@/lib/actions";

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

// Polls for unread client messages so a badge can show up on "Clients"
// without the practitioner having to open the dashboard first. 20s is
// frequent enough to feel live without hammering the mock/Firestore layer.
const UNREAD_POLL_MS = 20_000;

export default function Sidebar() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      getUnreadMessageCountAction().then((count) => {
        if (!cancelled) setUnreadCount(count);
      });
    };
    poll();
    const interval = setInterval(poll, UNREAD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-ink-100 bg-white min-h-screen sticky top-0 self-start">
      <Link href="/dashboard" className="px-5 py-5 flex items-center gap-2 border-b border-ink-100 hover:bg-ink-50 transition-colors">
        <div className="h-8 w-8 rounded-lg bg-clay-500 text-white flex items-center justify-center">
          <HeartHandshake className="h-4.5 w-4.5" />
        </div>
        <div>
          <div className="font-semibold text-ink-900 leading-tight">Heartful OS</div>
          <div className="text-[11px] text-ink-400 leading-tight">Journey Management</div>
        </div>
      </Link>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active ? "bg-clay-50 text-clay-700" : "text-ink-600 hover:bg-ink-50"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.href === "/clients" && unreadCount > 0 && (
                <span className="text-[11px] font-semibold bg-clay-500 text-white rounded-full h-5 min-w-5 px-1 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-ink-100 text-[11px] text-ink-400">
        Heartful OS is a journey management platform, not a medical records system.
      </div>
    </aside>
  );
}
