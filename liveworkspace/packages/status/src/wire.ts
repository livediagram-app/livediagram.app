// The status Worker's read API, as it goes over the wire (liveworkspace/docs/status.md "The read API"): compact on
// purpose, since the page reads every service's 90 days in one answer. The Worker builds these, the page reads them.

import type { CheckError, CheckState } from './judge';

// Where the Worker answers on liveworkspace.app, and its two reads under it.
export const STATUS_API_PATH = '/api/status';
export const STATUS_HISTORY_PATH = '/history';
// How many days are kept and shown, and how many incidents an answer lists at most.
export const HISTORY_DAYS = 90;
export const INCIDENTS_MAX = 50;

export type StateLetter = 'u' | 's' | 'd';

export const LETTER: Record<CheckState, StateLetter> = { up: 'u', slow: 's', down: 'd' };
export const STATE_OF_LETTER: Record<StateLetter, CheckState> = {
  u: 'up',
  s: 'slow',
  d: 'down',
};

// A service's latest check: [state, HTTP code or null, ms] and its error code when it was down.
export type LatestEntry =
  | [state: StateLetter, code: number | null, ms: number]
  | [state: StateLetter, code: number | null, ms: number, error: CheckError];

export type StatusLatest = {
  v: 1;
  // When the latest run began (epoch ms), or null before the first.
  at: number | null;
  services: Record<string, LatestEntry>;
};

export type ServiceHistory = {
  // Uptime over the window's days with checks, in percent to two places; null with none.
  p: number | null;
  // Each day's worst state as one letter, oldest first, `-` for a day without checks.
  w: string;
  // The days under 100%, as [day's index in the window, uptime in tenths of a percent]. Only a day with a down check
  // can be under (a slow answer is still an answer), so every other day with checks is 1000 and isn't sent.
  u: Array<[day: number, tenths: number]>;
};

/** A day's uptime in tenths of a percent (1000 is 100%), or null for a day without checks. */
export function dayUptime(s: ServiceHistory, index: number): number | null {
  const letter = s.w[index];
  if (letter === undefined || letter === '-') return null;
  for (const [i, tenths] of s.u) if (i === index) return tenths;
  return 1000;
}

// [service, started, ended (null while open), worst, checks it spanned, its first error].
export type IncidentEntry = [
  service: string,
  started: number,
  ended: number | null,
  worst: StateLetter,
  checks: number,
  error: CheckError | null,
];

export type StatusHistory = {
  v: 1;
  at: number | null;
  // The first day shown (UTC, YYYY-MM-DD), and how many.
  from: string;
  days: number;
  latest: Record<string, LatestEntry>;
  services: Record<string, ServiceHistory>;
  // Newest first.
  incidents: IncidentEntry[];
};

const DAY_MS = 86_400_000;

/** A time's UTC day, as YYYY-MM-DD. */
export function dayOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The start of a UTC day (epoch ms). */
export function dayStart(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

/** The day `n` days after `day` (n may be negative). */
export function addDays(day: string, n: number): string {
  return dayOf(dayStart(day) + n * DAY_MS);
}

/** The window's last `days` days: each service's bars and uptime over them, and the incidents that touch them. */
export function sliceHistory(history: StatusHistory, days: number): StatusHistory {
  const keep = Math.max(1, Math.min(history.days, Math.floor(days)));
  if (keep === history.days) return history;
  const drop = history.days - keep;
  const from = addDays(history.from, drop);
  const since = dayStart(from);
  const services: Record<string, ServiceHistory> = {};
  for (const [id, s] of Object.entries(history.services)) {
    const w = s.w.slice(drop);
    const u = s.u.flatMap(([i, t]): Array<[number, number]> => (i >= drop ? [[i - drop, t]] : []));
    services[id] = { p: meanUptime({ p: null, w, u }), w, u };
  }
  return {
    ...history,
    from,
    days: keep,
    services,
    incidents: history.incidents.filter(([, , ended]) => ended === null || ended >= since),
  };
}

// The uptime over the days with checks, unweighted by how many checks each day had (a sliced window has only the
// days' uptimes, and every full day has the same 24 checks).
function meanUptime(s: ServiceHistory): number | null {
  let days = 0;
  let sum = 0;
  for (let i = 0; i < s.w.length; i++) {
    const t = dayUptime(s, i);
    if (t === null) continue;
    days++;
    sum += t;
  }
  return days === 0 ? null : Math.round((sum / days) * 10) / 100;
}

const LETTERS = new Set(['u', 's', 'd']);

/** The history answer, or null when it isn't one (a site with no Worker behind /api/status answers its HTML 404). */
export function parseStatusHistory(body: unknown): StatusHistory | null {
  if (!body || typeof body !== 'object') return null;
  const h = body as Partial<StatusHistory>;
  if (h.v !== 1 || typeof h.from !== 'string' || typeof h.days !== 'number') return null;
  if (h.at !== null && typeof h.at !== 'number') return null;
  if (!h.services || typeof h.services !== 'object') return null;
  if (!h.latest || typeof h.latest !== 'object') return null;
  if (!Array.isArray(h.incidents)) return null;
  for (const s of Object.values(h.services))
    if (
      !s ||
      typeof s.w !== 'string' ||
      s.w.length !== h.days ||
      !Array.isArray(s.u) ||
      !s.u.every((d) => Array.isArray(d) && d.length === 2)
    )
      return null;
  for (const e of Object.values(h.latest))
    if (!Array.isArray(e) || !LETTERS.has(e[0])) return null;
  return h as StatusHistory;
}

/** An empty answer, for before the first run. */
export function emptyHistory(now: number, days = HISTORY_DAYS): StatusHistory {
  return {
    v: 1,
    at: null,
    from: addDays(dayOf(now), -(days - 1)),
    days,
    latest: {},
    services: {},
    incidents: [],
  };
}
