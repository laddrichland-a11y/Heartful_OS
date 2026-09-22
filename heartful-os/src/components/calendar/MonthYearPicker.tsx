"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "@/components/ui/HeartfulIcon";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function MonthYearPicker({ value, onChange, triggerClassName }: { value: Date; onChange: (date: Date) => void; triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(value.getFullYear());
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    selected.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return <div ref={root} className="calendar-month-picker" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className={triggerClassName ?? "calendar-month-trigger text-lg font-semibold text-ink-900 min-w-[160px] text-center"} aria-expanded={open} aria-controls={id} aria-haspopup="dialog" onClick={() => {
      if (!open) setYear(value.getFullYear());
      setOpen(!open);
    }}>{value.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</button>
    {open && <div id={id} className="calendar-month-popover" role="dialog" aria-label="Choose month and year">
      <div className="calendar-picker-year">
        <button type="button" aria-label="Previous year" onClick={() => setYear(year - 1)}><ChevronLeft aria-hidden="true" /></button>
        <strong aria-live="polite">{year}</strong>
        <button type="button" aria-label="Next year" onClick={() => setYear(year + 1)}><ChevronRight aria-hidden="true" /></button>
      </div>
      <div className="calendar-picker-months">
        {months.map((label, index) => {
          const active = value.getFullYear() === year && value.getMonth() === index;
          return <button ref={index === value.getMonth() ? selected : undefined} key={label} type="button" aria-label={`${label} ${year}`} aria-pressed={active} onClick={() => {
            onChange(new Date(year, index, 1));
            setOpen(false);
            trigger.current?.focus();
          }}>{label}</button>;
        })}
      </div>
    </div>}
  </div>;
}
