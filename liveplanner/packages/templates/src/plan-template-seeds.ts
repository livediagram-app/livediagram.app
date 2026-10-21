// A Plan template's example cards as the item store takes them (docs/specs/026-plan/plan-templates.md "Example cards"):
// plan-template-seed-data.ts resolved for one document. Each card gets a fresh id (a card that links another names its
// id), dates count from the day the document is made, people become the example team's identities, and votes come
// from as many example voters. Pure, and a subpath of its own ('@liveplanner/templates/plan-template-seeds') so only
// the paths that make a template's tabs for a person bundle it.

import {
  EXAMPLE_FIELD,
  newItemId,
  type ItemCreate,
  type ItemFields,
  type ItemPerson,
} from '@liveplanner/items';
import { isPlanTemplateKind } from './template-builders-plan';
import {
  PLAN_TEMPLATE_SEEDS,
  SEED_PEOPLE,
  type SeedCard,
  type SeedPerson,
} from './plan-template-seed-data';
import type { TemplateKind } from './templates';

// An example person's id: what an assignee, a swimlane row and a vote are keyed by. Never a real person's
// (itemPersonId is a 24-character hex hash), so an example card is never mistaken for anyone's own.
const personId = (who: string) => `example-${who}`;

// One of the example team, as a card names them.
export function seedPerson(who: SeedPerson): ItemPerson {
  return { id: personId(who), ...SEED_PEOPLE[who] };
}

// `today` (YYYY-MM-DD) moved by `days`, in UTC so the date never shifts with the time zone.
export function seedDate(today: string, days: number): string {
  const [y, m, d] = today.split('-').map(Number);
  const at = new Date(Date.UTC(y!, m! - 1, d! + days));
  return at.toISOString().slice(0, 10);
}

function fieldsOf(card: SeedCard, today: string, ids: ReadonlyMap<string, string>): ItemFields {
  const fields: ItemFields = { title: card.title, status: card.status };
  if (card.description) fields['description'] = card.description;
  if (card.assignee) fields['assignee'] = seedPerson(card.assignee);
  if (card.priority) fields['priority'] = card.priority;
  if (card.labels?.length) fields['labels'] = [...card.labels];
  if (card.estimate !== undefined) fields['estimate'] = card.estimate;
  if (card.start !== undefined) fields['start'] = seedDate(today, card.start);
  if (card.due !== undefined) fields['due'] = seedDate(today, card.due);
  if (card.checklist?.length)
    fields['checklist'] = card.checklist.map(([text, done]) => ({ text, done }));
  if (card.parent) fields['parent'] = ids.get(card.parent)!;
  for (const [field, ref] of Object.entries(card.links ?? {})) fields[field] = ids.get(ref)!;
  for (const [field, value] of Object.entries(card.custom ?? {})) fields[field] = value;
  if (card.archived) fields['archived'] = true;
  // What Clear Example Cards finds them by (docs/specs/026-plan/items.md "Example cards").
  fields[EXAMPLE_FIELD] = true;
  return fields;
}

function votesOf(n: number): Record<string, number> {
  const votes: Record<string, number> = {};
  for (let i = 1; i <= n; i++) votes[personId(`voter-${i}`)] = 1;
  return votes;
}

// The cards a template opens with, in column order; none for a template that has none (every template not of Plan,
// Blank Plan and the spreadsheet templates).
export function planTemplateSeedItems(
  kind: TemplateKind,
  today: string,
  newId: () => string = () => newItemId(),
): ItemCreate[] {
  if (!isPlanTemplateKind(kind)) return [];
  const cards = PLAN_TEMPLATE_SEEDS[kind] ?? [];
  const ids = new Map<string, string>();
  const made = cards.map((card) => {
    const id = newId();
    if (card.ref) ids.set(card.ref, id);
    return id;
  });
  return cards.map((card, i) => ({
    id: made[i]!,
    type: card.type,
    fields: fieldsOf(card, today, ids),
    place: { status: card.status },
    ...(card.votes ? { votes: votesOf(card.votes) } : {}),
  }));
}

// Today as a seed counts from it: the local calendar day of `now`.
export function seedToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
