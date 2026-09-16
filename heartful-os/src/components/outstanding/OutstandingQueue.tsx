"use client";

import { CheckCircle2, ChevronDown, FileText, ListFilter } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { clientAvatarSrc, initials } from "@/lib/utils";

export type OutstandingItemType = "Task" | "Form" | "Agreement" | "Session";
export type OutstandingUrgency = "overdue" | "due-soon" | "pending";

export interface OutstandingQueueItem {
  id: string;
  title: string;
  type: OutstandingItemType;
  href: string;
  action: string;
  urgency: OutstandingUrgency;
  statusLabel: string;
  dueAt?: string;
}

export interface OutstandingQueueGroup {
  clientId: string;
  clientName: string;
  items: OutstandingQueueItem[];
}

type Filter = "all" | "overdue" | "forms" | "tasks";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "overdue", label: "Overdue" },
  { id: "forms", label: "Forms" },
  { id: "tasks", label: "Tasks" },
];

const urgencyRank: Record<OutstandingUrgency, number> = {
  overdue: 0,
  "due-soon": 1,
  pending: 2,
};

function matchesFilter(item: OutstandingQueueItem, filter: Filter) {
  if (filter === "overdue") return item.urgency === "overdue";
  if (filter === "forms") return item.type === "Form" || item.type === "Agreement";
  if (filter === "tasks") return item.type === "Task" || item.type === "Session";
  return true;
}

function sortedItems(items: OutstandingQueueItem[]) {
  return [...items].sort((a, b) => {
    const urgencyDifference = urgencyRank[a.urgency] - urgencyRank[b.urgency];
    if (urgencyDifference) return urgencyDifference;
    if (a.dueAt && b.dueAt) return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return a.title.localeCompare(b.title);
  });
}

export default function OutstandingQueue({ groups }: { groups: OutstandingQueueGroup[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const visibleGroups = useMemo(
    () =>
      groups
        .map((group) => {
          const totalOutstanding = group.items.length;
          const totalOverdue = group.items.filter((item) => item.urgency === "overdue").length;
          return {
            ...group,
            totalOutstanding,
            totalOverdue,
            items: sortedItems(group.items.filter((item) => matchesFilter(item, filter))),
          };
        })
        .filter((group) => group.items.length > 0)
        .sort((a, b) => {
          const aRank = Math.min(...a.items.map((item) => urgencyRank[item.urgency]));
          const bRank = Math.min(...b.items.map((item) => urgencyRank[item.urgency]));
          return aRank - bRank || a.clientName.localeCompare(b.clientName);
        }),
    [filter, groups]
  );

  const counts = useMemo(
    () => ({
      all: groups.reduce((count, group) => count + group.items.length, 0),
      overdue: groups.reduce(
        (count, group) => count + group.items.filter((item) => item.urgency === "overdue").length,
        0
      ),
      forms: groups.reduce(
        (count, group) => count + group.items.filter((item) => item.type === "Form" || item.type === "Agreement").length,
        0
      ),
      tasks: groups.reduce(
        (count, group) => count + group.items.filter((item) => item.type === "Task" || item.type === "Session").length,
        0
      ),
    }),
    [groups]
  );

  function toggleClient(clientId: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  if (groups.length === 0) {
    return (
      <div className="card outstanding-empty">
        <CheckCircle2 aria-hidden="true" />
        <strong>Nothing outstanding</strong>
        <p>You&apos;re all caught up.</p>
      </div>
    );
  }

  return (
    <div className="outstanding-queue">
      <div className="outstanding-toolbar" aria-label="Outstanding item filters">
        <div className="outstanding-filters">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              className="outstanding-filter-chip"
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
              <span>{counts[option.id]}</span>
            </button>
          ))}
        </div>
        <div className="outstanding-sort" aria-label="Sort order">
          <ListFilter aria-hidden="true" />
          <span>Most urgent</span>
        </div>
      </div>

      {visibleGroups.length === 0 ? (
        <div className="outstanding-filter-empty">No items match this filter.</div>
      ) : (
        <div className="outstanding-groups">
          {visibleGroups.map((group) => {
            const isCollapsed = collapsed.has(group.clientId);
            const panelId = `outstanding-client-${group.clientId}`;
            const avatarSrc = clientAvatarSrc(group.clientName);

            return (
              <section key={group.clientId} className="card outstanding-client-card">
                <header className="outstanding-client-header">
                  <button
                    type="button"
                    className="outstanding-collapse-button"
                    aria-expanded={!isCollapsed}
                    aria-controls={panelId}
                    onClick={() => toggleClient(group.clientId)}
                  >
                    <ChevronDown aria-hidden="true" />
                    <span className="sr-only">{isCollapsed ? "Expand" : "Collapse"} {group.clientName}</span>
                  </button>
                  <span className="outstanding-client-avatar" aria-hidden="true">
                    {avatarSrc ? (
                      <Image src={avatarSrc} alt="" width={28} height={28} sizes="28px" />
                    ) : (
                      initials(group.clientName)
                    )}
                  </span>
                  <Link href={`/clients/${group.clientId}`} className="outstanding-client-link">
                    {group.clientName}
                  </Link>
                  <span className="outstanding-client-summary">
                    {group.totalOutstanding} outstanding
                    <span aria-hidden="true"> · </span>
                    <strong data-has-overdue={group.totalOverdue > 0}>{group.totalOverdue} overdue</strong>
                  </span>
                </header>

                {!isCollapsed && (
                  <div id={panelId} className="outstanding-items">
                    {group.items.map((item) => (
                      <div key={item.id} className="outstanding-item" data-urgency={item.urgency}>
                        <div className="outstanding-item-main">
                          <FileText aria-hidden="true" />
                          <span className="outstanding-item-type">{item.type}</span>
                          <Link href={item.href} className="outstanding-item-title">
                            {item.title}
                          </Link>
                        </div>
                        <span className="outstanding-item-status" data-urgency={item.urgency}>
                          {item.statusLabel}
                        </span>
                        <Link href={item.href} className="outstanding-item-action">
                          {item.action}
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
