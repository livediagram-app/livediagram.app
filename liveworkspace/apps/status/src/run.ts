// One hourly run (liveworkspace/docs/specs/009-status/status.md "The hourly run"): check every service, then one D1 read batch (today's
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
  type ServiceGroup,
  statusGroups,
  workerServices,
} from '@liveworkspace/status';
import { RETENTION_DAYS, SIGNED_IN_LOOKBACK_MS } from './config';
import type { Env } from './env';
import { environmentOfWorker } from './environment';
import { type Incident, type PreviousCheck, stepIncidents } from './incidents';
import { type Clock, type Fetch, probeAll, type ProbeTarget } from './probe';
import { type DayCheck, type DayRollup, rollupDay } from './rollup';
import { signedInTarget } from './signed-in';
import { buildHistory, buildLatest, type DailyRow } from './snapshot';

export { environmentOfWorker };

/** The services checked signed in this run: none without the secret, when each keeps its anonymous check. */
export function signedInServices(env: Env, groups: readonly ServiceGroup[]) {
  return env.STATUS_GUEST_COOKIE ? workerServices(groups) : [];
}

/** Every address one run checks, with the fetch that reaches it; a service checked signed in, signed in. */
export function probeTargets(env: Env, fetchImpl: Fetch, now?: Clock): ProbeTarget[] {
  const groups = statusGroups(environmentOfWorker(env));
  const signed = new Map(
    signedInServices(env, groups).map((s) => [s.id, signedInTarget(env, s, fetchImpl, now)]),
  );
  return probedServices(groups).map(
    (s) =>
      signed.get(s.id) ?? {
        id: s.id,
        probe: s.check.probe,
        url: resolveProbeUrl(s.check.probe, env.PLATFORM_ORIGIN),
        fetch: fetchImpl,
      },
  );
}

/** How many checks an hour each signed-in service gets, for the pooled uptimes (buildHistory's `perHour`). */
export const perHourOf = (services: ReturnType<typeof signedInServices>) =>
  new Map(services.map((s) => [s.id, 60 / s.worker.everyMinutes]));

// A service's check before `at`, within SIGNED_IN_LOOKBACK_MS: `checks`' key leads with `at`, so it is one short range.
export const PREVIOUS_CHECK_SQL =
  'SELECT at, state, error FROM checks WHERE at >= ? AND at < ? AND service = ? ORDER BY at DESC LIMIT 1';

export const previousCheckOf = (r: D1Result | undefined): PreviousCheck | null =>
  ((r?.results ?? [])[0] as PreviousCheck | undefined) ?? null;

export type RunReport = {
  at: number;
  checked: number;
  up: number;
  slow: number;
  down: number;
  opened: number;
  closed: number;
  // From D1's own counts, for the logs (docs/specs/009-status/status.md "Performance").
  rowsRead: number;
  rowsWritten: number;
  // Whether the Explorer index was checked signed in, or anonymously for want of the secret.
  signedIn: 'checked' | 'no_secret';
};

export type IncidentRow = {
  id: number;
  service: string;
  started_at: number;
  last_at: number;
  ended_at: number | null;
  worst: 'down';
  checks: number;
  error: CheckError | null;
};

export const toIncident = (r: IncidentRow): Incident => ({
  id: r.id,
  service: r.service,
  startedAt: r.started_at,
  lastAt: r.last_at,
  endedAt: r.ended_at,
  worst: r.worst,
  checks: r.checks,
  error: r.error,
});

export const INCIDENT_COLUMNS = 'id, service, started_at, last_at, ended_at, worst, checks, error';

export const INSERT_CHECK_SQL =
  'INSERT OR REPLACE INTO checks (at, service, state, code, ms, error) VALUES (?, ?, ?, ?, ?, ?)';
export const UPSERT_DAY_SQL = `INSERT INTO daily (day, service, checks, up, slow, down, p50, p95, worst) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (day, service) DO UPDATE SET checks = excluded.checks, up = excluded.up, slow = excluded.slow,
     down = excluded.down, p50 = excluded.p50, p95 = excluded.p95, worst = excluded.worst`;
export const INSERT_INCIDENT_SQL =
  'INSERT INTO incidents (service, started_at, last_at, ended_at, worst, checks, error) VALUES (?, ?, ?, ?, ?, ?, ?)';
export const UPDATE_INCIDENT_SQL =
  'UPDATE incidents SET last_at = ?, ended_at = ?, worst = ?, checks = ?, error = ? WHERE id = ?';
/** D1's own count of rows read or written over a batch's results, for the logs. */
export const metaSum = (list: D1Result[], key: 'rows_read' | 'rows_written') =>
  list.reduce((n, r) => n + (Number((r.meta as Record<string, unknown>)?.[key]) || 0), 0);

export const PUT_SNAPSHOT_SQL = 'INSERT OR REPLACE INTO snapshots (key, at, body) VALUES (?, ?, ?)';

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
  const signedIn = signedInServices(env, groups);
  const probed =
    options.results ??
    (await probeAll(
      probeTargets(env, options.fetch ?? ((r) => fetch(r)), options.now),
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

  const [todayChecks, openRows, dailyRows, closedRows, ...previousRows] = await db.batch([
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
    // The signed-in check's previous one, for its second-down-in-a-row rule.
    ...signedIn.map((s) =>
      db.prepare(PREVIOUS_CHECK_SQL).bind(at - SIGNED_IN_LOOKBACK_MS, at, s.id),
    ),
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
  const confirm = new Map(signedIn.map((s, i) => [s.id, previousCheckOf(previousRows[i])]));
  const step = stepIncidents(open, results, at, new Set(services.map((s) => s.id)), confirm);
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
    perHour: perHourOf(signedIn),
  });

  const insertCheck = db.prepare(INSERT_CHECK_SQL);
  const upsertDay = db.prepare(UPSERT_DAY_SQL);
  const insertIncident = db.prepare(INSERT_INCIDENT_SQL);
  const updateIncident = db.prepare(UPDATE_INCIDENT_SQL);
  const putSnapshot = db.prepare(PUT_SNAPSHOT_SQL);
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
  const sum = metaSum;
  return {
    at,
    checked: results.size,
    up: count('up'),
    slow: count('slow'),
    down: count('down'),
    opened: step.opened.length,
    closed: step.changed.filter((i) => i.endedAt !== null).length,
    rowsRead:
      sum([todayChecks!, openRows!, dailyRows!, closedRows!, ...previousRows], 'rows_read') +
      sum(written, 'rows_read'),
    rowsWritten: sum(written, 'rows_written'),
    signedIn: env.STATUS_GUEST_COOKIE ? 'checked' : 'no_secret',
  };
}
