// What Insert a Value offers (docs/specs/026-plan/automations.md "Values"), grouped: This Card's fixed values, The
// Triggering Card's inside a For Related Cards branch, each of the card's fields by name, and in an Incoming Webhook
// rule Webhook Field…, which asks for a path rather than inserting at once. Pure.

import {
  AUTOMATION_BRANCH_VALUE_LABELS,
  AUTOMATION_BRANCH_VALUE_NAMES,
  AUTOMATION_VALUE_LABELS,
  AUTOMATION_VALUE_NAMES,
} from '@liveplanner/items';

export type ValueOption =
  // A value to insert, by the name written between the braces.
  | { kind: 'value'; id: string; label: string; name: string }
  // Webhook Field…: opens the path line.
  | { kind: 'webhook'; id: string; label: string };

export type ValueGroup = { id: string; label: string; options: readonly ValueOption[] };

const THIS_CARD: ValueGroup = {
  id: 'card',
  label: 'This Card',
  options: AUTOMATION_VALUE_NAMES.map((name) => ({
    kind: 'value',
    id: `value:${name}`,
    label: AUTOMATION_VALUE_LABELS[name],
    name,
  })),
};
const TRIGGERING_CARD: ValueGroup = {
  id: 'trigger',
  label: 'The Triggering Card',
  options: AUTOMATION_BRANCH_VALUE_NAMES.map((name) => ({
    kind: 'value',
    id: `value:${name}`,
    label: AUTOMATION_BRANCH_VALUE_LABELS[name],
    name,
  })),
};
const WEBHOOK: ValueGroup = {
  id: 'webhook',
  label: 'Webhook',
  options: [{ kind: 'webhook', id: 'webhook', label: 'Webhook Field…' }],
};

/** The groups for a field: inside a branch or not, the card's fields, and whether the rule is an Incoming Webhook's. */
export function valueInsertGroups(
  branch: boolean,
  fields: readonly { id: string; name: string }[],
  incoming: boolean,
): ValueGroup[] {
  const groups: ValueGroup[] = [THIS_CARD];
  if (branch) groups.push(TRIGGERING_CARD);
  if (fields.length > 0)
    groups.push({
      id: 'fields',
      label: 'Card Fields',
      options: fields.map((f) => ({
        kind: 'value',
        id: `field:${f.id}`,
        label: f.name,
        name: `card.field.${f.name}`,
      })),
    });
  if (incoming) groups.push(WEBHOOK);
  return groups;
}

/** The groups a search leaves: each option whose label holds the words typed, any case; empty groups go. */
export function filterValueGroups(groups: readonly ValueGroup[], query: string): ValueGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...groups];
  return groups
    .map((g) => ({ ...g, options: g.options.filter((o) => o.label.toLowerCase().includes(q)) }))
    .filter((g) => g.options.length > 0);
}
