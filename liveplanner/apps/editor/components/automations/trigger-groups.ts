// The Pick a Trigger picker's groups (docs/specs/026-plan/automations.md "The rule builder"): every trigger in groups,
// each one thing, with a line on what it hears, and a trigger's first form when it is picked.

import type { AutomationTrigger, AutomationTriggerKind } from '@liveplanner/items';
import { freshTimeTrigger } from './step-panels/TimeTriggerPanel';

export type TriggerGroupId = 'cards' | 'comments' | 'links' | 'times' | 'tools';

export const TRIGGER_GROUPS: readonly {
  id: TriggerGroupId;
  name: string;
  kinds: readonly AutomationTriggerKind[];
}[] = [
  {
    id: 'cards',
    name: 'Cards',
    kinds: [
      'card_created',
      'form_response',
      'card_moved',
      'field_changed',
      'card_archived',
      'card_restored',
      'checklist_completed',
      'column_limit',
      'manual',
    ],
  },
  { id: 'comments', name: 'Comments', kinds: ['comment_added', 'threads_resolved', 'mentioned'] },
  { id: 'links', name: 'Links', kinds: ['card_unblocked', 'related_done'] },
  { id: 'times', name: 'Times', kinds: ['scheduled', 'due_in', 'overdue', 'stuck'] },
  { id: 'tools', name: 'Other Tools', kinds: ['incoming_webhook'] },
];

export const TRIGGER_LINES: Readonly<Record<AutomationTriggerKind, string>> = {
  card_created: 'A card is added: by a person, Duplicate, an import, a Repeat or an agent.',
  form_response: 'A Form response makes a card.',
  card_moved: 'A card’s column changes.',
  field_changed: 'Any of the chosen fields changes value.',
  card_archived: 'A card is archived.',
  card_restored: 'An archived card is brought back.',
  checklist_completed: 'The last unticked item on a card’s checklist is ticked.',
  column_limit: 'A card goes into a column that then holds more cards than its limit.',
  manual: 'An Editor picks this rule under Run Rule in a card’s ⋯ menu.',
  comment_added: 'Someone starts a thread on a card or replies on one.',
  threads_resolved: 'The last open comment thread on a card is resolved.',
  mentioned: 'A comment on a card @mentions someone, or one of the people you pick.',
  card_unblocked:
    'The last card blocking a card is done or archived. The unblocked card runs the rule.',
  related_done: 'The last of a card’s children, or linked cards, is done. That card runs the rule.',
  scheduled: 'A time comes round. The rule runs once on each card its conditions match.',
  due_in: 'A card’s due date is the chosen number of days away. Once for each due date it has.',
  overdue:
    'A card’s due date has passed and it is not in a done column. Once for each due date it has.',
  stuck: 'Daily at a time: cards that have not changed for a number of days, outside done columns.',
  incoming_webhook:
    'Another tool, such as CI or a form, sends this rule’s address JSON, proved with its secret.',
};

export const isTimeKind = (kind: AutomationTriggerKind): boolean =>
  kind === 'scheduled' || kind === 'due_in' || kind === 'overdue' || kind === 'stuck';

/** A trigger's first form: Field Changed on the plan's first field, Column Over Limit on its first column past 5,
 *  Related Cards Done on children, a time at 9:00, the rest as they are. */
export function freshTrigger(
  kind: AutomationTriggerKind,
  fields: readonly string[],
  columns: readonly string[],
): AutomationTrigger {
  switch (kind) {
    case 'field_changed':
      return { kind, fields: fields.slice(0, 1) };
    case 'column_limit':
      return { kind, status: columns[0] ?? '', limit: 5 };
    case 'related_done':
      return { kind, related: 'children' };
    case 'scheduled':
    case 'due_in':
    case 'overdue':
    case 'stuck':
      return freshTimeTrigger(kind);
    default:
      return { kind };
  }
}
