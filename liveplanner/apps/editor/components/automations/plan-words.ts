// liveplanner's own words in the platform's Automations screen (docs/specs/026-plan/automations.md "The rule
// builder", "Describe a Rule"): what a refused field asks for, what a template left to pick, and Describe a Rule's
// examples. Pure: the kit reads them (plan-kit.tsx), and so do the tests of each.

import { AUTOMATION_PICK_WORDS, type AutomationPick } from '@liveplanner/items';

// What a refused field's name asks for ("Pick a column."), where the api says a part must name one. A message
// step's connection and a person are the platform's.
export const REFUSAL_PICKS: Readonly<Record<string, string>> = {
  field: 'a field',
  linkField: 'a link field',
  from: 'a field to copy from',
  status: 'a column',
  type: 'a card type',
  formTab: 'a form',
  board: 'a board',
  tab: 'a board',
  filter: 'a saved filter',
  card: 'a card',
  snapshot: 'a snapshot',
};

// What a template left to pick: a message step's is a connection (every app's word for what was a webhook).
export const PLAN_PICK_WORDS: Readonly<Record<string, string>> = {
  ...AUTOMATION_PICK_WORDS,
  webhook: 'Pick a connection',
} satisfies Readonly<Record<AutomationPick, string>>;

export const DESCRIBE_EXAMPLES: readonly { label: string; text: string }[] = [
  {
    label: 'Stamp Done Cards',
    text: 'When a card moves to Done, set Completed On to today and remove the blocked label',
  },
  {
    label: 'Welcome Form Responses',
    text: 'When a form response comes in, comment “Thanks, we’ve got it” and set its priority to High',
  },
  {
    label: 'Nudge Overdue Cards',
    text: 'Every weekday at 9:00, flag overdue cards and email their assignee a reminder',
  },
];

export const DESCRIBE_PLACEHOLDER =
  'When a card moves to Done, set Completed On to today and remove the blocked label';
