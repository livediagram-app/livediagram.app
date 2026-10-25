// Made-up history for the local database only (liveworkspace/docs/status.md "Running it locally"): 90 days of hourly
// checks for every service, with a few slow and down spells, rolled up, turned into incidents and snapshotted by the
// Worker's own code, so the page has something real-looking to show. Not part of the Worker: `seed:local` bundles it
// on its own, writes SQL and runs it with `wrangler d1 execute --local`. It never touches a remote database.
//
//   corepack pnpm seed:local

import { writeFileSync } from 'node:fs';
import {
  addDays,
  allServices,
  type CheckResult,
  dayOf,
  dayStart,
  deriveResults,
  HISTORY_DAYS,
  probedServices,
  statusGroups,
} from '@liveworkspace/status';
import { type Incident, stepIncidents } from '../src/incidents';
import { type DayCheck, rollupDay } from '../src/rollup';
import { buildHistory, buildLatest, type DailyRow } from '../src/snapshot';

const HOUR = 3_600_000;

// A small seeded generator, so every seed looks the same.
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

// Planned spells, `daysAgo` before the last run, at an hour of that day: [service, daysAgo, hour, hours, state].
const SPELLS: ReadonlyArray<[string, number, number, number, 'slow' | 'down']> = [
  ['livediagram:api', 37, 14, 2, 'down'],
  ['liveplanner:mcp', 12, 3, 5, 'down'],
  ['liveworkspace:community', 4, 18, 3, 'slow'],
  ['livedesign:editor', 61, 9, 1, 'down'],
  ['livedocuments:help', 22, 11, 2, 'slow'],
  ['liveworkspace:accounts', 1, 6, 1, 'down'],
];

function baseMs(id: string): number {
  if (id.endsWith(':mcp')) return 210;
  if (id.endsWith(':api')) return 140;
  if (id.startsWith('liveworkspace:')) return 70;
  return 45;
}

export function seed(last: number): string {
  const groups = statusGroups('development');
  const services = allServices(groups);
  const probed = probedServices(groups).map((s) => s.id);
  const today = dayOf(last);
  const from = addDays(today, -(HISTORY_DAYS - 1));
  const rand = random(20261025);

  const spell = new Map<string, 'slow' | 'down'>();
  for (const [id, daysAgo, hour, hours, state] of SPELLS)
    for (let h = 0; h < hours; h++)
      spell.set(
        `${id}@${dayStart(addDays(today, -daysAgo)) + (hour + h) * HOUR + 7 * 60_000}`,
        state,
      );

  const checks: string[] = [];
  const days = new Map<string, DayCheck[]>();
  let open: Incident[] = [];
  const closed: Incident[] = [];
  let latest = new Map<string, CheckResult>();

  for (let at = dayStart(from) + 7 * 60_000; at <= last; at += HOUR) {
    const results = new Map<string, CheckResult>();
    for (const id of probed) {
      const planned = spell.get(`${id}@${at}`);
      const jitter = Math.exp((rand() - 0.5) * 0.8);
      const ms = Math.round(baseMs(id) * jitter);
      const r: CheckResult =
        planned === 'down'
          ? { state: 'down', code: null, ms: 10_000, error: 'timeout' }
          : planned === 'slow' || rand() < 0.0002
            ? { state: 'slow', code: 200, ms: 1600 + Math.round(rand() * 1400), error: null }
            : { state: 'up', code: id === 'liveworkspace:media' ? 404 : 200, ms, error: null };
      results.set(id, r);
    }
    for (const [id, r] of deriveResults(services, results)) results.set(id, r);
    const ordered = new Map(
      services.flatMap((s) => (results.has(s.id) ? [[s.id, results.get(s.id)!] as const] : [])),
    );

    const day = dayOf(at);
    for (const [id, r] of ordered) {
      checks.push(
        `(${at}, '${id}', '${r.state}', ${r.code ?? 'NULL'}, ${r.ms}, ${r.error ? `'${r.error}'` : 'NULL'})`,
      );
      const key = `${day}|${id}`;
      const list = days.get(key) ?? [];
      list.push({ state: r.state, ms: r.ms });
      days.set(key, list);
    }
    const step = stepIncidents(open, ordered, at);
    open = step.after.filter((i) => i.endedAt === null);
    closed.push(...step.after.filter((i) => i.endedAt !== null));
    latest = ordered;
  }

  const daily: Array<DailyRow & { p50: number | null; p95: number | null }> = [];
  for (const [key, list] of days) {
    const [day, service] = key.split('|') as [string, string];
    daily.push({ day, service, ...rollupDay(list) });
  }
  const incidents = [...closed, ...open];
  const latestBody = buildLatest(last, latest);
  const history = buildHistory({
    at: last,
    today,
    days: HISTORY_DAYS,
    serviceIds: [...latest.keys()],
    daily,
    incidents,
    latest: latestBody,
  });

  const q = (s: string) => `'${s.replaceAll("'", "''")}'`;
  const sql: string[] = [
    'DELETE FROM checks;',
    'DELETE FROM daily;',
    'DELETE FROM incidents;',
    'DELETE FROM snapshots;',
  ];
  for (let i = 0; i < checks.length; i += 400)
    sql.push(
      `INSERT INTO checks (at, service, state, code, ms, error) VALUES ${checks.slice(i, i + 400).join(', ')};`,
    );
  for (let i = 0; i < daily.length; i += 200)
    sql.push(
      `INSERT INTO daily (day, service, checks, up, slow, down, p50, p95, worst) VALUES ${daily
        .slice(i, i + 200)
        .map(
          (d) =>
            `(${q(d.day)}, ${q(d.service)}, ${d.checks}, ${d.up}, ${d.slow}, ${d.down}, ${d.p50 ?? 'NULL'}, ${d.p95 ?? 'NULL'}, ${q(d.worst)})`,
        )
        .join(', ')};`,
    );
  for (const i of incidents)
    sql.push(
      `INSERT INTO incidents (service, started_at, last_at, ended_at, worst, checks, error) VALUES (${q(i.service)}, ${i.startedAt}, ${i.lastAt}, ${i.endedAt ?? 'NULL'}, ${q(i.worst)}, ${i.checks}, ${i.error ? q(i.error) : 'NULL'});`,
    );
  sql.push(
    `INSERT INTO snapshots (key, at, body) VALUES ('latest', ${last}, ${q(JSON.stringify(latestBody))});`,
  );
  sql.push(
    `INSERT INTO snapshots (key, at, body) VALUES ('history', ${last}, ${q(JSON.stringify(history))});`,
  );
  return `${sql.join('\n')}\n`;
}

// The last run: this hour's at minute 7, or the hour before when it isn't 7 past yet.
const now = Date.now();
const thisHour = Math.floor(now / HOUR) * HOUR + 7 * 60_000;
// Read through globalThis: this folder's types are the Worker's, where Node's process isn't declared.
const out = (globalThis as { process?: { argv?: string[] } }).process?.argv?.[2];
if (out) {
  writeFileSync(out, seed(thisHour <= now ? thisHour : thisHour - HOUR));
  console.log(`seed: wrote ${out}`);
}
