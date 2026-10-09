// The choices a card table column offers (docs/specs/029-sheets/sheet.md "Card tables"): a field with set values
// (Type, State, Priority, Assignee, a choice field) picks from a list; a date field from a date. Others are typed.
import {
  PRIORITIES,
  TRASH_STATUS,
  builtInFieldOf,
  isCardDateField,
  type ItemPerson,
  type ItemTypeDef,
} from '@livediagram/items';

export type CardFieldChoice = { kind: 'list'; options: string[] } | { kind: 'date' } | null;

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const unique = (xs: Iterable<string>) => [...new Set([...xs].filter(Boolean))];

export function cardFieldChoice(
  field: string,
  plan: {
    types: readonly ItemTypeDef[];
    statusNames: ReadonlyMap<string, string>;
    people: readonly ItemPerson[];
  },
): CardFieldChoice {
  if (isCardDateField(field)) return { kind: 'date' };
  const id = builtInFieldOf(field);
  const f = field.trim().toLowerCase();
  if (id === '#type') return { kind: 'list', options: plan.types.map((t) => t.label) };
  if (id === 'status')
    return {
      kind: 'list',
      options: unique(
        [...plan.statusNames].filter(([status]) => status !== TRASH_STATUS).map(([, name]) => name),
      ),
    };
  if (id === 'priority') return { kind: 'list', options: PRIORITIES.map(title) };
  if (id === 'assignee') return { kind: 'list', options: unique(plan.people.map((p) => p.name)) };
  for (const t of plan.types)
    for (const c of t.custom ?? [])
      if (c.kind === 'choice' && c.label.trim().toLowerCase() === f)
        return { kind: 'list', options: [...(c.options ?? [])] };
  return null;
}
