"use client";
import { useEffect, useState } from "react";
import ClientAvatarImage from "@/components/client/ClientAvatarImage";
import MonthYearPicker from "@/components/calendar/MonthYearPicker";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Clock3, ArrowRight } from "@/components/ui/HeartfulIcon";
import type { Session } from "@/lib/types";
import { clientAvatarSrc, formatDateTime, initials, SESSION_TYPE_LABELS } from "@/lib/utils";
const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const isSameMonth = (first: Date, second: Date) => first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth();
export default function DashboardDateStrip({ sessions }: { sessions: (Session & {client_name: string})[] }) {
  const [today, setToday] = useState<Date | null>(null);
  const [month, setMonth] = useState<Date | null>(null);
  const [start, setStart] = useState<Date | null>(null);
  const [day, setDay] = useState<string | null>(null);
  useEffect(() => {
    const now = new Date();
    // Browser-local date is only known after hydration; server time may use another zone.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(now);
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setStart(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    setDay(keyOf(now));
  }, []);
  if (!month || !today || !start) return <div className="dashboard-empty" aria-busy="true">Loading sessions…</div>;
  const activeMonth = month;
  const calendarToday = today;
  const rangeStart = start;
  const name = activeMonth.toLocaleDateString("en-US", {month:"long"});
  const monthKey = keyOf(activeMonth).slice(0,7);
  const todayKey = keyOf(calendarToday);
  const dates = Array.from({length:9}, (_,i)=>new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate() + i));
  const filtered = sessions.filter(s=>{
    if (!s.scheduled_at || s.status !== "scheduled") return false;
    const scheduled = new Date(s.scheduled_at);
    const key = keyOf(scheduled);
    return scheduled.getTime() >= calendarToday.getTime() && key.startsWith(monthKey) && (!day || key === day);
  }).sort((a,b)=>new Date(a.scheduled_at!).getTime()-new Date(b.scheduled_at!).getTime());
  const isCurrentMonth = activeMonth.getFullYear() === calendarToday.getFullYear() && activeMonth.getMonth() === calendarToday.getMonth();
  const atEarliestDate = rangeStart.getTime() <= new Date(calendarToday.getFullYear(), calendarToday.getMonth(), calendarToday.getDate()).getTime();
  function moveMonth(offset: number) {
    const next = new Date(activeMonth.getFullYear(),activeMonth.getMonth()+offset,1);
    if (next < new Date(calendarToday.getFullYear(), calendarToday.getMonth(), 1)) return;
    setMonth(next); setDay(null);
    setStart(isSameMonth(next, calendarToday) ? new Date(calendarToday.getFullYear(), calendarToday.getMonth(), calendarToday.getDate()) : next);
  }
  function selectMonth(next: Date) {
    if (next < new Date(calendarToday.getFullYear(), calendarToday.getMonth(), 1)) return;
    setMonth(next);
    setDay(null);
    setStart(isSameMonth(next, calendarToday) ? new Date(calendarToday.getFullYear(), calendarToday.getMonth(), calendarToday.getDate()) : next);
  }
  function moveDays(offset: number) {
    const next = new Date(rangeStart);
    next.setDate(next.getDate() + offset);
    const earliest = new Date(calendarToday.getFullYear(), calendarToday.getMonth(), calendarToday.getDate());
    if (next < earliest) return;
    setStart(next);
    setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    setDay(null);
  }
  function goToToday() {
    const now = new Date();
    setToday(now);
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setStart(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    setDay(keyOf(now));
  }
  return <>
    <div className="dashboard-panel-header" style={{flexWrap:"wrap"}}>
      <h2 className="dashboard-accent-title dashboard-section-title" style={{whiteSpace:"nowrap"}}><span className="dashboard-section-icon"><CalendarDays aria-hidden="true" width={20} height={20} strokeWidth={1.75} /></span>Upcoming Sessions</h2>
      <div className="dashboard-header-actions" style={{flexWrap:"wrap", justifyContent:"flex-end", marginLeft:"auto"}}>
        <div className="dashboard-month-navigation" aria-label="Session month navigation">
          <button type="button" aria-label="Previous month" disabled={isCurrentMonth} onClick={()=>moveMonth(-1)}><ChevronLeft aria-hidden="true" /></button>
          <MonthYearPicker value={activeMonth} onChange={selectMonth} minDate={calendarToday} triggerClassName="calendar-month-trigger dashboard-month-label" />
          <button type="button" aria-label="Next month" onClick={()=>moveMonth(1)}><ChevronRight aria-hidden="true" /></button>
        </div>
        <button type="button" className="dashboard-today-action" onClick={goToToday}>Today</button>
        <Link href="/calendar" className="dashboard-add-action"><Plus aria-hidden="true" /> Add session</Link>
      </div>
    </div>
    <div className="dashboard-date-strip" aria-label="Session date navigation">
      <button type="button" className="dashboard-date-arrow" aria-label="Earlier dates" disabled={atEarliestDate} onClick={()=>moveDays(-7)}><ChevronLeft aria-hidden="true" /></button>
      {dates.map(date=>{
        const key=keyOf(date);
        return <button type="button" key={key} className="dashboard-date" data-selected={key===day ? "true":"false"} aria-pressed={key===day} aria-current={key===todayKey ? "date":undefined} aria-label={date.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})} onClick={()=>setDay(key)}><strong>{date.getDate()}</strong><span>{date.toLocaleDateString("en-US",{weekday:"short"})}</span></button>;
      })}
      <button type="button" className="dashboard-date-arrow" aria-label="Later dates" onClick={()=>moveDays(7)}><ChevronRight aria-hidden="true" /></button>
    </div>
    <div className="dashboard-session-table dashboard-filtered-sessions"><div className="dashboard-session-list" aria-live="polite">
      {filtered.length===0 && <div className="dashboard-empty"><CalendarDays aria-hidden="true" /><p>No sessions scheduled for {day ? new Date(`${day}T12:00:00`).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):`${name} ${month.getFullYear()}`}</p></div>}
      {filtered.map(session=>{
        const avatar=clientAvatarSrc(session.client_name);
        return <div key={session.id} className="dashboard-session-row">
          <div className="dashboard-session-time"><Clock3 aria-hidden="true" /><span>{formatDateTime(session.scheduled_at)}</span></div>
          <Link href={`/clients/${session.client_id}`} className="dashboard-client-link dashboard-session-client"><span className="dashboard-session-avatar" aria-hidden="true">{avatar ? <ClientAvatarImage clientName={session.client_name} src={avatar} width={24} height={24} sizes="24px" />:initials(session.client_name)}</span><span className="dashboard-session-client-name">{session.client_name}</span></Link>
          <span className="dashboard-session-type">{session.session_type === "other" ? "Completed" : SESSION_TYPE_LABELS[session.session_type] ?? session.session_type.replace(/_/g," ")}</span>
          <span className="badge status-pill--success">Scheduled</span>
          <Link href={`/clients/${session.client_id}/sessions/${session.id}`} className="dashboard-row-action">{session.location?.startsWith("http") ? "Join":"Prepare"}<ArrowRight aria-hidden="true" /></Link>
        </div>;
      })}
    </div></div>
    <Link href="/calendar" className="dashboard-text-action">View calendar <ArrowRight aria-hidden="true" width={13} height={13} /></Link>
  </>;
}
