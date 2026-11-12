// The words the Rules list and the Audit Trail use for times, counts and results (docs/specs/026-plan/automations.md
// "The Automations screen"): "4 min ago", "Never", "38 runs", "10:42", "Yesterday", "38 ms", "1.2 s", and each
// result's pill. Pure.

import type { AutomationResult } from '@liveplanner/items';
import { formatRelativeTimeShort } from '@liveplanner/ui';

export const RESULT_LABELS: Readonly<Record<AutomationResult, string>> = {
  done: 'Done',
  no_match: 'No Match',
  skipped: 'Skipped',
  failed: 'Failed',
  waiting: 'Waiting',
};

// Each pill's tint: done green, no match quiet slate, skipped amber, failed red, waiting brand blue; dark mode on the
// same hues.
export const RESULT_PILL: Readonly<Record<AutomationResult, string>> = {
  done: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  no_match: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  skipped: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  failed: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  waiting: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
};

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Last Run: "Never", "Just now", "4 min ago", "Yesterday". */
export function lastRunWords(at: number | null, now: number): string {
  return at === null ? 'Never' : capitalise(formatRelativeTimeShort(Math.max(0, now - at)));
}

/** This Week: "1 run", "38 runs". */
export function runsWords(n: number): string {
  return `${n.toLocaleString('en-GB')} ${n === 1 ? 'run' : 'runs'}`;
}

/** Took: "38 ms", "1.2 s". */
export function tookWords(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** A run's When: its time today, "Yesterday", else its day ("9 Nov"). */
export function runWhen(at: number, now: number): string {
  const d = new Date(at);
  const today = new Date(now);
  if (dayKey(d) === dayKey(today))
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey(d) === dayKey(yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** The meter's words: "142 of 1,000". */
export function meterWords(used: number, max: number): string {
  return `${used.toLocaleString('en-GB')} of ${max.toLocaleString('en-GB')}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const clock = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

/** A time rule's next moment, in this browser's time: "Today 9:00", "Tomorrow 9:00", "Mon 9:00" within the week,
 *  else its day ("12 Dec 9:00"). */
export function nextRunWords(at: number, now: number): string {
  const d = new Date(at);
  const day = (offset: number) => {
    const x = new Date(now);
    x.setDate(x.getDate() + offset);
    return dayKey(x);
  };
  if (dayKey(d) === day(0)) return `Today ${clock(d)}`;
  if (dayKey(d) === day(1)) return `Tomorrow ${clock(d)}`;
  if (at - now < 6 * 24 * 60 * 60 * 1000) return `${WEEKDAYS[d.getDay()]!} ${clock(d)}`;
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${clock(d)}`;
}
