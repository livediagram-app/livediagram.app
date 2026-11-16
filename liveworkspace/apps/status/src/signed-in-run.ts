// The 5-minute run (liveworkspace/docs/specs/009-status/status.md "The signed-in check"): the signed-in Explorer check
// alone, between the hourly runs. One read batch (per service its open incident, its check before this one and today's
// `daily` row, then the two snapshots) and one write batch (the check, today's row, its incident, both snapshots
// patched). It never rebuilds the history from `daily`: the hourly run does, so this stays a few dozen rows.

import {
  type CheckResult,
  dayOf,
  parseStatusHistory,
  type StatusLatest,
  statusGroups,
} from '@liveworkspace/status';
import { SIGNED_IN_LOOKBACK_MS } from './config';
import type { Env } from './env';
import { environmentOfWorker } from './environment';
import { stepIncidents } from './incidents';
import { type Clock, type Fetch } from './probe';
import { addToDay, type DayRollup } from './rollup';
import {
  INCIDENT_COLUMNS,
  type IncidentRow,
  INSERT_CHECK_SQL,
  INSERT_INCIDENT_SQL,
  metaSum,
  PREVIOUS_CHECK_SQL,
  previousCheckOf,
  PUT_SNAPSHOT_SQL,
  signedInServices,
  toIncident,
  UPDATE_INCIDENT_SQL,
  UPSERT_DAY_SQL,
} from './run';
import { signedInTarget } from './signed-in';
import { type DailyRow, patchHistory, patchLatest } from './snapshot';

export type SignedInReport = {
  at: number;
  // Set when nothing was checked: the secret isn't there.
  skipped?: 'no_secret';
  checked: number;
  down: number;
  opened: number;
  closed: number;
  rowsRead: number;
  rowsWritten: number;
};

function parseLatest(body: string | undefined): StatusLatest | null {
  if (!body) return null;
  try {
    const latest = JSON.parse(body) as StatusLatest;
    return latest?.v === 1 && latest.services && typeof latest.services === 'object'
      ? latest
      : null;
  } catch {
    return null;
  }
}

function parseHistoryBody(body: string | undefined) {
  if (!body) return null;
  try {
    return parseStatusHistory(JSON.parse(body));
  } catch {
    return null;
  }
}

/** Check every signed-in service now and store it. `results` hands in the checks (tests). */
export async function runSignedIn(
  env: Env,
  at: number,
  options: { fetch?: Fetch; now?: Clock; results?: Map<string, CheckResult> } = {},
): Promise<SignedInReport> {
  const services = signedInServices(env, statusGroups(environmentOfWorker(env)));
  const empty = { at, checked: 0, down: 0, opened: 0, closed: 0, rowsRead: 0, rowsWritten: 0 };
  if (services.length === 0) return { ...empty, skipped: 'no_secret' };

  const fetchImpl = options.fetch ?? ((r: Request) => fetch(r));
  const results =
    options.results ??
    new Map(
      await Promise.all(
        services.map(
          async (s) =>
            [s.id, await signedInTarget(env, s, fetchImpl, options.now)!.run!()] as const,
        ),
      ),
    );

  const db = env.STATUS_DB;
  const today = dayOf(at);
  const reads = await db.batch([
    ...services.flatMap((s) => [
      db
        .prepare(`SELECT ${INCIDENT_COLUMNS} FROM incidents WHERE service = ? AND ended_at IS NULL`)
        .bind(s.id),
      db.prepare(PREVIOUS_CHECK_SQL).bind(at - SIGNED_IN_LOOKBACK_MS, at, s.id),
      db
        .prepare(
          'SELECT checks, up, slow, down, p50, p95, worst FROM daily WHERE day = ? AND service = ?',
        )
        .bind(today, s.id),
    ]),
    db.prepare("SELECT key, body FROM snapshots WHERE key IN ('latest', 'history')"),
  ]);
  const snapshotRows = (reads.at(-1)!.results ?? []) as Array<{ key: string; body: string }>;
  let latest = parseLatest(snapshotRows.find((r) => r.key === 'latest')?.body);
  let history = parseHistoryBody(snapshotRows.find((r) => r.key === 'history')?.body);

  const writes: D1PreparedStatement[] = [];
  let opened = 0;
  let closed = 0;
  services.forEach((s, i) => {
    const r = results.get(s.id)!;
    const [openRows, previousRows, dayRows] = reads.slice(i * 3, i * 3 + 3);
    const open = ((openRows!.results ?? []) as IncidentRow[]).map(toIncident);
    const step = stepIncidents(
      open,
      new Map([[s.id, r]]),
      at,
      undefined,
      new Map([[s.id, previousCheckOf(previousRows)]]),
    );
    const day: DailyRow & DayRollup = {
      day: today,
      service: s.id,
      ...addToDay(((dayRows!.results ?? [])[0] as DayRollup | undefined) ?? null, r),
    };
    writes.push(
      db.prepare(INSERT_CHECK_SQL).bind(at, s.id, r.state, r.code, r.ms, r.error),
      db
        .prepare(UPSERT_DAY_SQL)
        .bind(
          day.day,
          day.service,
          day.checks,
          day.up,
          day.slow,
          day.down,
          day.p50,
          day.p95,
          day.worst,
        ),
      ...step.opened.map((x) =>
        db
          .prepare(INSERT_INCIDENT_SQL)
          .bind(x.service, x.startedAt, x.lastAt, x.endedAt, x.worst, x.checks, x.error),
      ),
      ...step.changed.map((x) =>
        db.prepare(UPDATE_INCIDENT_SQL).bind(x.lastAt, x.endedAt, x.worst, x.checks, x.error, x.id),
      ),
    );
    opened += step.opened.length;
    closed += step.changed.filter((x) => x.endedAt !== null).length;
    if (latest) latest = patchLatest(latest, s.id, r);
    if (history)
      history = patchHistory(history, { today, service: s.id, result: r, day, after: step.after });
  });
  // Before the first hourly run there are no snapshots to patch: that run makes them.
  // Their `at` stays the hourly run's: "Checked by liveworkspace" is about the whole round.
  if (latest)
    writes.push(
      db.prepare(PUT_SNAPSHOT_SQL).bind('latest', latest.at ?? at, JSON.stringify(latest)),
    );
  if (history)
    writes.push(
      db.prepare(PUT_SNAPSHOT_SQL).bind('history', history.at ?? at, JSON.stringify(history)),
    );
  const written = await db.batch(writes);

  return {
    at,
    checked: results.size,
    down: [...results.values()].filter((r) => r.state === 'down').length,
    opened,
    closed,
    rowsRead: metaSum(reads, 'rows_read') + metaSum(written, 'rows_read'),
    rowsWritten: metaSum(written, 'rows_written'),
  };
}
