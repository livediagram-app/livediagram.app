// The Repeat dialog's choices (docs/specs/026-plan/items.md "Repeating cards"), apart from the dialog so the rule it
// saves is tested alone. Every choice is kept while another kind is picked, so going Week, then Month, then Week
// again keeps the days ticked.
import {
  addDays,
  readRepeatRule,
  weekdayOf,
  type RepeatEvery,
  type RepeatRule,
} from '@liveplanner/items';

export interface RepeatDraft {
  every: RepeatEvery;
  days: number[];
  date: number;
  // Ends On a date: the day, else Never.
  until: string | null;
  // Lands In: a column, '' for the type's starting state.
  status: string;
}

// How far ahead On a date starts, before the person picks their day.
export const REPEAT_UNTIL_SEED_DAYS = 30;

// The dialog's opening choices: the card's rule, else every week on today's weekday (and the month on today's date).
export function repeatDraft(rule: RepeatRule | undefined, today: string): RepeatDraft {
  return {
    every: rule?.every ?? 'week',
    days: rule?.days ?? [weekdayOf(today)],
    date: rule?.date ?? Number(today.slice(8, 10)),
    until: rule?.until ?? null,
    status: rule?.status ?? '',
  };
}

// A week day ticked or unticked; the last one stays (a week rule needs a day).
export function toggleDay(days: readonly number[], day: number): number[] {
  if (!days.includes(day)) return [...days, day].sort((a, b) => a - b);
  return days.length === 1 ? [...days] : days.filter((d) => d !== day);
}

// On a date seeded a month out from today, or back to Never.
export const untilFor = (on: boolean, today: string): string | null =>
  on ? addDays(today, REPEAT_UNTIL_SEED_DAYS) : null;

// What stops the rule saving, in words, or null.
export function draftProblem(draft: RepeatDraft, today: string): string | null {
  if (draft.until !== null && draft.until < today) return 'Pick an end day from today on';
  return null;
}

// The rule the draft saves, stamped with the setter's day and time zone; null while it has a problem.
export function draftRule(draft: RepeatDraft, today: string, timeZone: string): RepeatRule | null {
  if (draftProblem(draft, today)) return null;
  return (
    readRepeatRule({
      every: draft.every,
      from: today,
      timeZone,
      ...(draft.every === 'week' ? { days: draft.days } : {}),
      ...(draft.every === 'month' ? { date: draft.date } : {}),
      ...(draft.until !== null ? { until: draft.until } : {}),
      ...(draft.status ? { status: draft.status } : {}),
    }) ?? null
  );
}
