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
  poolUptime,
  type ServiceHistory,
  type StatusHistory,
  type StatusLatest,
  uptimePercent,
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

const incidentEntry = (i: Incident): IncidentEntry => [
  i.service,
  i.startedAt,
  i.endedAt,
  LETTER[i.worst],
  i.checks,
  i.error,
];

export function latestEntry(r: CheckResult): LatestEntry {
  return r.error ? [LETTER[r.state], r.code, r.ms, r.error] : [LETTER[r.state], r.code, r.ms];
}

/** `/api/status`: this run's result for every service checked, in page order. */
export function buildLatest(at: number, results: ReadonlyMap<string, CheckResult>): StatusLatest {
  const services: Record<string, LatestEntry> = {};
  for (const [id, r] of results) services[id] = latestEntry(r);
  return { v: 1, at, services };
}

/** `/api/status/history`: each service's bar per day over the `days` up to `today`, its uptime over them, each
 *  group's and the page's (pooled over their services' checks), and the incidents that touch them, newest first. Every service in `serviceIds` gets its bars, with or without checks.
 *  `perHour`: how many checks an hour a service gets where it isn't one (the signed-in check's 12); in the pooled
 *  uptimes each of its checks counts as that fraction, so it weighs as an hourly service does. */
export function buildHistory(input: {
  at: number;
  today: string;
  days: number;
  serviceIds: readonly string[];
  daily: readonly DailyRow[];
  incidents: readonly Incident[];
  latest: StatusLatest;
  perHour?: ReadonlyMap<string, number>;
}): StatusHistory {
  const { at, today, days, serviceIds, daily, incidents, latest, perHour } = input;
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
    services[id]!.p = uptimePercent(t.answered, t.checks);
  }
  const uptime = poolUptime(
    [...totals].map(([id, t]) => {
      const n = perHour?.get(id) ?? 1;
      return [id, { checks: t.checks / n, answered: t.answered / n }] as const;
    }),
  );

  const since = dayStart(from);
  // Only the listed services': a retired one's incidents would take a place of the INCIDENTS_MAX for nothing.
  const listed = new Set(serviceIds);
  const entries: IncidentEntry[] = incidents
    .filter((i) => listed.has(i.service) && (i.endedAt === null || i.endedAt >= since))
    .toSorted((a, b) => b.startedAt - a.startedAt)
    .slice(0, INCIDENTS_MAX)
    .map(incidentEntry);

  return { v: 1, at, from, days, latest: latest.services, services, uptime, incidents: entries };
}

/** `/api/status` with one service's newest check in it, for the 5-minute run. `at` stays the hourly run's. */
export function patchLatest(latest: StatusLatest, service: string, r: CheckResult): StatusLatest {
  return { ...latest, services: { ...latest.services, [service]: latestEntry(r) } };
}

/** `/api/status/history` with one service's 5-minute run in it: its newest check, today's bar (when the stored window
 *  ends today; after midnight the hourly run starts the new day) and its incidents. The uptimes, the earlier days and
 *  `at` stay the hourly run's. `after` is the service's incidents open after this run, or closed by it. */
export function patchHistory(
  history: StatusHistory,
  input: {
    today: string;
    service: string;
    result: CheckResult;
    day: DailyRow;
    after: readonly Incident[];
  },
): StatusHistory {
  const { today, service, result, day, after } = input;
  const latest = { ...history.latest, [service]: latestEntry(result) };
  const services = { ...history.services };
  const s = services[service];
  const last = history.days - 1;
  if (s && addDays(history.from, last) === today) {
    const tenths = uptimeTenths(day);
    const u = s.u.filter(([i]) => i !== last);
    if (tenths !== null && tenths < 1000) u.push([last, tenths]);
    services[service] = { ...s, w: s.w.slice(0, last) + LETTER[day.worst], u };
  }
  const restated = new Set(after.map((i) => i.startedAt));
  const incidents = [
    ...history.incidents.filter(
      ([id, started, ended]) => id !== service || (ended !== null && !restated.has(started)),
    ),
    ...after.map(incidentEntry),
  ]
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, INCIDENTS_MAX);
  return { ...history, latest, services, incidents };
}
