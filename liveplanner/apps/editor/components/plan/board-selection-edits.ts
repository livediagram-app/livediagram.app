// What the selection bar writes (docs/specs/026-plan/plan-board.md "Several cards at once"; blueprint plan-board.md):
// pure builders turning one action on the selected cards into the patches of one write. A card whose type does not
// offer the field, or that already holds the value, is left out, so a change no card takes writes nothing.
import {
  ARCHIVED_FIELD,
  isArchived,
  isFlagged,
  itemLabels,
  typeIn,
  type CustomFieldDef,
  type Item,
  type ItemFieldValue,
  type ItemPatchOf,
  type ItemPerson,
  type ItemTypeDef,
  type Priority,
} from '@liveplanner/items';

// The custom field kinds Set Field gives a value to: those a person types or picks one value into.
export const SET_FIELD_KINDS = [
  'choice',
  'checkbox',
  'number',
  'currency',
  'percent',
  'rating',
  'date',
  'text',
  'person',
] as const;
export type SetFieldKind = (typeof SET_FIELD_KINDS)[number];

const offers = (types: readonly ItemTypeDef[], item: Item, field: string) =>
  typeIn(types, item.type).fields.includes(field);

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Each card whose type offers `field` and whose value differs, set to `value` (or cleared, for null).
function setPatches(
  items: readonly Item[],
  types: readonly ItemTypeDef[],
  field: string,
  value: ItemFieldValue | null,
): ItemPatchOf[] {
  const out: ItemPatchOf[] = [];
  for (const it of items) {
    if (!offers(types, it, field)) continue;
    const has = it.fields[field];
    if (value === null) {
      if (has !== undefined) out.push({ id: it.id, patch: { clear: [field] } });
    } else if (!same(has, value)) out.push({ id: it.id, patch: { set: { [field]: value } } });
  }
  return out;
}

export function assignPatches(
  items: readonly Item[],
  types: readonly ItemTypeDef[],
  person: ItemPerson | null,
): ItemPatchOf[] {
  return setPatches(items, types, 'assignee', person ? { ...person } : null);
}

export function priorityPatches(
  items: readonly Item[],
  types: readonly ItemTypeDef[],
  priority: Priority | null,
): ItemPatchOf[] {
  return setPatches(items, types, 'priority', priority);
}

// A label added to every card that lacks it, or taken off every card that has it.
export function labelPatches(
  items: readonly Item[],
  types: readonly ItemTypeDef[],
  label: string,
  op: 'add' | 'remove',
): ItemPatchOf[] {
  const out: ItemPatchOf[] = [];
  for (const it of items) {
    if (!offers(types, it, 'labels')) continue;
    const now = itemLabels(it);
    const has = now.includes(label);
    if (op === 'add' && !has) out.push({ id: it.id, patch: { set: { labels: [...now, label] } } });
    if (op === 'remove' && has) {
      const rest = now.filter((l) => l !== label);
      out.push({
        id: it.id,
        patch: rest.length ? { set: { labels: rest } } : { clear: ['labels'] },
      });
    }
  }
  return out;
}

// The labels the selected cards carry, most used first, then A to Z.
export function selectionLabels(items: readonly Item[]): string[] {
  const counts = new Map<string, number>();
  for (const it of items) for (const l of itemLabels(it)) counts.set(l, (counts.get(l) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([l]) => l);
}

export function fieldPatches(
  items: readonly Item[],
  types: readonly ItemTypeDef[],
  fieldId: string,
  value: ItemFieldValue | null,
): ItemPatchOf[] {
  return setPatches(items, types, fieldId, value);
}

// Flag every card (or, when every card is flagged, take every flag off).
export function flagPatches(items: readonly Item[]): ItemPatchOf[] {
  const allOn = items.length > 0 && items.every(isFlagged);
  return items
    .filter((it) => isFlagged(it) === allOn)
    .map((it) => ({
      id: it.id,
      patch: allOn ? { clear: ['flagged'] } : { set: { flagged: true } },
    }));
}

// Archive every card (or, when every card is archived, restore them all).
export function archivePatches(items: readonly Item[]): ItemPatchOf[] {
  const allOn = items.length > 0 && items.every(isArchived);
  return items
    .filter((it) => isArchived(it) === allOn)
    .map((it) => ({
      id: it.id,
      patch: allOn ? { clear: [ARCHIVED_FIELD] } : { set: { [ARCHIVED_FIELD]: true } },
    }));
}

// The custom fields every selected card's type has (by id), of the kinds Set Field edits, named as the first type
// names them; a Person field that holds several is left out.
export function sharedFields(
  items: readonly Item[],
  types: readonly ItemTypeDef[],
): (CustomFieldDef & { kind: SetFieldKind })[] {
  const typeIds = [...new Set(items.map((i) => i.type))];
  if (typeIds.length === 0) return [];
  const defs = typeIds.map((id) => typeIn(types, id));
  const first = defs[0]!;
  return (first.custom ?? []).filter(
    (f): f is CustomFieldDef & { kind: SetFieldKind } =>
      (SET_FIELD_KINDS as readonly string[]).includes(f.kind) &&
      !f.multiple &&
      !f.timeSpent &&
      defs.every(
        (d) => d.fields.includes(f.id) && d.custom?.some((c) => c.id === f.id && c.kind === f.kind),
      ),
  );
}

// Whether any selected card's type offers a built-in field: Assign, Priority and Labels show only then.
export function someOffer(items: readonly Item[], types: readonly ItemTypeDef[], field: string) {
  return items.some((it) => offers(types, it, field));
}
