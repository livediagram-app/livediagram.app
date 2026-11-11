// Automations: a branch's related cards (docs/specs/026-plan/automations.md "For Related Cards"; blueprint
// automations.md "Phase 2"). From the card that started the rule: the cards a Card field of it points at (one field,
// or any), the cards blocking it and those it blocks (blocked-by.ts), its children (the cards whose Card field names
// its type and points at it, calculated-fields.ts), or every card a board's saved filter matches. Live cards only
// (not trashed or archived), never the card itself, in number order, at most AUTOMATION_BRANCH_CARDS_MAX. Pure.

import { isArchived, isTrashed } from '../board';
import { blockingIndexOf } from '../blocked-by';
import { childIndexOf, childrenOf } from '../calculated-fields';
import type { Item } from '../item';
import { linkedCardIds } from '../several-values';
import { typeIn } from '../type-catalogue';
import { holds, type ConditionContext } from './conditions';
import { AUTOMATION_BRANCH_CARDS_MAX, type AutomationRelated } from './types';

export interface RelatedCards {
  // The first AUTOMATION_BRANCH_CARDS_MAX, by number.
  cards: Item[];
  // How many there were in all.
  total: number;
}

const live = (it: Item | undefined): it is Item => !!it && !isTrashed(it) && !isArchived(it);

function linked(
  card: Item,
  field: string | undefined,
  ctx: ConditionContext,
  byId: Map<string, Item>,
) {
  const type = typeIn(ctx.outline.types, card.type);
  const out: Item[] = [];
  for (const f of type.custom ?? []) {
    if (f.kind !== 'card' || !type.fields.includes(f.id) || (field && f.id !== field)) continue;
    for (const id of linkedCardIds(card, f)) {
      const to = byId.get(id);
      if (to) out.push(to);
    }
  }
  return out;
}

function candidates(
  card: Item,
  related: AutomationRelated,
  items: readonly Item[],
  ctx: ConditionContext,
): Item[] {
  const types = ctx.outline.types;
  switch (related.kind) {
    case 'linked':
      return linked(card, related.field, ctx, new Map(items.map((i) => [i.id, i])));
    case 'blocked_by':
      return [...(blockingIndexOf(items, types, () => false).blockers.get(card.id) ?? [])];
    case 'blocking':
      return [...(blockingIndexOf(items, types, () => false).blocks.get(card.id) ?? [])];
    case 'children':
      return childrenOf(card, childIndexOf(items, types));
    case 'saved_filter': {
      const c = { kind: 'saved_filter' as const, tab: related.tab, filter: related.filter };
      return items.filter((it) => holds(c, { ...ctx, card: it }).ok);
    }
  }
}

// The card's related cards for a branch.
export function relatedCards(
  card: Item,
  related: AutomationRelated,
  items: readonly Item[],
  ctx: ConditionContext,
): RelatedCards {
  const seen = new Set<string>([card.id]);
  const all: Item[] = [];
  for (const it of candidates(card, related, items, ctx)) {
    if (seen.has(it.id) || !live(it)) continue;
    seen.add(it.id);
    all.push(it);
  }
  all.sort((a, b) => a.key - b.key);
  return { cards: all.slice(0, AUTOMATION_BRANCH_CARDS_MAX), total: all.length };
}
