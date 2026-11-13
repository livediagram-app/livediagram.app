// Automations: the triggers worked out at run time (docs/specs/026-plan/automations.md "Triggers"; blueprint
// automations.md "The triggers after Phase 3"). A card's move or archive can set one off for another card: Card
// Unblocked runs on the cards it blocked once none of their blockers is open; Related Cards Done on the cards it belongs
// to (its parents, or the cards whose Card fields hold it) once all their related cards are done; Column Over Limit on
// the card that tipped its column past the limit. Read from the plan's cards as they are now. Pure.

import { isArchived, isTrashed } from '../board';
import { blockingIndexOf, blocksFieldsOf } from '../blocked-by';
import { childIndexOf, childrenOf } from '../calculated-fields';
import { itemStatus, type Item } from '../item';
import { itemStatusSince } from '../status-since';
import type { ItemTypeDef } from '../item-types';
import { linkedCardIds } from '../several-values';
import { typeIn } from '../type-catalogue';
import type { AutomationEvent } from './matches';
import { AUTOMATION_DERIVED_CARDS_MAX, type AutomationTrigger } from './types';

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

/** The cards a derived trigger runs on for `event`, in number order, at most AUTOMATION_DERIVED_CARDS_MAX: none when
 *  it does not fire. A blocker of 2,000 cards would otherwise run each of 50 rules 2,000 times in one wake. */
export function derivedTargets(
  trigger: DerivedTrigger,
  event: AutomationEvent,
  items: readonly Item[],
  types: readonly ItemTypeDef[],
  isDone: IsDone,
): Item[] {
  return allTargets(trigger, event, items, types, isDone)
    .sort((a, b) => a.key - b.key)
    .slice(0, AUTOMATION_DERIVED_CARDS_MAX);
}

function allTargets(
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
      const column = items.filter((i) => live(i) && itemStatus(i) === trigger.status);
      if (column.length <= trigger.limit) return [];
      // Exactly one past: the card that tipped it, once each time the column goes over. Several in before the wake
      // (three into a column of one): the card that arrived one past the limit, by when each entered the column.
      if (column.length === trigger.limit + 1) return [card];
      const byArrival = column.sort(
        (a, b) => itemStatusSince(a) - itemStatusSince(b) || a.key - b.key,
      );
      return byArrival[trigger.limit] === card ? [card] : [];
    }
    case 'card_unblocked': {
      // Archiving frees what it blocked only when it was still open: a done blocker unblocked them when it finished.
      const freed =
        finished(event, isDone) || (event.kind === 'archived' && !isDone(itemStatus(card)));
      if (!freed) return [];
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
      return out;
    }
  }
}

/** The moment each target's trigger reached, as the plan's cards now stand: the cards it was worked out from (the
 *  target's blockers, its children or the cards it links to, each at its rev; the column's cards, by id alone, as the
 *  rule's own write to the card that tipped it moves its rev on). Two events a wake reads against the same cards (a
 *  group move, two moves before the wake) reach the same moment, so the rule runs once; a related card changed since
 *  makes a new one. */
export function derivedMoments(
  trigger: DerivedTrigger,
  targets: readonly Item[],
  items: readonly Item[],
  types: readonly ItemTypeDef[],
): string[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const index =
    trigger.kind === 'related_done' && trigger.related === 'children'
      ? childIndexOf(items, types)
      : null;
  const moment = (cards: readonly Item[], revs = true) =>
    cards
      .map((c) => (revs ? `${c.id}@${c.rev}` : c.id))
      .sort()
      .join(',');
  return targets.map((target) => {
    switch (trigger.kind) {
      case 'column_limit':
        return moment(
          items.filter((i) => live(i) && itemStatus(i) === trigger.status),
          false,
        );
      case 'card_unblocked':
        return moment(
          blocksFieldsOf(typeIn(types, target.type))
            .flatMap((f) => linkedCardIds(target, f))
            .flatMap((id) => byId.get(id) ?? []),
        );
      case 'related_done':
        return moment(
          (index ? childrenOf(target, index) : pointsAt(target, types, byId)).filter(live),
        );
    }
  });
}
