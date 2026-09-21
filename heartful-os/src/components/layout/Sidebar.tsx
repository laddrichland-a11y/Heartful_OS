"use client";

import Link from "next/link";
import HeartfulBrand from "@/components/ui/HeartfulBrand";
import SidebarNatureMessage from "@/components/layout/SidebarNatureMessage";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  BarChart3,
  Settings,
  UserPlus,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
} from "@/components/ui/HeartfulIcon";
import { cx } from "@/lib/utils";
import { getActiveClientCountAction } from "@/lib/actions";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/prospects", label: "Prospects", icon: UserPlus },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/copilot", label: "Prep Center", icon: ListChecks },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Keep the navigation count aligned with the dashboard's active-client total.
const ACTIVE_CLIENT_POLL_MS = 20_000;
const SIDEBAR_COLLAPSED_KEY = "heartful-sidebar-collapsed";

export default function Sidebar() {
  const pathname = usePathname();
  const [activeClientCount, setActiveClientCount] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  /* These effects hydrate preferences from browser storage, an external
     system that is intentionally synchronized after the first render. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
    } catch {
      // Keep the expanded default when storage is unavailable.
    }
  }, []);

  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      getActiveClientCountAction().then((count) => {
        if (!cancelled) setActiveClientCount(count);
      });
    };
    poll();
    const interval = setInterval(poll, ACTIVE_CLIENT_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // The control still works for the current page without persistence.
      }
      return next;
    });
  }

  return (
    <aside
      className="app-sidebar relative hidden min-h-screen w-60 shrink-0 self-start transition-[width] duration-200 md:flex md:flex-col sticky top-0"
      data-collapsed={collapsed ? "true" : "false"}
    >
      <button
        type="button"
        className="sidebar-collapse-button"
        onClick={toggleSidebar}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        aria-controls="primary-sidebar-navigation"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
      </button>
      <Link
        href="/dashboard"
        className="sidebar-brand flex items-center gap-2 px-5 py-5 transition-colors hover:bg-ink-50"
        aria-label="Heartful dashboard"
      >
        <HeartfulBrand />
      </Link>
      <nav id="primary-sidebar-navigation" className="sidebar-nav flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-active={active ? "true" : "false"}
              aria-label={item.label}
              title={collapsed ? item.label : undefined}
              className={cx(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active ? "bg-clay-50 text-clay-700" : "text-ink-600 hover:bg-ink-50"
              )}
            >
              <span className="sidebar-icon-box" aria-hidden="true">
                <Icon />
              </span>
              <span className={cx("sidebar-label flex-1", active && "text-clay-600")}>{item.label}</span>
              {item.href === "/clients" && activeClientCount > 0 && (
                <span className="sidebar-count text-xs font-semibold bg-clay-500 text-white rounded-full h-5 min-w-5 px-1 flex items-center justify-center">
                  {activeClientCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-footer px-5 py-4 border-t border-ink-100 text-xs text-ink-400">
        <SidebarNatureMessage />
      </div>
    </aside>
  );
}
