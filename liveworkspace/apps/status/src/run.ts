// One hourly run (liveworkspace/docs/status.md "The hourly run"): check every service, then one D1 read batch (today's
// checks so far, the open incidents, the window's days and closed incidents) and one write batch (this run's checks,
// today's rollups, the incidents it changed, the prune and the two snapshots).

import {
  allServices,
  addDays,
  type CheckError,
  type CheckResult,
  dayOf,
  dayStart,
  deriveResults,
  HISTORY_DAYS,
  probedServices,
  resolveProbeUrl,
  type StatusEnvironment,
  statusGroups,
} from '@liveworkspace/status';
import { STAND_INS } from '@liveworkspace/sites';
import { RETENTION_DAYS } from './config';
import type { Env } from './env';
import { type Incident, stepIncidents } from './incidents';
import { type Clock, type Fetch, probeAll, type ProbeTarget } from './probe';
import { type DayCheck, type DayRollup, rollupDay } from './rollup';
import { buildHistory, buildLatest, type DailyRow } from './snapshot';

export function environmentOfWorker(env: Env): StatusEnvironment {
  return env.ENVIRONMENT === 'staging' || env.ENVIRONMENT === 'development'
    ? env.ENVIRONMENT
    : 'production';
}

// liveworkspace.app's own services go through the gateway's binding, where there is one (a Worker can't fetch another
// Worker's workers.dev address on the same account); in development, and everything else, a plain fetch.
function platformFetch(env: Env, fetchImpl: Fetch): Fetch {
  const binding = env.PLATFORM;
  if (!binding || environmentOfWorker(env) === 'development') return fetchImpl;
  return (request) => binding.fetch(request);
}

// The workers.dev stand-ins on this account (STAND_INS), each origin with the binding that reaches it.
function standInFetches(env: Env): Map<string, Fetch> {
  const bound = new Map<string, Fetch>();
  if (environmentOfWorker(env) === 'development') return bound;
  const add = (origin: string | undefined, binding: Fetcher | undefined) => {
    if (origin && binding) bound.set(origin, (request) => binding.fetch(request));
  };
  const livediagram = STAND_INS['livediagram.app'];
  add(livediagram?.production, env.LIVEDIAGRAM_ROUTER);
  add(livediagram?.staging, env.LIVEDIAGRAM_ROUTER);
  add(livediagram?.mcp, env.LIVEDIAGRAM_MCP);
  return bound;
}

/** Every address one run checks, with the fetch that reaches it. */
export function probeTargets(env: Env, fetchImpl: Fetch): ProbeTarget[] {
  const groups = statusGroups(environmentOfWorker(env));
  const platform = platformFetch(env, fetchImpl);
  const standIns = standInFetches(env);
  return probedServices(groups).map((s) => {
    const url = resolveProbeUrl(s.check.probe, env.PLATFORM_ORIGIN);
    return {
      id: s.id,
      probe: s.check.probe,
      url,
      fetch: s.check.probe.url.startsWith('/')
        ? platform
        : (standIns.get(new URL(url).origin) ?? fetchImpl),
    };
  });
}

export type RunReport = {
  at: number;
  checked: number;
  up: number;
  slow: number;
  down: number;
  opened: number;
  closed: number;
  // From D1's own counts, for the logs (docs/status.md "Performance").
  rowsRead: number;
  rowsWritten: number;
};

type IncidentRow = {
  id: number;
  service: string;
  started_at: number;
  last_at: number;
  ended_at: number | null;
  worst: 'down';
  checks: number;
  error: CheckError | null;
};

const toIncident = (r: IncidentRow): Incident => ({
  id: r.id,
  service: r.service,
  startedAt: r.started_at,
  lastAt: r.last_at,
  endedAt: r.ended_at,
  worst: r.worst,
  checks: r.checks,
  error: r.error,
});

const INCIDENT_COLUMNS = 'id, service, started_at, last_at, ended_at, worst, checks, error';

