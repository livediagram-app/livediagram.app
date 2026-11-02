// A repeating card's rule in words (docs/specs/026-plan/items.md "Repeating cards"): the item panel's line and
// list_items say it the same way. Days read as "Thu 5 Nov 2026", never a locale's numeric order, so a reader in any
// country reads the same day.
import type { RepeatRule } from './repeat';
import { MONTH_SHORT, WEEKDAY_SHORT } from './plan-view-dates';
import { weekdayOf } from './repeat-dates';

// A rule's weekday (0 Sunday) as the plan views name it ("Mon").
export const weekdayWord = (day: number): string => WEEKDAY_SHORT[(day + 6) % 7]!;

// Monday first, as the dialog lays the week out.
export const mondayFirst = (a: number, b: number): number => ((a + 6) % 7) - ((b + 6) % 7);

// "1st", "2nd", "3rd", "11th", "22nd", "31st".
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

// "Mon", "Mon and Thu", "Mon, Wed and Fri".
export function listWords(words: readonly string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

// "Thu 5 Nov 2026"; without the year when `thisYear` is the day's own.
export function dayWords(day: string, thisYear?: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const head = `${weekdayWord(weekdayOf(day))} ${d} ${MONTH_SHORT[m - 1]}`;
  return y === thisYear ? head : `${head} ${y}`;
}

// "every week on Mon and Thu, until Thu 31 Dec 2026".
export function repeatRuleWords(rule: RepeatRule): string {
  const every =
    rule.every === 'day'
      ? 'every day'
      : rule.every === 'weekday'
        ? 'every weekday'
        : rule.every === 'week'
          ? `every week on ${listWords([...(rule.days ?? [])].sort(mondayFirst).map(weekdayWord))}`
          : `every month on the ${ordinal(rule.date ?? 1)}`;
  return rule.until === undefined ? every : `${every}, until ${dayWords(rule.until)}`;
}
