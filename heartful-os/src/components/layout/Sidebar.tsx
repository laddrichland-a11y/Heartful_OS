"use client";

import Link from "next/link";
import Image from "next/image";
import HeartfulBrand from "@/components/ui/HeartfulBrand";
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
        <div className="sidebar-nature-message">
          <svg className="sidebar-nature-mark sidebar-fern" viewBox="0 0 80 112" aria-hidden="true">
            <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3">
              <path d="M22 107Q33 57 38 5" />
              <path d="M25 99Q46 61 72 36" />
            </g>
            <g fill="currentColor">
              {[
                [25, 91, 0.95], [27, 81, 1], [29, 71, 0.95],
                [31, 61, 0.85], [33, 51, 0.75], [34, 42, 0.65],
                [35, 34, 0.55], [36, 27, 0.45], [37, 21, 0.35],
                [37.5, 16, 0.25],
              ].map(([x, y, scale], index) => (
                <g key={`upright-${index}`} transform={`translate(${x} ${y}) rotate(6) scale(${scale})`}>
                  <path d="M0 0C-9-1-16-8-17-15C-9-13-3-8 0 0Z" />
                  <path d="M0 0C7-2 13-9 14-16C6-13 2-7 0 0Z" opacity="0.85" />
                </g>
              ))}
              {[
                [31, 88, 0.7], [36, 79, 0.75], [42, 70, 0.7],
                [49, 61, 0.6], [56, 53, 0.5], [62, 46, 0.38],
                [67, 41, 0.25],
              ].map(([x, y, scale], index) => (
                <g key={`arching-${index}`} transform={`translate(${x} ${y}) rotate(38) scale(${scale})`}>
                  <path d="M0 0C-8-1-14-7-15-14C-8-12-2-7 0 0Z" opacity="0.85" />
                  <path d="M0 0C7-2 12-8 13-15C6-12 2-6 0 0Z" />
                </g>
              ))}
              <path d="M38 13C35 9 36 4 39 1C41 6 40 10 38 13Z" />
              <path d="M70 39C69 35 73 32 77 31C76 35 73 38 70 39Z" />
            </g>
          </svg>
          <Image
            className="sidebar-nature-mark sidebar-mushrooms"
            src="/images/mushroom-grove-selected-clean.png"
            alt=""
            width={1199}
            height={1312}
            sizes="128px"
          />
          <Image className="sidebar-nature-mark sidebar-twilight-mushrooms" src="/images/twilight-mushrooms-detailed.png" alt="" width={906} height={1736} sizes="100px" />
          <p className="sidebar-fern-caption">People heal.<br />A kinder tomorrow<br />is possible.</p>
          <p className="sidebar-mushroom-caption">Deeper<br />conversations.<br />Brighter futures.</p>
        </div>
      </div>
    </aside>
  );
}
