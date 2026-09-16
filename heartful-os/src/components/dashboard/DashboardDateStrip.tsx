"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function DashboardDateStrip({ initialDate }: { initialDate: string }) {
  const [anchor, setAnchor] = useState(() => new Date(`${initialDate}T12:00:00`));
  const selectedKey = toDateKey(anchor);
  const dates = Array.from({ length: 9 }, (_, index) => {
    const date = new Date(anchor);
    date.setDate(anchor.getDate() + index - 3);
    return { key: toDateKey(date), day: date.toLocaleDateString("en-US", { weekday: "short" }), date: date.getDate() };
  });
  const shift = (days: number) => setAnchor((current) => {
    const next = new Date(current);
    next.setDate(next.getDate() + days);
    return next;
  });

  return <div className="dashboard-date-strip" aria-label="Session date navigation">
    <button type="button" className="dashboard-date-arrow" aria-label="Earlier dates" onClick={() => shift(-7)}><ChevronLeft /></button>
    {dates.map((item) => <Link key={item.key} href={`/calendar?date=${item.key}`} className="dashboard-date" data-selected={item.key === selectedKey ? "true" : "false"}><strong>{item.date}</strong><span>{item.day}</span></Link>)}
    <button type="button" className="dashboard-date-arrow" aria-label="Later dates" onClick={() => shift(7)}><ChevronRight /></button>
  </div>;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
