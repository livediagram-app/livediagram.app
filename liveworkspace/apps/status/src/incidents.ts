// Incidents (liveworkspace/docs/status.md "The hourly run"): a run of consecutive checks of one service that weren't
// up, from its first check to the first up check after it. Each run opens, extends or closes them. Pure.

import { type CheckError, type CheckResult, worse } from '@liveworkspace/status';

export type Incident = {
  // The row's id, or null for one this run opens.
  id: number | null;
  service: string;
  startedAt: number;
  // The last check that wasn't up.
  lastAt: number;
  // The first up check after it; null while open.
  endedAt: number | null;
  worst: 'slow' | 'down';
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
    if (r.state === 'up') {
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
        worst: worse(current.worst, r.state) as Incident['worst'],
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
      worst: r.state,
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
