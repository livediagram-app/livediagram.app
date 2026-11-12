// Automations: the triggers worked out at run time (docs/specs/026-plan/automations.md "Triggers"; blueprint
// automations.md "The triggers after Phase 3"). A card's move or archive can set one off for another card: Card
// Unblocked runs on the cards it blocked once none of their blockers is open; Related Cards Done on the cards it belongs
// to (its parents, or the cards whose Card fields hold it) once all their related cards are done; Column Over Limit on
// the card that tipped its column past the limit. Read from the plan's cards as they are now. Pure.

import { isArchived, isTrashed } from '../board';
import { blockingIndexOf, blocksFieldsOf } from '../blocked-by';
import { childIndexOf, childrenOf } from '../calculated-fields';
import { itemStatus, type Item } from '../item';
import type { ItemTypeDef } from '../item-types';
import { linkedCardIds } from '../several-values';
import { typeIn } from '../type-catalogue';
import type { AutomationEvent } from './matches';
import type { AutomationTrigger } from './types';

export type DerivedTrigger = Extract<
  AutomationTrigger,
  { kind: 'card_unblocked' | 'related_done' | 'column_limit' }
>;

export const isDerivedTrigger = (t: AutomationTrigger): t is DerivedTrigger =>
  t.kind === 'card_unblocked' || t.kind === 'related_done' || t.kind === 'column_limit';

type IsDone = (status: string | undefined) => boolean;

const live = (it: Item | undefined): it is Item => !!it && !isTrashed(it) && !isArchived(it);

// Whether the event finished its card: moved from an open column into a done one.
const finished = (event: AutomationEvent, isDone: IsDone) =>
  event.kind === 'moved' && isDone(event.to) && !isDone(event.from);

// The cards a card's Card fields point at.
function pointsAt(
  card: Item,
  types: readonly ItemTypeDef[],
  byId: ReadonlyMap<string, Item>,
): Item[] {
  const type = typeIn(types, card.type);
  const out: Item[] = [];
  for (const f of type.custom ?? []) {
    if (f.kind !== 'card' || !type.fields.includes(f.id)) continue;
    for (const id of linkedCardIds(card, f)) {
      const to = byId.get(id);
      if (to && to.id !== card.id && !out.includes(to)) out.push(to);
    }
  }
  return out;
}

/** The cards a derived trigger runs on for `event`, in number order: none when it does not fire. */
export function derivedTargets(
  trigger: DerivedTrigger,
  event: AutomationEvent,
  items: readonly Item[],
  types: readonly ItemTypeDef[],
  isDone: IsDone,
): Item[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const card = byId.get(event.cardId);
  if (!card) return [];
  switch (trigger.kind) {
    case 'column_limit': {
      if (!live(card) || itemStatus(card) !== trigger.status) return [];
      const count = items.filter((i) => live(i) && itemStatus(i) === trigger.status).length;
      // Exactly one past: the card that tipped it, once each time the column goes over.
      return count === trigger.limit + 1 ? [card] : [];
    }
    case 'card_unblocked': {
      if (!(finished(event, isDone) || event.kind === 'archived')) return [];
      // The cards whose Blocks fields name it (an archived blocker is out of the index, so asked directly), now with
      // no open blocker.
      const index = blockingIndexOf(items, types, isDone);
      return items.filter(
        (b) =>
          live(b) &&
          b.id !== card.id &&
          (index.open.get(b.id) ?? 0) === 0 &&
          blocksFieldsOf(typeIn(types, b.type)).some((f) => linkedCardIds(b, f).includes(card.id)),
      );
    }
    case 'related_done': {
      if (!finished(event, isDone)) return [];
      const done = (i: Item) => isDone(itemStatus(i));
      const out: Item[] = [];
      if (trigger.related === 'children') {
        const index = childIndexOf(items, types);
        for (const parent of pointsAt(card, types, byId)) {
          if (!live(parent) || done(parent)) continue;
          const kids = childrenOf(parent, index).filter(live);
          if (kids.some((k) => k.id === card.id) && kids.every(done)) out.push(parent);
        }
      } else {
        for (const holder of items) {
          if (!live(holder) || done(holder) || holder.id === card.id) continue;
          const linked = pointsAt(holder, types, byId).filter(live);
          if (linked.some((l) => l.id === card.id) && linked.every(done)) out.push(holder);
        }
      }
      return out.sort((a, b) => a.key - b.key);
    }
  }
}
