// Links between cards (docs/specs/026-plan/item-types.md "Card fields"): every Card field a type has, Parent (Task's,
// linking to Projects) among them, and any a type adds (an Objective's Owner, linking to a Person). One way to read them: the cards a
// link field may point at, and, for a card, the groups of cards that point at it. Pure.
import type { Item } from './item';
import { itemTitle } from './item';
import { isArchived, isTrashed, linkedCard } from './board';
import { linkTypesOf, type ItemTypeDef } from './item-types';
import { fieldCardIds, holdsSeveral } from './several-values';

// A link field as a card's panel sees it: the field, its label, the card types it points at, and whether it links to
// several cards (docs/specs/026-plan/item-types.md "Holds Several").
export interface LinkField {
  id: string;
  label: string;
  linkTypes: readonly string[];
  several?: boolean;
}

// A link field's stored value read as several-values.ts reads it.
const linkField = (several: boolean | undefined) => ({ kind: 'card' as const, multiple: several });

// The link fields a type offers: its Card fields, in the type's field order.
export function linkFieldsOfType(type: ItemTypeDef): LinkField[] {
  const out: LinkField[] = [];
  for (const f of type.fields) {
    const c = type.custom?.find((x) => x.id === f);
    const linkTypes = c?.kind === 'card' ? linkTypesOf(c) : [];
    if (c && linkTypes.length)
      out.push({
        id: c.id,
        label: c.label,
        linkTypes,
        ...(holdsSeveral(c) ? { several: true } : {}),
      });
  }
  return out;
}

// The cards a link field may point at: live (not trashed or archived) cards of any of its types, in number order,
// never the card itself.
export function linkCandidates(
  items: Iterable<Item>,
  linkTypes: readonly string[],
  selfId?: string,
): Item[] {
  const out: Item[] = [];
  for (const it of items)
    if (linkTypes.includes(it.type) && it.id !== selfId && !isTrashed(it) && !isArchived(it))
      out.push(it);
  return out.sort((a, b) => a.key - b.key);
}

// One group of cards pointing at a card: through which field, named how, from which types.
export interface LinkedGroup {
  fieldId: string;
  label: string;
  // The types whose cards link here through this field.
  fromTypes: string[];
  cards: Item[];
  // The field holds several cards (as the first type offering it has it): a card links here when its list holds this
  // card, and Link Existing adds to that list rather than moving a link.
  several?: boolean;
}

// The cards that point at `target`, grouped by the field they point through: each Card field whose type links to
// the target's type (Parent, for a Project), in catalogue order. A group is
// listed even with no cards, so the panel can offer to make the first; trashed cards are left out.
export function linkedCardsOf(
  target: Item,
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[],
): LinkedGroup[] {
  const groups: LinkedGroup[] = [];
  const byField = new Map<string, LinkedGroup>();
  for (const t of types)
    for (const c of t.custom ?? []) {
      if (c.kind !== 'card' || !linkTypesOf(c).includes(target.type) || !t.fields.includes(c.id))
        continue;
      let g = byField.get(c.id);
      if (!g) {
        g = {
          fieldId: c.id,
          label: c.label,
          fromTypes: [],
          cards: [],
          ...(holdsSeveral(c) ? { several: true } : {}),
        };
        groups.push(g);
        byField.set(c.id, g);
      }
      if (!g.fromTypes.includes(t.id)) g.fromTypes.push(t.id);
    }
  if (groups.length === 0) return groups;
  for (const it of items.values()) {
    if (it.id === target.id || isTrashed(it)) continue;
    for (const g of groups)
      if (
        g.fromTypes.includes(it.type) &&
        fieldCardIds(linkField(g.several), it.fields[g.fieldId]).includes(target.id)
      )
        g.cards.push(it);
  }
  for (const g of groups) g.cards.sort((a, b) => a.key - b.key);
  return groups;
}

// What Link Existing offers for a group (docs/specs/026-plan/item-types.md "Link Existing"): the live (not trashed or
// archived) cards of the group's types, never the target itself nor a card already linked to it through the
// group's field. Each says where it links now: `elsewhere` is the card id its field holds when that is another
// card (gone or not), so picking it moves the link; a field that holds several never moves one (picking adds to the
// list), so its cards have none.
export interface LinkableCard {
  card: Item;
  elsewhere: string | null;
}

export function linkableCards(
  target: Item,
  group: Pick<LinkedGroup, 'fieldId' | 'fromTypes' | 'several'>,
  items: Iterable<Item>,
): LinkableCard[] {
  const out: LinkableCard[] = [];
  for (const it of items) {
    if (it.id === target.id || !group.fromTypes.includes(it.type)) continue;
    if (isTrashed(it) || isArchived(it)) continue;
    const ids = fieldCardIds(linkField(group.several), it.fields[group.fieldId]);
    if (ids.includes(target.id)) continue;
    out.push({ card: it, elsewhere: group.several ? null : (ids[0] ?? null) });
  }
  return out;
}

// What linking `card` to `target` through a group's field stores on `card` (Link Existing, New {Type}): the target,
// or, for a field that holds several, the card's list with the target added at the end.
export function linkedValue(
  card: Pick<Item, 'fields'>,
  group: Pick<LinkedGroup, 'fieldId' | 'several'>,
  targetId: string,
): string | string[] {
  if (!group.several) return targetId;
  const ids = fieldCardIds(linkField(true), card.fields[group.fieldId]);
  return ids.includes(targetId) ? ids : [...ids, targetId];
}

// A linked card as one line ("#3 Sam Reed"), or "Missing card" for a value whose card is gone.
export function linkText(items: ReadonlyMap<string, Item>, value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  const card = linkedCard(items, value);
  return card ? itemTitle(card) : 'Missing card';
}
