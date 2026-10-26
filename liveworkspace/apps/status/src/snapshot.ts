// The read API's two answers (liveworkspace/docs/specs/009-status/status.md "The read API"), built once a run from what it stored, so
// a read is one row. Pure.

import {
  addDays,
  type CheckResult,
  dayStart,
  type IncidentEntry,
  INCIDENTS_MAX,
  LETTER,
  type LatestEntry,
  type ServiceHistory,
  type StatusHistory,
  type StatusLatest,
} from '@liveworkspace/status';
import type { Incident } from './incidents';
import { uptimeTenths } from './rollup';

export type DailyRow = {
  day: string;
  service: string;
  checks: number;
  up: number;
  slow: number;
  down: number;
  worst: 'up' | 'slow' | 'down';
};

export function latestEntry(r: CheckResult): LatestEntry {
  return r.error ? [LETTER[r.state], r.code, r.ms, r.error] : [LETTER[r.state], r.code, r.ms];
}

/** `/api/status`: this run's result for every service checked, in page order. */
export function buildLatest(at: number, results: ReadonlyMap<string, CheckResult>): StatusLatest {
  const services: Record<string, LatestEntry> = {};
  for (const [id, r] of results) services[id] = latestEntry(r);
  return { v: 1, at, services };
}

/** `/api/status/history`: each service's bar per day over the `days` up to `today`, its uptime over them, and the
 *  incidents that touch them, newest first. Every service in `serviceIds` gets its bars, with or without checks. */
export function buildHistory(input: {
  at: number;
  today: string;
  days: number;
  serviceIds: readonly string[];
  daily: readonly DailyRow[];
  incidents: readonly Incident[];
  latest: StatusLatest;
}): StatusHistory {
  const { at, today, days, serviceIds, daily, incidents, latest } = input;
  const from = addDays(today, -(days - 1));
  const index = new Map<string, number>();
  for (let i = 0; i < days; i++) index.set(addDays(from, i), i);

  const services: Record<string, ServiceHistory> = {};
  const totals = new Map<string, { checks: number; answered: number }>();
  for (const id of serviceIds) {
    services[id] = { p: null, w: '-'.repeat(days), u: [] };
    totals.set(id, { checks: 0, answered: 0 });
  }
  const worst: Record<string, string[]> = Object.fromEntries(
    serviceIds.map((id) => [id, Array.from({ length: days }, () => '-')]),
  );
  for (const row of daily) {
    const i = index.get(row.day);
    const s = services[row.service];
    if (i === undefined || !s || row.checks === 0) continue;
    const tenths = uptimeTenths(row);
    if (tenths !== null && tenths < 1000) s.u.push([i, tenths]);
    worst[row.service]![i] = LETTER[row.worst];
    const t = totals.get(row.service)!;
    t.checks += row.checks;
    t.answered += row.up + row.slow;
  }
  for (const id of serviceIds) {
    const t = totals.get(id)!;
    services[id]!.w = worst[id]!.join('');
    services[id]!.u.sort((a, b) => a[0] - b[0]);
    services[id]!.p = t.checks === 0 ? null : Math.round((t.answered * 10_000) / t.checks) / 100;
  }

  const since = dayStart(from);
  const entries: IncidentEntry[] = incidents
    .filter((i) => i.endedAt === null || i.endedAt >= since)
    .toSorted((a, b) => b.startedAt - a.startedAt)
    .slice(0, INCIDENTS_MAX)
    .map((i) => [i.service, i.startedAt, i.endedAt, LETTER[i.worst], i.checks, i.error]);

  return { v: 1, at, from, days, latest: latest.services, services, incidents: entries };
}
