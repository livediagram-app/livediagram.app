// Automations: a rule in words, the parts every app's sentence shares (liveworkspace/docs/specs/018-automations/
// automations.md "A rule"): the sentence's words and chips, a day, a list, a Wait and where a message goes. Pure.

import { dayText } from './dates';
import type { AutomationDay, AutomationOutgoing, AutomationVia } from './types';

// A joining word, or a chip (the trigger's own chip is drawn in the brand tint).
export type RuleSentencePart = { word: string } | { chip: string; trigger?: true };

// A message step by where it posts.
export const AUTOMATION_NOTIFY_NAMES: Readonly<Record<AutomationVia, string>> = {
  webhook: 'Send to Webhook',
  slack: 'Post to Slack',
  teams: 'Post to Microsoft Teams',
};

// "Today", "Today + 3 days", "Today - 1 day", or the day. `words`: the app's own reading of a fixed day.
export function automationDayWords(
  day: AutomationDay,
  words: (day: string) => string = dayText,
): string {
  if ('day' in day) return words(day.day);
  if (day.today === 0) return 'Today';
  const n = Math.abs(day.today);
  return `Today ${day.today > 0 ? '+' : '-'} ${n} day${n === 1 ? '' : 's'}`;
}

/** "A", "A or B", "A, B or C". */
export function sentenceOrList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]!}`;
}

/** A Wait as its chip reads: "Wait 2 Days", "Wait 1 Day 4 Hours", "Wait 3 Hours". */
export function waitWords(hours: number): string {
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  const part = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
  if (!days) return `Wait ${part(rest, 'Hour')}`;
  return rest ? `Wait ${part(days, 'Day')} ${part(rest, 'Hour')}` : `Wait ${part(days, 'Day')}`;
}

/** A message step as its chip reads: "Post to Slack Launch Channel", or its kind alone with no name known.
 *  `outline.webhooks`: the item's connections by id, named; absent, the step's kept name reads. */
export function notifyChip(
  step: AutomationOutgoing,
  outline?: { webhooks?: ReadonlyMap<string, string> },
): string {
  const name = outline?.webhooks?.get(step.webhook) ?? step.name;
  return name ? `${AUTOMATION_NOTIFY_NAMES[step.via]} ${name}` : AUTOMATION_NOTIFY_NAMES[step.via];
}
