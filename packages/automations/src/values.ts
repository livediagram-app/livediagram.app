// Automations: the values a rule's text holds (liveworkspace/docs/specs/018-automations/automations.md "Values").
// `{{rule}}` and the rest, found between their braces and filled in when a rule runs, in the rule's time zone. The
// names every app shares are here (`person`, `rule`, `now`, `now.date`, `now ± Nd` and an Incoming Webhook rule's
// `webhook.<path>`); an app's own names are its resolver's. Filling is one pass: what a value reads is never read as
// a value again. Pure.

import { addDays, dayText, localDay, zonedClock } from './dates';
import type { AutomationDay } from './types';
import { webhookPathOf, type WebhookValues } from './webhook-paths';

// The fixed names every app's rules may hold, as written between `{{` and `}}`.
export const AUTOMATION_SHARED_VALUE_NAMES = ['person', 'now.date', 'rule', 'now'] as const;
export type AutomationSharedValueName = (typeof AUTOMATION_SHARED_VALUE_NAMES)[number];
export const AUTOMATION_SHARED_VALUE_LABELS: Record<AutomationSharedValueName, string> = {
  person: 'Who Did It',
  'now.date': 'Today',
  rule: 'Rule Name',
  now: 'Now',
};

const SHARED: ReadonlySet<string> = new Set(AUTOMATION_SHARED_VALUE_NAMES);
const VALUE = /\{\{([^{}]*)\}\}/g;
const SHIFT = /^now\s*([+-])\s*(\d{1,4})\s*d$/;

// The names a text's values give, in order, as written between the braces (trimmed).
export function valuesIn(text: string): string[] {
  return [...text.matchAll(VALUE)].map((m) => m[1]!.trim());
}

// `now + 3d`, `now - 1d`: the whole days it shifts today by, or null when `name` is not one.
export function dayShiftOf(name: string): number | null {
  const shift = SHIFT.exec(name);
  return shift ? Number(shift[2]) * (shift[1] === '-' ? -1 : 1) : null;
}

// Whether `name` is one every app knows: a fixed name, a day from today, or (`webhook`: in an Incoming Webhook
// rule's text) a field of the call's body.
export const isSharedValue = (name: string, place: { webhook?: boolean } = {}): boolean =>
  SHARED.has(name) || SHIFT.test(name) || (place.webhook === true && webhookPathOf(name) !== null);

// The first value a text holds that `known` does not take, or null.
export const unknownValueIn = (text: string, known: (name: string) => boolean): string | null =>
  valuesIn(text).find((name) => !known(name)) ?? null;

// ---- Days ----------------------------------------------------------------------------------------------------------

export const todayIn = (now: number, timeZone: string): string => localDay(now, timeZone);

// A condition's or a step's day: a fixed day, or today shifted by whole days.
export const dayFrom = (day: AutomationDay, now: number, timeZone: string): string =>
  'day' in day ? day.day : addDays(todayIn(now, timeZone), day.today);

// ---- Filling -------------------------------------------------------------------------------------------------------

// What the shared names read when a rule runs.
export interface SharedValueContext {
  // Who started the rule, by name.
  person: string;
  rule: string;
  now: number;
  timeZone: string;
  // An Incoming Webhook run: the values its call's body gave, by path (missing reads nothing).
  webhook?: WebhookValues;
}

const pad = (n: number) => String(n).padStart(2, '0');

// A shared name's text, or undefined when `name` is not one (the app's own resolver reads it). `iso`: a day reads
// `YYYY-MM-DD`, for a date field.
export function sharedValue(
  name: string,
  ctx: SharedValueContext,
  iso = false,
): string | undefined {
  const day = (d: string) => (iso ? d : dayText(d));
  const shift = dayShiftOf(name);
  if (shift !== null) return day(addDays(todayIn(ctx.now, ctx.timeZone), shift));
  const path = webhookPathOf(name);
  if (path !== null) {
    // Own values only: `{{webhook.constructor}}` (a valid path) never reads the prototype.
    const key = path.join('.');
    const value = ctx.webhook && Object.hasOwn(ctx.webhook, key) ? ctx.webhook[key] : undefined;
    return value === undefined ? '' : String(value);
  }
  switch (name) {
    case 'person':
      return ctx.person;
    case 'rule':
      return ctx.rule;
    case 'now.date':
      return day(todayIn(ctx.now, ctx.timeZone));
    case 'now': {
      const c = zonedClock(ctx.now, ctx.timeZone);
      return `${dayText(todayIn(ctx.now, ctx.timeZone))}, ${pad(c.h)}:${pad(c.min)}`;
    }
    default:
      return undefined;
  }
}

// The text with every value filled in by `resolve`, in one pass.
export function fillValues(text: string, resolve: (name: string) => string): string {
  return text.replace(VALUE, (_all, name: string) => resolve(name.trim()));
}
