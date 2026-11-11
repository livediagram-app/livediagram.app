// Automations: when a time trigger's moments come (docs/specs/026-plan/automations.md "Time triggers"; blueprint
// automations.md "Phase 2"). A Scheduled trigger falls on the days a Repeat's rule would (every day, weekday, chosen
// weekdays, a day of the month, past the month's end its last day: repeat.ts occursOn), Due In and Overdue on every
// day, each at its quarter-hour time in the rule's time zone (repeat-dates.ts clockMoment: a skipped time runs at the
// first minute after the change, a repeated one once, at the first). `nextMoment` is the schedule's next wake;
// `latestMissed` the one moment a late wake runs, never one more than a day late. Pure.

import { REPEAT_SEARCH_DAYS, occursOn, type RepeatRule } from '../repeat';
import { addDays, clockMoment, localDay } from '../repeat-dates';
import {
  AUTOMATION_LATE_MAX_MS,
  type AutomationClock,
  type AutomationTimeTriggerKind,
  type AutomationTrigger,
} from './types';

export type AutomationTimeTrigger = Extract<AutomationTrigger, { kind: AutomationTimeTriggerKind }>;

// A rule's time: 'HH:MM', 24-hour, on the quarter hour.
const CLOCK = /^([01]\d|2[0-3]):(00|15|30|45)$/;

// Minutes past midnight a time names, or null when it is not one a rule may hold.
export function clockMinutes(at: unknown): number | null {
  const m = typeof at === 'string' ? CLOCK.exec(at) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// "9:00", "17:45": a time as a rule's words read it.
export const clockWords = (at: AutomationClock): string => at.replace(/^0(\d)/, '$1');

// Whether the trigger has a moment on `day`.
export function firesOn(trigger: AutomationTimeTrigger, day: string): boolean {
  if (trigger.kind !== 'scheduled') return true;
  const rule: Pick<RepeatRule, 'every' | 'days' | 'date'> = {
    every: trigger.every,
    ...(trigger.days ? { days: trigger.days } : {}),
    ...(trigger.dayOfMonth ? { date: trigger.dayOfMonth } : {}),
  };
  return occursOn(rule as RepeatRule, day);
}

// The trigger's moment on `day` in `timeZone` (whether or not it fires that day).
export const momentOn = (trigger: AutomationTimeTrigger, day: string, timeZone: string): number =>
  clockMoment(day, clockMinutes(trigger.at) ?? 0, timeZone);

// The first moment strictly after `after`, or null when none comes within a year and a month (never, for a rule
// validate.ts accepts).
export function nextMoment(
  trigger: AutomationTimeTrigger,
  timeZone: string,
  after: number,
): number | null {
  const first = localDay(after, timeZone);
  for (let i = 0; i <= REPEAT_SEARCH_DAYS; i += 1) {
    const day = addDays(first, i);
    if (!firesOn(trigger, day)) continue;
    const at = momentOn(trigger, day, timeZone);
    if (at > after) return at;
  }
  return null;
}

// Days back a late wake looks: a moment at most a day late lies on today or one of the two days before (a day can
// be 25 hours long).
const LATE_DAYS = 3;

// The one moment a wake at `now` runs: the latest after `since` and at or before `now`, if it is at most
// AUTOMATION_LATE_MAX_MS late; every moment missed before it never runs (late, never a burst). Null for none.
export function latestMissed(
  trigger: AutomationTimeTrigger,
  timeZone: string,
  since: number,
  now: number,
): number | null {
  const today = localDay(now, timeZone);
  for (let i = 0; i < LATE_DAYS; i += 1) {
    const day = addDays(today, -i);
    if (!firesOn(trigger, day)) continue;
    const at = momentOn(trigger, day, timeZone);
    if (at > now) continue;
    return at > since && now - at <= AUTOMATION_LATE_MAX_MS ? at : null;
  }
  return null;
}