/** Check every service now and store it. `results` hands in the checks (tests); otherwise they are made here. */
export async function runOnce(
  env: Env,
  at: number,
  options: {
    fetch?: Fetch;
    now?: Clock;
    timeoutMs?: number;
    results?: Map<string, CheckResult>;
  } = {},
): Promise<RunReport> {
  const db = env.STATUS_DB;
  const groups = statusGroups(environmentOfWorker(env));
  const services = allServices(groups);
  const probed =
    options.results ??
    (await probeAll(
      probeTargets(env, options.fetch ?? ((r) => fetch(r))),
      options.now,
      options.timeoutMs,
    ));
  const derived = deriveResults(services, probed);
  // Every stored service's result, in page order.
  const results = new Map<string, CheckResult>();
  for (const s of services) {
    const r = probed.get(s.id) ?? derived.get(s.id);
    if (r) results.set(s.id, r);
  }

  const today = dayOf(at);
  const from = addDays(today, -(HISTORY_DAYS - 1));
  const since = dayStart(from);

  const [todayChecks, openRows, dailyRows, closedRows] = await db.batch([
    db
      .prepare('SELECT service, state, ms FROM checks WHERE at >= ? AND at < ?')
      .bind(dayStart(today), at),
    db.prepare(`SELECT ${INCIDENT_COLUMNS} FROM incidents WHERE ended_at IS NULL`),
    db
      .prepare(
        'SELECT day, service, checks, up, slow, down, worst FROM daily WHERE day >= ? AND day < ?',
      )
      .bind(from, today),
    db
      .prepare(
        `SELECT ${INCIDENT_COLUMNS} FROM incidents WHERE ended_at >= ? ORDER BY started_at DESC LIMIT 50`,
      )
      .bind(since),
  ]);

  // Today's rollups: the day's earlier checks with this run's.
  const byService = new Map<string, DayCheck[]>();
  for (const row of (todayChecks!.results ?? []) as Array<{ service: string } & DayCheck>) {
    const list = byService.get(row.service) ?? [];
    list.push({ state: row.state, ms: row.ms });
    byService.set(row.service, list);
  }
  const todayRows: Array<DailyRow & DayRollup> = [...results].map(([service, r]) => ({
    day: today,
    service,
    ...rollupDay([...(byService.get(service) ?? []), { state: r.state, ms: r.ms }]),
  }));

  const open = ((openRows!.results ?? []) as IncidentRow[]).map(toIncident);
  const step = stepIncidents(open, results, at);
  const closed = ((closedRows!.results ?? []) as IncidentRow[]).map(toIncident);

  const latest = buildLatest(at, results);
  const history = buildHistory({
    at,
    today,
    days: HISTORY_DAYS,
    serviceIds: [...results.keys()],
    daily: [...((dailyRows!.results ?? []) as DailyRow[]), ...todayRows],
    incidents: [...closed, ...step.after],
    latest,
  });

  const insertCheck = db.prepare(
    'INSERT OR REPLACE INTO checks (at, service, state, code, ms, error) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const upsertDay = db.prepare(
    `INSERT INTO daily (day, service, checks, up, slow, down, p50, p95, worst) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (day, service) DO UPDATE SET checks = excluded.checks, up = excluded.up, slow = excluded.slow,
     down = excluded.down, p50 = excluded.p50, p95 = excluded.p95, worst = excluded.worst`,
  );
  const insertIncident = db.prepare(
    'INSERT INTO incidents (service, started_at, last_at, ended_at, worst, checks, error) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const updateIncident = db.prepare(
    'UPDATE incidents SET last_at = ?, ended_at = ?, worst = ?, checks = ?, error = ? WHERE id = ?',
  );
  const putSnapshot = db.prepare(
    'INSERT OR REPLACE INTO snapshots (key, at, body) VALUES (?, ?, ?)',
  );
  const writes: D1PreparedStatement[] = [
    ...[...results].map(([service, r]) =>
      insertCheck.bind(at, service, r.state, r.code, r.ms, r.error),
    ),
    ...todayRows.map((d) =>
      upsertDay.bind(d.day, d.service, d.checks, d.up, d.slow, d.down, d.p50, d.p95, d.worst),
    ),
    ...step.opened.map((i) =>
      insertIncident.bind(i.service, i.startedAt, i.lastAt, i.endedAt, i.worst, i.checks, i.error),
    ),
    ...step.changed.map((i) =>
      updateIncident.bind(i.lastAt, i.endedAt, i.worst, i.checks, i.error, i.id),
    ),
    // Past 90 days: checks by time, days by date, and incidents that closed before the window.
    db
      .prepare('DELETE FROM checks WHERE at < ?')
      .bind(dayStart(addDays(today, -(RETENTION_DAYS - 1)))),
    db.prepare('DELETE FROM daily WHERE day < ?').bind(addDays(today, -(RETENTION_DAYS - 1))),
    db.prepare('DELETE FROM incidents WHERE ended_at < ?').bind(since),
    putSnapshot.bind('latest', at, JSON.stringify(latest)),
    putSnapshot.bind('history', at, JSON.stringify(history)),
  ];
  const written = await db.batch(writes);

  const count = (state: CheckResult['state']) =>
    [...results.values()].filter((r) => r.state === state).length;
  const sum = (list: D1Result[], key: 'rows_read' | 'rows_written') =>
    list.reduce((n, r) => n + (Number((r.meta as Record<string, unknown>)?.[key]) || 0), 0);
  return {
    at,
    checked: results.size,
    up: count('up'),
    slow: count('slow'),
    down: count('down'),
    opened: step.opened.length,
    closed: step.changed.filter((i) => i.endedAt !== null).length,
    rowsRead:
      sum([todayChecks!, openRows!, dailyRows!, closedRows!], 'rows_read') +
      sum(written, 'rows_read'),
    rowsWritten: sum(written, 'rows_written'),
  };
}
