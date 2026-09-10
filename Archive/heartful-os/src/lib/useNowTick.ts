"use client";

import { useEffect, useState } from "react";

// Ticks a re-render every `intervalMs` while `active`, otherwise stays
// still. Used to drive live elapsed-time displays (Journey Timer, Booster
// Timer) and the 90-minute booster-dose reminder without polling once
// there's nothing left to count (e.g. Journey End has been marked).
export function useNowTick(intervalMs = 1000, active = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, active]);

  return now;
}
