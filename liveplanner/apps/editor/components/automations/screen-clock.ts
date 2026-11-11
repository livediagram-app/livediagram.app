// The Automations screen's clock and time zone (docs/specs/026-plan/automations.md "Time triggers"): the minute the
// screen reads its "4 min ago"s from, and this browser's IANA time zone, which a rule is saved in (the saver's).

import { useEffect, useState } from 'react';

const MINUTE_MS = 60_000;

/** The clock the screen reads its "4 min ago"s from, a minute at a time. */
export function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** This browser's time zone ("Europe/London"), UTC where it can't say. */
export function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
