import { useEffect, useState } from 'react';

// The moment the current day began being seen, as state that moves on at local midnight (and on any render that
// finds the day has changed, after a laptop sleeps through midnight), so a reading by the day (a metric's due or
// overdue count) rolls over without a reload. Stable for the whole day, so memos keyed on it recompute once a day.
// One timeout per caller, re-armed each day: nothing ticks in between.
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());
  const seen = new Date();
  // A render on a new day takes it at once (derived state: React re-renders before committing).
  if (seen.toDateString() !== today.toDateString()) setToday(seen);
  useEffect(() => {
    const next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    // A moment past midnight, so the new day has surely begun when it fires.
    const id = window.setTimeout(() => setToday(new Date()), next.getTime() - Date.now() + 50);
    return () => window.clearTimeout(id);
  }, [today]);
  return today;
}
