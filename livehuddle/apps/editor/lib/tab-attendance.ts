// What a tab's Attendance dialog shows of its visits (docs/specs/012-collaboration/tab-attendance.md "Where it
// shows"; blueprint "Presentation and UX"): the visits grouped by the reader's local day they started, newest first,
// and each one's times and length in words. Pure, so the dialog only lays it out.

import type { AttendanceVisit } from '@livehuddle/api-schema';

const CLOCK = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const DAY_WITH_YEAR = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export type AttendanceDay = { key: string; label: string; visits: AttendanceVisit[] };

// The local day a moment falls on, as a sortable key.
function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A day's heading: "Today", "Yesterday", else "Mon 9 Nov" (with the year when it is not this one). */
export function dayLabel(ms: number, now: number): string {
  const key = dayKey(ms);
  if (key === dayKey(now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === dayKey(yesterday.getTime())) return 'Yesterday';
  const sameYear = new Date(ms).getFullYear() === new Date(now).getFullYear();
  return (sameYear ? DAY : DAY_WITH_YEAR).format(ms).replace(',', '');
}

/** The visits by the day each started, in the order given (the route sends them newest first). */
export function groupVisitsByDay(visits: AttendanceVisit[], now: number): AttendanceDay[] {
  const days: AttendanceDay[] = [];
  for (const visit of visits) {
    const key = dayKey(visit.joinedAt);
    const last = days[days.length - 1];
    if (last?.key === key) last.visits.push(visit);
    else days.push({ key, label: dayLabel(visit.joinedAt, now), visits: [visit] });
  }
  return days;
}

/** A moment as the reader's clock shows it: "14:02". */
export function clockTime(ms: number): string {
  return CLOCK.format(ms);
}

/** How long a visit lasted (or has lasted, while open): short and in words. */
export function visitLength(
  visit: AttendanceVisit,
  now: number,
): { short: string; spoken: string } {
  const ms = Math.max(0, (visit.leftAt ?? now) - visit.joinedAt);
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return { short: 'Under a minute', spoken: 'under a minute' };
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (hours === 0) return { short: `${minutes} min`, spoken: plural(minutes, 'minute') };
  return {
    short: rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`,
    spoken:
      rest === 0 ? plural(hours, 'hour') : `${plural(hours, 'hour')} ${plural(rest, 'minute')}`,
  };
}

/** The line under a visit's name: "Joined 14:02 · Left 14:47", or "Joined 14:02" while open. */
export function visitTimes(visit: AttendanceVisit): string {
  const joined = `Joined ${clockTime(visit.joinedAt)}`;
  if (visit.leftAt === null) return joined;
  // A visit over midnight names the day it ended on.
  const sameDay = dayKey(visit.leftAt) === dayKey(visit.joinedAt);
  const left = sameDay
    ? clockTime(visit.leftAt)
    : `${DAY.format(visit.leftAt).replace(',', '')}, ${clockTime(visit.leftAt)}`;
  return `${joined} · Left ${left}`;
}

/** What the room's roster shows of each person in it now, by collab key: their name and colour. */
export type LiveNames = ReadonlyMap<string, { name: string; color: string }>;

/**
 * `visit` as the room shows its person now (Work Tracker 825): an open visit whose key is on the roster takes the
 * roster's name and colour, so an open dialog follows a rename or a recolour. The same object when nothing differs (a
 * closed visit, someone not on the roster, no change), so a memoised row re-renders only when its person changed.
 */
export function liveVisit(visit: AttendanceVisit, live: LiveNames | undefined): AttendanceVisit {
  if (visit.leftAt !== null || !visit.key || !live) return visit;
  const now = live.get(visit.key);
  if (!now || (now.name === visit.name && now.color === visit.color)) return visit;
  return { ...visit, name: now.name, color: now.color };
}

type RosterPerson = { key?: string; name: string; color: string };

/**
 * The roster's keys, names and colours as one string, equal while none of them changed (a status or a last-seen tick
 * leaves it alone): what the host memoises `LiveNames` on, and builds it back from.
 */
export function liveNamesSignature(people: readonly RosterPerson[]): string {
  return JSON.stringify(people.flatMap((p) => (p.key ? [[p.key, p.name, p.color]] : [])));
}

/** `LiveNames` from a `liveNamesSignature`: each person by key, the first wins (the host puts the reader first). */
export function liveNamesFrom(signature: string): LiveNames {
  const live = new Map<string, { name: string; color: string }>();
  for (const [key, name, color] of JSON.parse(signature) as [string, string, string][])
    if (!live.has(key)) live.set(key, { name, color });
  return live;
}
