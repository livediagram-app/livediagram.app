// The Preview an action's panel shows (docs/specs/026-plan/automations.md "The rule builder"): a real card of the plan
// with a rule's text filled in, as the run would fill it. The fixed values only; `card.field.<Name>` reads the card's
// field by its name, and a value the preview cannot fill reads as nothing, as a run's does. The run's own filling is
// the api's; this is a picture of it. Pure.

import { itemTitle, type Item, type ItemPerson } from '@liveplanner/items';

export type PreviewContext = {
  card: Item;
  // The column the card is in, by name.
  column: string;
  // The card's address (Copy Card Link's).
  link: string;
  people: readonly ItemPerson[];
  // Who the preview supposes triggered it: this person.
  person: string;
  rule: string;
  now: number;
  // A custom field's value on the card by its name ("Completed On"), as text.
  fieldByName: (name: string) => string;
};

/** A day as values read it: "11 Nov 2026". */
export const valueDay = (at: number | string) =>
  new Date(typeof at === 'string' ? `${at}T00:00:00` : at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const SHIFT = /^now\s*([+-])\s*(\d+)d$/;

function valueOf(name: string, ctx: PreviewContext): string {
  const f = ctx.card.fields;
  switch (name) {
    case 'card.title':
      return itemTitle(ctx.card);
    case 'card.key':
      return `#${ctx.card.key}`;
    case 'card.url':
      return ctx.link;
    case 'card.assignee': {
      const id = typeof f.assignee === 'string' ? f.assignee : null;
      return ctx.people.find((p) => p.id === id)?.name ?? '';
    }
    case 'card.column':
      return ctx.column;
    case 'card.due':
      return typeof f.due === 'string' && f.due ? valueDay(f.due) : '';
    case 'person':
      return ctx.person;
    case 'rule':
      return ctx.rule;
    case 'now.date':
      return valueDay(ctx.now);
    case 'now':
      return new Date(ctx.now).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  }
  const shift = SHIFT.exec(name);
  if (shift) {
    const days = Number(shift[2]) * (shift[1] === '-' ? -1 : 1);
    return valueDay(ctx.now + days * 24 * 60 * 60 * 1000);
  }
  if (name.startsWith('card.field.')) return ctx.fieldByName(name.slice('card.field.'.length));
  return '';
}

/** A rule's text with every value filled. */
export function previewText(text: string, ctx: PreviewContext): string {
  return text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, name: string) => valueOf(name, ctx));
}
