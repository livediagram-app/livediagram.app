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
