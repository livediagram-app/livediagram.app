// The status page's stored history (liveworkspace/docs/site.md "Status", liveworkspace/docs/status.md): one read of
// the status Worker's `/api/status/history`, and what the page makes of it. Pure apart from `loadHistory`, which takes
// its fetch, so tests drive it.

import {
  addDays,
  type CheckState,
  dayStart,
  dayUptime,
  type IncidentEntry,
  parseStatusHistory,
  STATE_OF_LETTER,
  type StateLetter,
  STATUS_API_PATH,
  STATUS_HISTORY_PATH,
  type StatusHistory,
} from '@liveworkspace/status';

// The data changes once an hour; reading it every 5 minutes while the page is visible keeps "23 min ago" honest
// without asking for more than there is.
export const HISTORY_REFRESH_MS = 5 * 60_000;

const DAY_MS = 86_400_000;

/** The stored history, or null when there is none to show: no Worker behind the path (a dev server without it, an
 *  HTML 404), a network failure, or an answer of the wrong shape. Never throws. */
export async function loadHistory(fetchImpl: typeof fetch): Promise<StatusHistory | null> {
  try {
    const res = await fetchImpl(`${STATUS_API_PATH}${STATUS_HISTORY_PATH}`, {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok || !/\bjson\b/i.test(res.headers.get('Content-Type') ?? '')) return null;
    return parseStatusHistory(await res.json());
  } catch {
    return null;
  }
}

/** Whether a history has anything to show: at least one run. */
export function hasRuns(history: StatusHistory | null): history is StatusHistory & { at: number } {
  return history !== null && history.at !== null;
}

export function stateOfLetter(letter: string): CheckState | null {
  return letter in STATE_OF_LETTER ? STATE_OF_LETTER[letter as StateLetter] : null;
}

/** Each service's incidents, newest first. */
export function incidentsByService(history: StatusHistory): Map<string, IncidentEntry[]> {
  const out = new Map<string, IncidentEntry[]>();
  for (const i of history.incidents) {
    const list = out.get(i[0]) ?? [];
    list.push(i);
    out.set(i[0], list);
  }
  return out;
}

export type DayView = {
  day: string;
  // Percent, or null for a day without checks.
  uptime: number | null;
  worst: CheckState | null;
  // The service's incidents that touched the day.
  incidents: IncidentEntry[];
};

/** One bar of a service's strip: day `index` of the window. */
export function dayView(
  history: StatusHistory,
  serviceId: string,
  index: number,
  incidents: readonly IncidentEntry[],
): DayView {
  const s = history.services[serviceId];
  const day = addDays(history.from, index);
  const start = dayStart(day);
  const end = start + DAY_MS;
  const tenths = s ? dayUptime(s, index) : null;
  return {
    day,
    uptime: tenths === null ? null : tenths / 10,
    worst: s ? stateOfLetter(s.w[index] ?? '-') : null,
    incidents: incidents.filter(
      ([, started, ended]) => started < end && (ended ?? history.at ?? started) >= start,
    ),
  };
}

const DAY_FORMAT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const LONG_DAY_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

/** "Sat 25 Oct" (the UTC day the bar counts). */
export function formatDay(day: string): string {
  return DAY_FORMAT.format(dayStart(day));
}

/** "99.98%", "100%", "87.5%". */
export function formatUptime(percent: number): string {
  return `${Number(percent.toFixed(2))}%`;
}

/** "45 min", "2 h 5 min", "3 d 4 h". */
export function formatDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  return hours % 24 ? `${days} d ${hours % 24} h` : `${days} d`;
}

/** The strip in words, for assistive tech: "99.98% up over 90 days; 2 days with incidents, the last on 12 October." */
export function stripSummary(history: StatusHistory, serviceId: string): string {
  const s = history.services[serviceId];
  if (!s || s.p === null) return `No checks stored for the last ${history.days} days yet.`;
  const bad: number[] = [];
  // Down days only: a slow hour is no incident (liveworkspace/docs/status.md), so a slow day isn't counted as one.
  for (let i = 0; i < s.w.length; i++) if (s.w[i] === 'd') bad.push(i);
  const head = `${formatUptime(s.p)} up over ${history.days} days`;
  if (bad.length === 0) return `${head}; every day with checks fully up.`;
  const last = LONG_DAY_FORMAT.format(dayStart(addDays(history.from, bad.at(-1)!)));
  return `${head}; ${bad.length} ${bad.length === 1 ? 'day' : 'days'} with incidents, the last on ${last}.`;
}
