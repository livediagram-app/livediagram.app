// A save or toggle the api refuses, as the builder says it (docs/specs/026-plan/automations.md "The rule builder"):
// fixed words for the codes a person can act on, else the api's own message. That message is written for agents and
// leads with the path of the part at fault ("steps.2.text must be text of 1 to 2000 characters"); the builder marks
// that part, so it says the rest as a sentence, never the path. Pure.

import type { AutomationRefusal } from './automations-client';

const REFUSAL_WORDS: Readonly<Record<string, string>> = {
  automation_name_taken: 'Another rule here has this name. Pick another.',
  automation_rules_full: 'This plan has 50 rules, the most it can hold. Delete one to add another.',
  automation_value_unknown:
    'This names a value rules don’t know. Pick one from Insert a Value in the field.',
  automation_not_found: 'This rule was deleted elsewhere.',
  automation_condition_unsupported:
    'This trigger has nobody behind it: nothing here can name whoever triggered it.',
  automation_step_unsupported:
    'This step can’t go here: a branch or an If / Else holds no outgoing action, AI action, Wait, branch or If.',
};

export function refusalWords(r: Pick<AutomationRefusal, 'code' | 'path' | 'message'>): string {
  const fixed = REFUSAL_WORDS[r.code];
  if (fixed) return fixed;
  const lead = r.path ? `${r.path} ` : null;
  if (!lead || !r.message.startsWith(lead)) return r.message;
  const rest = r.message.slice(lead.length).trim();
  if (!rest) return r.message;
  return `${rest.charAt(0).toUpperCase()}${rest.slice(1)}${/[.!?]$/.test(rest) ? '' : '.'}`;
}
