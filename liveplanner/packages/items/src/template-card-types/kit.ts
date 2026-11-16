// What the Plan templates' own card types are made from (docs/specs/026-plan/plan-templates.md "Card types a template
// makes"): field makers, a Detailed card's layout, a card template and its checklist. Pure.
import type { CardField } from '../board';
import type { CardTemplate } from '../card-templates';
import { PARENT_FIELD, type CustomFieldDef, type ItemTypeDef } from '../item-types';

export const text = (id: string, label: string): CustomFieldDef => ({ id, label, kind: 'text' });
export const longText = (id: string, label: string): CustomFieldDef => ({
  id,
  label,
  kind: 'longtext',
});
export const number = (id: string, label: string): CustomFieldDef => ({
  id,
  label,
  kind: 'number',
});
export const date = (id: string, label: string): CustomFieldDef => ({ id, label, kind: 'date' });
export const link = (id: string, label: string): CustomFieldDef => ({ id, label, kind: 'link' });
export const email = (id = 'f-email', label = 'Email'): CustomFieldDef => ({
  id,
  label,
  kind: 'email',
});
export const phone = (id: string, label: string): CustomFieldDef => ({ id, label, kind: 'phone' });
export const money = (id: string, label: string): CustomFieldDef => ({
  id,
  label,
  kind: 'currency',
  currency: 'GBP',
});
export const choice = (id: string, label: string, options: readonly string[]): CustomFieldDef => ({
  id,
  label,
  kind: 'choice',
  options,
});
export const card = (id: string, label: string, linkType: string): CustomFieldDef => ({
  id,
  label,
  kind: 'card',
  linkType,
});

// The card a card sits under, of the template's own parent type (Close the Parent reads it).
export const parentOf = (linkType: string): CustomFieldDef => ({ ...PARENT_FIELD, linkType });

// When the work was done: what the starter rule Stamp the Finish Date sets as a card reaches a done column. One id
// across a template's types, so the one rule stamps every type that has it.
export const COMPLETED_ON = 'f-completed-on';
export const completedOn = (label = 'Completed On'): CustomFieldDef => date(COMPLETED_ON, label);

// A Detailed card's layout with `body` Under the Title and `foot` before the checklist.
export function detailed(body: readonly CardField[], foot: readonly CardField[] = []) {
  return {
    detailed: {
      head: ['type', 'key'] as CardField[],
      headEnd: ['priority'] as CardField[],
      body: [...body, 'description', 'labels'] as CardField[],
      foot: [...foot, 'checklist', 'comments', 'votes'] as CardField[],
      footEnd: ['assignee'] as CardField[],
    },
  };
}

type Check = readonly [text: string, done?: boolean];
export const checklist = (rows: readonly Check[]) =>
  rows.map(([text, done = false]) => ({ text, done }));

// A card template: no title, so a card takes its type's new-card title.
export const template = (
  id: string,
  name: string,
  fields: CardTemplate['fields'],
): CardTemplate => ({
  id,
  name,
  fields,
});

// Every type offers comments, last, as every other type does (docs/specs/026-plan/items.md "Comments").
export const withComments = (types: readonly ItemTypeDef[]): ItemTypeDef[] =>
  types.map((t) => ({ ...t, fields: [...t.fields, 'comments'] }));
