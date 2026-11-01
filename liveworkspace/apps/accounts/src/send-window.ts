// The send window (liveworkspace/docs/specs/003-accounts/accounts.md "The send window"): the emails that can wait go
// only on weekdays between 09:00 and 21:00 in the recipient's own time zone, so nobody is woken by a tip at 4am.
// SQLite knows no time zones, so each run works out here which zones are inside the window at that instant and the
// due queries keep to those, with one JSON list bound (windowFilter).

// Monday to Friday, 09:00 (inside) to 21:00 (outside), in the recipient's zone.
export type SendWindow = {
  // Weekdays inside the window, 0 for Sunday to 6 for Saturday.
  days: ReadonlySet<number>;
  // Minutes after local midnight: start is inside, end is not.
  start: number;
  end: number;
  // The zone of a recipient whose zone isn't known.
  zone: string;
};

export const DEFAULT_TIME_ZONE = 'Europe/London';
export const SEND_WINDOW: SendWindow = {
  days: new Set([1, 2, 3, 4, 5]),
  start: 9 * 60,
  end: 21 * 60,
  zone: DEFAULT_TIME_ZONE,
};
// The longest zone name kept: the longest IANA name is about 30 characters.
export const MAX_TIME_ZONE_LENGTH = 64;
// The header liveworkspace.app's pages send the browser's zone in, on their session reads.
export const TIME_ZONE_HEADER = 'X-Time-Zone';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

let known: ReadonlySet<string> | null = null;

// Every zone the runtime knows (its own names for them), and UTC, which the list leaves out.
export function knownTimeZones(): ReadonlySet<string> {
  known ??= new Set([...Intl.supportedValuesOf('timeZone'), 'UTC']);
  return known;
}

// One formatter per zone for the isolate's life: at most the known list, about 420.
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(zone: string): Intl.DateTimeFormat {
  let format = formatters.get(zone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(zone, format);
  }
  return format;
}

/** An IANA zone name as the runtime keeps it, or null for anything that isn't one it knows. */
export function parseTimeZone(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_TIME_ZONE_LENGTH) {
    return null;
  }
  let resolved: string;
  try {
    resolved = new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
  // The runtime's own name, so an alias and its zone are kept as one (`Asia/Calcutta`, `Asia/Kolkata`); a name only
  // the list has as given is kept as given; one that is in neither is refused, as no sweep could ever match it.
  const zones = knownTimeZones();
  if (zones.has(resolved)) return resolved;
  return zones.has(value) ? value : null;
}

/** Whether the instant `now` is inside the window in `zone` (a known zone). */
export function insideWindow(window: SendWindow, zone: string, now: number): boolean {
  let day = -1;
  let minutes = 0;
  for (const part of formatterFor(zone).formatToParts(now)) {
    if (part.type === 'weekday') day = DAY_NAMES.indexOf(part.value as (typeof DAY_NAMES)[number]);
    else if (part.type === 'hour') minutes += Number(part.value) * 60;
    else if (part.type === 'minute') minutes += Number(part.value);
  }
  return window.days.has(day) && minutes >= window.start && minutes < window.end;
}

const WINDOW_SPEC =
  /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)-(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (\d\d):00-(\d\d):00$/;

/**
 * The window a self-hosted deployment sets: `<Day>-<Day> HH:00-HH:00` (the day range may wrap, as `Sun-Thu`), or
 * `always` for none (null). Unset is the default; anything that won't parse is the default too, warned.
 */
export function parseSendWindow(
  spec: string | undefined,
  zone: string | undefined,
): SendWindow | null {
  const defaultZone = zone === undefined ? DEFAULT_TIME_ZONE : parseTimeZone(zone);
  if (defaultZone === null)
    console.warn('[email] EMAIL_DEFAULT_TIME_ZONE is not a time zone; using the default');
  const base = { ...SEND_WINDOW, zone: defaultZone ?? DEFAULT_TIME_ZONE };
  if (spec === undefined) return base;
  if (spec.trim() === 'always') return null;
  const match = WINDOW_SPEC.exec(spec.trim());
  const from = match ? DAY_NAMES.indexOf(match[1] as (typeof DAY_NAMES)[number]) : -1;
  const to = match ? DAY_NAMES.indexOf(match[2] as (typeof DAY_NAMES)[number]) : -1;
  const start = Number(match?.[3]) * 60;
  const end = Number(match?.[4]) * 60;
  if (!match || !(start < end) || end > 24 * 60) {
    console.warn('[email] EMAIL_SEND_WINDOW does not parse; using the default');
    return base;
  }
  const days = new Set<number>();
  for (let day = from; ; day = (day + 1) % 7) {
    days.add(day);
    if (day === to) break;
  }
  return { ...base, days, start, end };
}

export type SendWindowEnv = { EMAIL_SEND_WINDOW?: string; EMAIL_DEFAULT_TIME_ZONE?: string };

const windows = new Map<string, SendWindow | null>();

/** The deployment's window, parsed once per isolate for each pair of values. */
export function sendWindowOf(env: SendWindowEnv): SendWindow | null {
  const key = `${env.EMAIL_SEND_WINDOW ?? ''}\n${env.EMAIL_DEFAULT_TIME_ZONE ?? ''}`;
  if (!windows.has(key)) {
    windows.set(key, parseSendWindow(env.EMAIL_SEND_WINDOW, env.EMAIL_DEFAULT_TIME_ZONE));
  }
  return windows.get(key) ?? null;
}

// A due query's part of the window: `sql` goes into its WHERE (one `?`), `bind` is that `?`'s value.
export type WindowFilter = { sql: string; bind: string };

/**
 * The window as one WHERE fragment on `column` (a recipient's stored zone), for `now`. `null` when there is no
 * window (send at any hour); 'closed' when no zone is inside it, so the query needn't run. While the default zone
 * is inside, the fragment names the zones outside instead, so a recipient with no zone, or one the runtime no
 * longer knows, is kept.
 */
export function windowFilter(
  column: string,
  window: SendWindow | null,
  now: number,
): WindowFilter | null | 'closed' {
  if (!window) return null;
  const zones = zonesAt(window, now);
  if (zones.inside === '[]') return 'closed';
  return zones.defaultInside
    ? {
        sql: `(${column} IS NULL OR ${column} NOT IN (SELECT value FROM json_each(?)))`,
        bind: zones.outside,
      }
    : { sql: `${column} IN (SELECT value FROM json_each(?))`, bind: zones.inside };
}

type Zones = { inside: string; outside: string; defaultInside: boolean };
// The last instant's split, so a run's several due queries (each stage, each sweep) work it out once.
let last: { window: SendWindow; now: number; zones: Zones } | null = null;

function zonesAt(window: SendWindow, now: number): Zones {
  if (last && last.window === window && last.now === now) return last.zones;
  const inside: string[] = [];
  const outside: string[] = [];
  for (const zone of knownTimeZones()) {
    (insideWindow(window, zone, now) ? inside : outside).push(zone);
  }
  const zones = {
    inside: JSON.stringify(inside),
    outside: JSON.stringify(outside),
    defaultInside: insideWindow(window, window.zone, now),
  };
  last = { window, now, zones };
  return zones;
}
