// A refusal as the builder says it (liveplanner/docs/specs/026-plan/automations.md "The rule builder"). The api
// answers a refused save with a code, the `path` of the part at fault and a message written for whoever reads the
// api ("steps.2.text must be 1 to 2,000 characters"). The builder already marks the step, so its words are plain: a
// sentence for each code it knows, and for the rest the api's message with its path taken off. Pure.

import type { AutomationRefusal } from './automations-client';

const REFUSAL_WORDS = (item: string): Readonly<Record<string, string>> => ({
  automation_name_taken: 'Another rule here has this name. Pick another.',
  automation_rules_full: `This ${item} has 50 rules, the most it can hold. Delete one to add another.`,
  automation_value_unknown:
    'This names a value rules don’t know. Pick one from Insert a Value in the field.',
  automation_not_found: 'This rule was deleted elsewhere.',
  automation_condition_unsupported: `This trigger has nobody of the ${item} behind it: nothing here can name whoever triggered it.`,
  automation_step_unsupported:
    'This step can’t go here: a branch or an If / Else holds no outgoing action, AI action, Wait, branch or If.',
  automation_budget_spent: `This ${item} has used today’s runs. It runs again tomorrow.`,
  automation_not_manual: 'Only a Run by Hand rule runs from here.',
  automation_needs_a_person:
    'Only a person saves a rule with this step: sign in and save it in the builder.',
  automation_connection_needs_a_person:
    'Only a person picks a connection: sign in and pick it in the builder.',
  automation_run_failed: 'The rule couldn’t start just now. Try Run Rule again.',
  automation_snapshots_full:
    'Rules here already keep 5 snapshots, the most they can. Pick one of those, or free one first.',
});

// What a path's last name asks for, where every app says the same; an app's own are its kit's (`picks`).
const PICK_WORDS: Readonly<Record<string, string>> = {
  webhook: 'a connection',
  person: 'a person',
};

const pickWords = (path: string, picks: Readonly<Record<string, string>>): string => {
  const named = path
    .split('.')
    .reverse()
    .find((part) => !/^\d+$/.test(part));
  return `Pick ${(named && (picks[named] ?? PICK_WORDS[named])) ?? 'one'}.`;
};

/** A refusal in the builder's words. `item`: the item's word ("plan"); `picks`: what each field's name asks for
 *  ("status" → "a column"), the app's own. */
export function refusalWords(
  r: Pick<AutomationRefusal, 'code' | 'path' | 'message'>,
  item: string,
  picks: Readonly<Record<string, string>> = {},
): string {
  const fixed = REFUSAL_WORDS(item)[r.code];
  if (fixed) return fixed;
  const path = r.path;
  if (!path || !r.message.startsWith(`${path} `)) return r.message;
  const rest = r.message.slice(path.length + 1).trim();
  if (!rest) return r.message;
  if (rest === 'must name one') return pickWords(path, picks);
  return `${rest.charAt(0).toUpperCase()}${rest.slice(1)}${/[.!?]$/.test(rest) ? '' : '.'}`;
}
