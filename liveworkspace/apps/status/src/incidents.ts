// Incidents (liveworkspace/docs/status.md "The hourly run"): outages only. A run of consecutive down checks of one
// service, from its first down check to the first check after it that answered (up or slow). Each run opens, extends or
// closes them. A slow hour is no incident: the day's bar shows it. Pure.

import type { CheckError, CheckResult } from '@liveworkspace/status';

export type Incident = {
  // The row's id, or null for one this run opens.
  id: number | null;
  service: string;
  startedAt: number;
  // The last down check.
  lastAt: number;
  // The first check after it that answered; null while open.
  endedAt: number | null;
  // Always 'down': stored and sent as a state, so the table and the API keep their shape.
  worst: 'down';
  checks: number;
  // The first error of the spell, if it had one.
  error: CheckError | null;
};

export type IncidentStep = {
  // Opened this run (no id yet).
  opened: Incident[];
  // Extended or closed this run.
  changed: Incident[];
  // Every incident open after this run, and every one this run closed.
  after: Incident[];
};

/** One run's effect on the open incidents. A service missing from `results` this run leaves its incident as it is. */
export function stepIncidents(
  open: readonly Incident[],
  results: ReadonlyMap<string, CheckResult>,
  at: number,
): IncidentStep {
  const byService = new Map(open.map((i) => [i.service, i]));
  const opened: Incident[] = [];
  const changed: Incident[] = [];
  const after: Incident[] = [];
  for (const [service, r] of results) {
    const current = byService.get(service);
    byService.delete(service);
    if (r.state !== 'down') {
      if (current) {
        const closed = { ...current, endedAt: at };
        changed.push(closed);
        after.push(closed);
      }
      continue;
    }
    if (current) {
      const extended: Incident = {
        ...current,
        lastAt: at,
        checks: current.checks + 1,
        error: current.error ?? r.error,
      };
      changed.push(extended);
      after.push(extended);
      continue;
    }
    const fresh: Incident = {
      id: null,
      service,
      startedAt: at,
      lastAt: at,
      endedAt: null,
      worst: 'down',
      checks: 1,
      error: r.error,
    };
    opened.push(fresh);
    after.push(fresh);
  }
  // Open incidents of services not checked this run stay open, untouched.
  after.push(...byService.values());
  return { opened, changed, after };
}
