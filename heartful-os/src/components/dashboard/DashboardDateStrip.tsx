"use client";
import { useEffect, useState } from "react";
import ClientAvatarImage from "@/components/client/ClientAvatarImage";
import MonthYearPicker from "@/components/calendar/MonthYearPicker";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Clock3, ArrowRight } from "@/components/ui/HeartfulIcon";
import type { Session } from "@/lib/types";
import { clientAvatarSrc, formatDateTime, initials, SESSION_TYPE_LABELS } from "@/lib/utils";
const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
export default function DashboardDateStrip({ sessions }: { sessions: (Session & {client_name: string})[] }) {
  const [today, setToday] = useState<Date | null>(null);
  const [month, setMonth] = useState<Date | null>(null);
  const [start, setStart] = useState(1);
  const [day, setDay] = useState<string | null>(null);
  useEffect(() => {
    const now = new Date();
    // Browser-local date is only known after hydration; server time may use another zone.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(now);
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setDay(keyOf(now));
    const end = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    setStart(Math.max(1, Math.min(now.getDate()-3, end-8)));
  }, []);
  if (!month || !today) return <div className="dashboard-empty" aria-busy="true">Loading sessions…</div>;
  const name = month.toLocaleDateString("en-US", {month:"long"});
  const monthKey = keyOf(month).slice(0,7);
  const todayKey = keyOf(today);
  const end = new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  const dates = Array.from({length:9}, (_,i)=>new Date(month.getFullYear(),month.getMonth(),start+i));
  const filtered = sessions.filter(s=>{
    if (!s.scheduled_at || s.status !== "scheduled") return false;
    const key = keyOf(new Date(s.scheduled_at));
    return key.startsWith(monthKey) && (!day || key === day);
  }).sort((a,b)=>new Date(a.scheduled_at!).getTime()-new Date(b.scheduled_at!).getTime());
  function moveMonth(offset: number, tail = false) {
    const next = new Date(month!.getFullYear(),month!.getMonth()+offset,1);
    setMonth(next); setDay(null);
    setStart(tail ? new Date(next.getFullYear(),next.getMonth()+1,0).getDate()-8 : 1);
  }
  function selectMonth(next: Date) {
    setMonth(next);
    setDay(null);
    setStart(1);
  }
  function moveDays(offset: number) {
    if (day) {
      const selectedDate = new Date(`${day}T12:00:00`);
      selectedDate.setDate(selectedDate.getDate() + offset);
      const selectedEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth()+1, 0).getDate();
      setMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
      setStart(Math.max(1, Math.min(selectedDate.getDate()-3, selectedEnd-8)));
      setDay(keyOf(selectedDate));
      return;
    }
    if (offset < 0 && start === 1) moveMonth(-1,true);
    else if (offset > 0 && start+8 >= end) moveMonth(1);
    else setStart(Math.max(1,Math.min(start+offset,end-8)));
  }
  function goToToday() {
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    setToday(now);
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setStart(Math.max(1, Math.min(now.getDate()-3, monthEnd-8)));
    setDay(keyOf(now));
  }
  return <>
    <div className="dashboard-panel-header" style={{flexWrap:"wrap"}}>
      <h2 className="dashboard-accent-title dashboard-section-title" style={{whiteSpace:"nowrap"}}><span className="dashboard-section-icon"><CalendarDays aria-hidden="true" width={20} height={20} strokeWidth={1.75} /></span>Upcoming Sessions</h2>
      <div className="dashboard-header-actions" style={{flexWrap:"wrap", justifyContent:"flex-end", marginLeft:"auto"}}>
        <div className="dashboard-month-navigation" aria-label="Session month navigation">
          <button type="button" aria-label="Previous month" onClick={()=>moveMonth(-1)}><ChevronLeft aria-hidden="true" /></button>
          <MonthYearPicker value={month} onChange={selectMonth} triggerClassName="calendar-month-trigger dashboard-month-label" />
          <button type="button" aria-label="Next month" onClick={()=>moveMonth(1)}><ChevronRight aria-hidden="true" /></button>
        </div>
        <button type="button" className="dashboard-today-action" onClick={goToToday}>Today</button>
        <Link href="/calendar" className="dashboard-add-action"><Plus aria-hidden="true" /> Add session</Link>
      </div>
    </div>
    <div className="dashboard-date-strip" aria-label="Session date navigation">
      <button type="button" className="dashboard-date-arrow" aria-label="Earlier dates" onClick={()=>moveDays(-7)}><ChevronLeft aria-hidden="true" /></button>
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
