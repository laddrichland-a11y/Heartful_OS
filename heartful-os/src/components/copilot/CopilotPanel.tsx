"use client";

import { useRef, useState } from "react";
import ClientAvatarImage from "@/components/client/ClientAvatarImage";
import Link from "next/link";
import { Sparkles, Loader2, CalendarClock, ArrowRight, ChevronRight, ListChecks, IntegrationLink } from "@/components/ui/HeartfulIcon";
import SummaryCard from "@/components/ai/SummaryCard";
import FilterSelect from "@/components/client/FilterSelect";
import { clientAvatarSrc, formatDateTime, initials } from "@/lib/utils";

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

const UNSCHEDULED = "unscheduled";

export default function CopilotPanel({
  sessions,
  clients,
}: {
  sessions: SessionRow[];
  clients: { id: string; full_name: string }[];
}) {
  const prepareRef = useRef<HTMLElement>(null);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [briefing, setBriefing] = useState<SummaryResult | null>(null);
  const [savedTo, setSavedTo] = useState<{ clientId: string; clientName: string } | null>(null);
  const [briefingBusy, setBriefingBusy] = useState(false);
  const [briefingError, setBriefingError] = useState("");
  const [summaryClient, setSummaryClient] = useState("");
  const [livingSummary, setLivingSummary] = useState<SummaryResult | null>(null);
  const [livingBusy, setLivingBusy] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  const orderedSessions = [...sessions].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );
  const clientSessions = orderedSessions.filter((s) => s.clientId === selectedClient);
  const session = clientSessions.find((s) => s.id === selectedSession);
  const client = clients.find((c) => c.id === selectedClient);
  const canBrief = Boolean(client && (session || (selectedSession === UNSCHEDULED && clientSessions.length === 0)));

  function selectUpcoming(s: SessionRow) {
    setSelectedClient(s.clientId);
    setSelectedSession(s.id);
    setBriefing(null);
    setSavedTo(null);
    setBriefingError("");
    prepareRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    requestAnimationFrame(() =>
      prepareRef.current?.querySelector<HTMLButtonElement>(".prep-select button")?.focus({ preventScroll: true })
    );
  }

  async function generateBriefing() {
    if (!client || !canBrief) return;
    setBriefingBusy(true);
    setBriefing(null);
    setBriefingError("");
    setSavedTo(null);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          summaryType: "prepare_me_briefing",
          sessionId: session?.id,
          sessionTypeLabel: session?.label ?? "Upcoming Session",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.summary) throw new Error(json.error ?? "Briefing could not be generated.");
      setBriefing(json.summary);
      setSavedTo({ clientId: client.id, clientName: client.full_name });
    } catch (error) {
      setBriefingError(error instanceof Error ? error.message : "Briefing could not be generated.");
    } finally {
      setBriefingBusy(false);
    }
  }

  async function generateLivingSummary() {
    if (!summaryClient) return;
    setLivingBusy(true);
    setSummaryError("");
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: summaryClient, summaryType: "living_journey_summary" }),
      });
      const json = await res.json();
      if (!res.ok || !json.summary) throw new Error(json.error ?? "Summary could not be generated.");
      setLivingSummary(json.summary);
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : "Summary could not be generated.");
    } finally {
      setLivingBusy(false);
    }
  }

  return (
    <div className="prep-center">
      <section className="card prep-section" aria-labelledby="upcoming-heading">
        <div className="prep-heading">
          <h2 id="upcoming-heading"><ListChecks className="h-4 w-4" /> Upcoming Sessions</h2>
          <p>{sessions.length} {sessions.length === 1 ? "session" : "sessions"} in the next 30 days.</p>
        </div>
        {orderedSessions.length === 0 ? (
          <p className="prep-empty">Nothing scheduled in the next 30 days.</p>
        ) : (
          <div className="prep-session-list">
            {orderedSessions.map((s, index) => (
              <button
                key={s.id}
                type="button"
                onClick={() => selectUpcoming(s)}
                className="prep-session-row"
                aria-label={`Prepare for ${s.clientName}, ${s.label}, ${formatDateTime(s.scheduledAt)}`}
              >
                <span className="prep-session-identity">
                  <span className="prep-session-avatar" aria-hidden="true">
                    {clientAvatarSrc(s.clientName) ? (
                      <ClientAvatarImage clientName={s.clientName} src={clientAvatarSrc(s.clientName)!} width={30} height={30} sizes="30px" />
                    ) : initials(s.clientName)}
                  </span>
                  <span className="prep-session-client">{s.clientName}</span>
                  {index === 0 && <span className="prep-next-badge">Next</span>}
                </span>
                <span className="prep-session-type">{s.label}</span>
                <span className="prep-session-time">{formatDateTime(s.scheduledAt)}</span>
                <ChevronRight className="prep-session-chevron" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </section>

      <section ref={prepareRef} className="card prep-section prep-primary" aria-labelledby="prepare-heading">
        <div className="prep-heading">
          <h2 id="prepare-heading"><CalendarClock className="h-4 w-4" /> Prepare for Session</h2>
        </div>
        <div className="prep-controls">
          <div className="prep-field">
            <span>Client</span>
            <FilterSelect
              ariaLabel="Client for session briefing"
              value={selectedClient}
              options={[
                { value: "", label: "Select a client" },
                ...clients.map((c) => ({ value: c.id, label: c.full_name })),
              ]}
              onChange={(value) => {
                setSelectedClient(value);
                setSelectedSession("");
                setBriefing(null);
                setSavedTo(null);
                setBriefingError("");
              }}
              className="prep-select"
              menuClassName="prep-select-menu"
              autoFlip
            />
          </div>
          <div className="prep-field">
            <span>Session</span>
            <FilterSelect
              ariaLabel="Session for briefing"
              value={selectedSession}
              disabled={!selectedClient}
              options={[
                { value: "", label: "Select a session" },
                ...clientSessions.map((s) => ({
                  value: s.id,
                  label: `${s.label} · ${formatDateTime(s.scheduledAt)}`,
                })),
                ...(selectedClient && clientSessions.length === 0
                  ? [{ value: UNSCHEDULED, label: "Upcoming Session (not scheduled)" }]
                  : []),
              ]}
              onChange={(value) => {
                setSelectedSession(value);
                setBriefing(null);
                setSavedTo(null);
                setBriefingError("");
              }}
              className="prep-select"
              menuClassName="prep-select-menu"
              autoFlip
            />
          </div>
          <button type="button" disabled={!canBrief || briefingBusy} onClick={generateBriefing} className="btn-primary prep-action">
            {briefingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate Briefing
          </button>
        </div>
        {briefingError && <p className="prep-error" role="alert">{briefingError}</p>}
        {briefing && (
          <div className="prep-result">
            <SummaryCard title="Pre-Session Briefing" content={briefing.content} model={briefing.model} />
            {savedTo && (
              <Link href={`/clients/${savedTo.clientId}?tab=${encodeURIComponent("AI Copilot")}`} className="prep-saved-link">
                Saved to {savedTo.clientName}&apos;s record <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </section>

      <section className="card prep-section prep-secondary" aria-labelledby="journey-heading">
        <div className="prep-heading">
          <h2 id="journey-heading"><IntegrationLink className="h-4 w-4" /> Living Journey Summary</h2>
        </div>
        <div className="prep-controls prep-summary-controls">
          <div className="prep-field">
            <span>Client</span>
            <FilterSelect
              ariaLabel="Client for journey summary"
              value={summaryClient}
              options={[
                { value: "", label: "Select a client" },
                ...clients.map((c) => ({ value: c.id, label: c.full_name })),
              ]}
              onChange={(value) => {
                setSummaryClient(value);
                setLivingSummary(null);
                setSummaryError("");
              }}
              className="prep-select"
              menuClassName="prep-select-menu"
              autoFlip
            />
          </div>
          <button type="button" disabled={!summaryClient || livingBusy} onClick={generateLivingSummary} className="btn-secondary prep-action">
            {livingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate Summary
          </button>
        </div>
        {summaryError && <p className="prep-error" role="alert">{summaryError}</p>}
        {livingSummary && <div className="prep-result"><SummaryCard title="Living Journey Summary" content={livingSummary.content} model={livingSummary.model} /></div>}
      </section>
    </div>
  );
}
