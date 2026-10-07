// Links between cards (docs/specs/026-plan/item-types.md "Card fields"): the built-in Parent (a card under a Project)
// and every Card field a type adds (an Objective's Owner, linking to a Person). One way to read them: the cards a
// link field may point at, and, for a card, the groups of cards that point at it. Pure.
import type { Item } from './item';
import { itemTitle } from './item';
import { isArchived, isTrashed } from './board';
import type { ItemTypeDef } from './item-types';

// The built-in link: a card's Parent, always a Project.
export const PARENT_FIELD = 'parent';
export const PARENT_LINK_TYPE = 'project';

// A link field as a card's panel sees it: the field, its label, and the card type it points at.
export interface LinkField {
  id: string;
  label: string;
  linkType: string;
}

// The link fields a type offers: Parent when it has it, then its Card fields, in the type's field order.
export function linkFieldsOfType(type: ItemTypeDef): LinkField[] {
  const out: LinkField[] = [];
  for (const f of type.fields) {
    if (f === PARENT_FIELD) out.push({ id: f, label: 'Parent', linkType: PARENT_LINK_TYPE });
    const c = type.custom?.find((x) => x.id === f);
    if (c?.kind === 'card' && c.linkType)
      out.push({ id: c.id, label: c.label, linkType: c.linkType });
  }
  return out;
}

// The cards a link field may point at: live (not trashed or archived) cards of its type, in number order, never
// the card itself.
export function linkCandidates(items: Iterable<Item>, linkType: string, selfId?: string): Item[] {
  const out: Item[] = [];
  for (const it of items)
    if (it.type === linkType && it.id !== selfId && !isTrashed(it) && !isArchived(it)) out.push(it);
  return out.sort((a, b) => a.key - b.key);
}

// One group of cards pointing at a card: through which field, named how, from which types.
export interface LinkedGroup {
  fieldId: string;
  label: string;
  // The types whose cards link here through this field (Parent: any type offering it).
  fromTypes: string[];
  cards: Item[];
}

// The cards that point at `target`, grouped by the field they point through: Parent first (only when the target
// is a Project), then each Card field whose type links to the target's type, in catalogue order. A group is
// listed even with no cards, so the panel can offer to make the first; trashed cards are left out.
export function linkedCardsOf(
  target: Item,
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[],
): LinkedGroup[] {
  const groups: LinkedGroup[] = [];
  const byField = new Map<string, LinkedGroup>();
  if (target.type === PARENT_LINK_TYPE) {
    const g: LinkedGroup = { fieldId: PARENT_FIELD, label: 'Parent', fromTypes: [], cards: [] };
    for (const t of types) if (t.fields.includes(PARENT_FIELD)) g.fromTypes.push(t.id);
    groups.push(g);
    byField.set(PARENT_FIELD, g);
  }
  for (const t of types)
    for (const c of t.custom ?? []) {
      if (c.kind !== 'card' || c.linkType !== target.type || !t.fields.includes(c.id)) continue;
      let g = byField.get(c.id);
      if (!g) {
        g = { fieldId: c.id, label: c.label, fromTypes: [], cards: [] };
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
        it.fields[g.fieldId] === target.id &&
        (g.fieldId === PARENT_FIELD || g.fromTypes.includes(it.type))
      )
        g.cards.push(it);
  }
  for (const g of groups) g.cards.sort((a, b) => a.key - b.key);
  return groups;
}

// A linked card as one line ("#3 Sam Reed"), or "Missing card" for a value whose card is gone.
export function linkText(items: ReadonlyMap<string, Item>, value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  const card = items.get(value);
  return card ? itemTitle(card) : 'Missing card';
}
