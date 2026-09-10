"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2, CalendarClock, ArrowRight, ListChecks } from "lucide-react";
import SummaryCard from "@/components/ai/SummaryCard";
import { formatDateTime } from "@/lib/utils";

interface SessionRow {
  id: string;
  clientId: string;
  clientName: string;
  label: string;
  scheduledAt: string;
}

interface SummaryResult {
  content: Record<string, unknown>;
  title: string;
  model?: string;
}

export default function CopilotPanel({
  sessions,
  clients,
}: {
  sessions: SessionRow[];
  clients: { id: string; full_name: string }[];
}) {
  const [briefingFor, setBriefingFor] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<SummaryResult | null>(null);
  // Which client the current briefing was saved against — surfaced as a
  // "Saved to {name}'s record" link so it's clear the briefing isn't just
  // floating in this panel; it's archived on that client's own record too.
  const [savedTo, setSavedTo] = useState<{ clientId: string; clientName: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Which client's session stages are expanded in the "Prepare Me" list —
  // grouped by client instead of one flat row per upcoming session, since a
  // single client can have several upcoming stages (intake, 12-hr check-in,
  // integration 1/2, etc.) and a flat list repeated their name once per row.
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  const [pickedClient, setPickedClient] = useState("");
  const [livingSummary, setLivingSummary] = useState<SummaryResult | null>(null);
  const [livingBusy, setLivingBusy] = useState(false);

  async function prepareMe(
    busyKey: string,
    body: { clientId: string; clientName: string; sessionId?: string; sessionTypeLabel: string }
  ) {
    setBusyId(busyKey);
    setBriefingFor(busyKey);
    setSavedTo(null);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: body.clientId,
          summaryType: "prepare_me_briefing",
          sessionId: body.sessionId,
          sessionTypeLabel: body.sessionTypeLabel,
        }),
      });
      const json = await res.json();
      setBriefing(json.summary);
      // This briefing is now permanently saved on the client's own record
      // (AiSummary tied to clientId) — not just sitting in this panel's
      // local state, so make that visible instead of implying it.
      setSavedTo({ clientId: body.clientId, clientName: body.clientName });
    } finally {
      setBusyId(null);
    }
  }

  async function generateLivingSummary() {
    if (!pickedClient) return;
    setLivingBusy(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: pickedClient, summaryType: "living_journey_summary" }),
      });
      const json = await res.json();
      setLivingSummary(json.summary);
    } finally {
      setLivingBusy(false);
    }
  }

  // Group the flat session list by client. Seeded from the full client list
  // (not just clients with a scheduled session) so someone like a brand-new
  // intake client — who may not have a session entered on the calendar yet —
  // still shows up in the dropdown and can get a briefing.
  const byClient = new Map<string, { clientName: string; sessions: SessionRow[] }>();
  for (const c of clients) {
    byClient.set(c.id, { clientName: c.full_name, sessions: [] });
  }
  for (const s of sessions) {
    const entry = byClient.get(s.clientId) ?? { clientName: s.clientName, sessions: [] };
    entry.sessions.push(s);
    byClient.set(s.clientId, entry);
  }
  const clientGroups = [...byClient.entries()]
    .map(([clientId, v]) => ({ clientId, ...v }))
    .sort((a, b) => a.clientName.localeCompare(b.clientName));

  function jumpToClient(clientId: string) {
    setExpandedClient(clientId);
    document.getElementById("prepare-me-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="font-semibold text-ink-900 mb-1 flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-plum-500" /> Next 30 Days
        </h2>
        <p className="text-xs text-ink-400 mb-4">
          Every upcoming stage across your practice, in order — so you know what to prepare for and when. Click a
          row to jump straight to that client below.
        </p>
        {sessions.length === 0 ? (
          <p className="text-sm text-ink-400">Nothing scheduled in the next 30 days.</p>
        ) : (
          <div className="space-y-1.5">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => jumpToClient(s.clientId)}
                className="w-full flex items-center justify-between gap-3 bg-ink-50/40 hover:bg-ink-50 rounded-lg px-3 py-2 text-left transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-medium text-ink-900 truncate">{s.clientName}</span>
                  <span className="text-xs text-ink-400 shrink-0">·</span>
                  <span className="text-xs text-ink-600 truncate">{s.label}</span>
                </div>
                <span className="text-xs text-ink-400 shrink-0">{formatDateTime(s.scheduledAt)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div id="prepare-me-card" className="card p-5">
        <h2 className="font-semibold text-ink-900 mb-1 flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-clay-500" /> Prepare Me For This Session
        </h2>
        <p className="text-xs text-ink-400 mb-4">
          Generates a structured pre-session briefing — who this client is, why they&apos;re here, intentions, risks,
          insights, commitments, and focus for today — pulled from their full journey history.
        </p>
        {clientGroups.length === 0 ? (
          <p className="text-sm text-ink-400">No upcoming sessions scheduled.</p>
        ) : (
          <div className="space-y-3">
            <select
              value={expandedClient ?? ""}
              onChange={(e) => setExpandedClient(e.target.value || null)}
              className="w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
            >
              <option value="">Select a client...</option>
              {clientGroups.map((group) => (
                <option key={group.clientId} value={group.clientId}>
                  {group.clientName}
                  {group.sessions.length > 0
                    ? ` (${group.sessions.length} upcoming ${group.sessions.length === 1 ? "stage" : "stages"})`
                    : ""}
                </option>
              ))}
            </select>

            {expandedClient &&
              (() => {
                const group = clientGroups.find((g) => g.clientId === expandedClient);
                if (!group) return null;
                const genericKey = `generic:${group.clientId}`;
                return (
                  <div className="space-y-2">
                    {group.sessions.length === 0 && (
                      <div className="flex items-center justify-between gap-3 bg-ink-50/40 rounded-lg px-3 py-2.5">
                        <div className="text-xs text-ink-600">No session scheduled on the calendar yet</div>
                        <button
                          disabled={busyId === genericKey}
                          onClick={() =>
                            prepareMe(genericKey, {
                              clientId: group.clientId,
                              clientName: group.clientName,
                              sessionTypeLabel: "Upcoming Session",
                            })
                          }
                          className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 shrink-0"
                        >
                          {busyId === genericKey ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          Prepare Me
                        </button>
                      </div>
                    )}
                    {group.sessions.map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-3 bg-ink-50/40 rounded-lg px-3 py-2.5">
                        <div className="text-xs text-ink-600">
                          {s.label} · {formatDateTime(s.scheduledAt)}
                        </div>
                        <button
                          disabled={busyId === s.id}
                          onClick={() =>
                            prepareMe(s.id, {
                              clientId: s.clientId,
                              clientName: s.clientName,
                              sessionId: s.id,
                              sessionTypeLabel: s.label,
                            })
                          }
                          className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 shrink-0"
                        >
                          {busyId === s.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          Prepare Me
                        </button>
                      </div>
                    ))}
                    {briefing &&
                      (briefingFor === genericKey || group.sessions.some((s) => s.id === briefingFor)) && (
                        <div className="pt-1 space-y-2">
                          <SummaryCard title="Pre-Session Briefing" content={briefing.content} model={briefing.model} />
                          {savedTo && (
                            <Link
                              href={`/clients/${savedTo.clientId}?tab=${encodeURIComponent("AI Copilot")}`}
                              className="inline-flex items-center gap-1.5 text-xs text-clay-600 hover:text-clay-700 font-medium"
                            >
                              Saved to {savedTo.clientName}&apos;s record <ArrowRight className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      )}
                  </div>
                );
              })()}
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="font-semibold text-ink-900 mb-1 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-plum-500" /> Living Journey Summary
        </h2>
        <p className="text-xs text-ink-400 mb-4">
          A continuously updated narrative of a client&apos;s journey — goals, themes, growth, and open threads —
          synthesized from everything on file.
        </p>
        <div className="flex gap-2 mb-3">
          <select
            value={pickedClient}
            onChange={(e) => setPickedClient(e.target.value)}
            className="flex-1 border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
          >
            <option value="">Select a client...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
          <button
            disabled={!pickedClient || livingBusy}
            onClick={generateLivingSummary}
            className="btn-primary text-sm px-4 flex items-center gap-2 shrink-0 disabled:opacity-60"
          >
            {livingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate
          </button>
        </div>
        {livingSummary && <SummaryCard title="Living Journey Summary" content={livingSummary.content} model={livingSummary.model} />}
      </div>
    </div>
  );
}
