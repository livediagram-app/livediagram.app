// Quick add (docs/specs/025-plan/plan-board.md "Working on a board"): one line
// of text becomes an item. `@sam` assigns, `#ux` labels, `!high` sets priority,
// `~3` estimates and a leading `bug:` sets the type. A token that does not
// resolve (an unknown person) stays in the title as typed.

import type { ItemFields, ItemPerson } from './item';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import { typeByNameIn } from './type-catalogue';
import { isPriority, type Priority } from './fields';
import { ITEM_LABELS_MAX, ITEM_LABEL_MAX, ITEM_NUMBER_MAX } from './limits';

export type QuickToken =
  | { kind: 'type'; text: string; type: string }
  | { kind: 'assignee'; text: string; person: ItemPerson }
  | { kind: 'label'; text: string; label: string }
  | { kind: 'priority'; text: string; priority: Priority }
  | { kind: 'estimate'; text: string; estimate: number };

export interface QuickAdd {
  title: string;
  type?: string;
  fields: ItemFields;
  tokens: QuickToken[];
}

function findPerson(name: string, people: readonly ItemPerson[]): ItemPerson | undefined {
  const n = name.toLowerCase();
  return (
    people.find((p) => p.name.toLowerCase() === n) ??
    people.find((p) => p.name.toLowerCase().split(/\s+/)[0] === n) ??
    people.find((p) => p.name.toLowerCase().startsWith(n))
  );
}

export function parseQuickAdd(
  text: string,
  people: readonly ItemPerson[] = [],
  // The document's item types (docs/specs/025-plan/item-types.md), for a leading `name:`.
  types: readonly ItemTypeDef[] = ITEM_TYPES,
): QuickAdd {
  const tokens: QuickToken[] = [];
  const fields: ItemFields = {};
  let rest = text.trim();
  let type: string | undefined;

  // A type's name may have spaces ("customer call:"); the prefix counts only when it names a type.
  const lead = /^([A-Za-z][A-Za-z0-9 -]{0,31}):\s*/.exec(rest);
  if (lead) {
    const def = typeByNameIn(types, lead[1]!);
    if (def) {
      type = def.id;
      tokens.push({ kind: 'type', text: lead[0].trim(), type: def.id });
      rest = rest.slice(lead[0].length);
    }
  }

  const labels: string[] = [];
  const kept: string[] = [];
  for (const word of rest.split(/\s+/).filter(Boolean)) {
    const body = word.slice(1);
    if (word.startsWith('@') && body) {
      const person = findPerson(body, people);
      if (person && !fields['assignee']) {
        fields['assignee'] = { ...person };
        tokens.push({ kind: 'assignee', text: word, person });
        continue;
      }
    } else if (
      word.startsWith('#') &&
      body &&
      body.length <= ITEM_LABEL_MAX &&
      !/^\d+$/.test(body)
    ) {
      if (labels.length < ITEM_LABELS_MAX && !labels.includes(body)) labels.push(body);
      tokens.push({ kind: 'label', text: word, label: body });
      continue;
    } else if (word.startsWith('!') && isPriority(body.toLowerCase()) && !fields['priority']) {
      const priority = body.toLowerCase() as Priority;
      fields['priority'] = priority;
      tokens.push({ kind: 'priority', text: word, priority });
      continue;
    } else if (
      word.startsWith('~') &&
      /^\d+(\.\d+)?$/.test(body) &&
      fields['estimate'] === undefined
    ) {
      const estimate = Math.min(ITEM_NUMBER_MAX, Number(body));
      fields['estimate'] = estimate;
      tokens.push({ kind: 'estimate', text: word, estimate });
      continue;
    }
    kept.push(word);
  }
  if (labels.length) fields['labels'] = labels;
  const title = kept.join(' ').trim();
  return { title, ...(type ? { type } : {}), fields, tokens };
}
