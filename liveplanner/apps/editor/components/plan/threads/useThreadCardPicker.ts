'use client';

// What Add Thread to Card offers (docs/specs/026-plan/items.md "Where it shows"): this plan's live cards, and the
// person's other plans, each read only when opened (its grant first, for the role: a plan they may only view offers
// no card, then its cards). A search narrows both by a card's number, title or type and a plan's name. Pure parts
// (`pickCardsOf`, `matchesPick`) are exported for the tests.

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ITEM_TYPES,
  isArchived,
  isTrashed,
  itemTitle,
  typeIn,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import type { CardThread } from '@liveplanner/project';
import { fetchItems } from '@/lib/api/items';
import { planGrant } from '@/lib/api/plan-grants';
import type { ThreadPlanChoice } from './CardThreadsContext';

// Cards a list draws until a search narrows it.
export const PICK_CARDS_SHOWN = 50;

export type PickCard = {
  projectId: string;
  itemId: string;
  key: number;
  title: string;
  typeLabel: string;
  glyph: string | undefined;
  color: string | undefined;
  updatedAt: number;
  // The thread is on it already.
  onThread: boolean;
};

export type PlanPick =
  | { status: 'loading' }
  | { status: 'view' }
  | { status: 'error' }
  | { status: 'ready'; cards: PickCard[] };

/** A plan's live cards (neither archived nor in the Trash) as the picker lists them, newest change first. */
export function pickCardsOf(
  items: Iterable<Item>,
  projectId: string,
  types: readonly ItemTypeDef[],
  thread: Pick<CardThread, 'cards'>,
): PickCard[] {
  const on = new Set(thread.cards.filter((c) => c.projectId === projectId).map((c) => c.itemId));
  const out: PickCard[] = [];
  for (const item of items) {
    if (isArchived(item) || isTrashed(item)) continue;
    const type = typeIn(types, item.type);
    out.push({
      projectId,
      itemId: item.id,
      key: item.key,
      title: itemTitle(item) || 'Untitled',
      typeLabel: type.label,
      glyph: type.glyph,
      color: type.color,
      updatedAt: item.updatedAt,
      onThread: on.has(item.id),
    });
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Whether a card matches the search: its number (`12`, `#12`), its title or its type, case aside. */
export function matchesPick(card: PickCard, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const num = q.startsWith('#') ? q.slice(1) : q;
  if (/^\d+$/.test(num)) return String(card.key) === num || card.title.toLowerCase().includes(q);
  return card.title.toLowerCase().includes(q) || card.typeLabel.toLowerCase().includes(q);
}

export function useThreadCardPicker({
  thread,
  ownerId,
  localItems,
  localTypes,
  projectId,
  otherPlans,
  offline,
}: {
  thread: CardThread;
  ownerId: string;
  localItems: ReadonlyMap<string, Item>;
  localTypes: readonly ItemTypeDef[];
  projectId: string;
  otherPlans: readonly ThreadPlanChoice[];
  // A This Browser plan offers no other plan (its threads reach none).
  offline: boolean;
}) {
  const [query, setQuery] = useState('');
  const [picks, setPicks] = useState<ReadonlyMap<string, PlanPick>>(() => new Map());
  const asked = useRef(new Set<string>());
  const local = useMemo(
    () => pickCardsOf(localItems.values(), projectId, localTypes, thread),
    [localItems, projectId, localTypes, thread],
  );
  const plans = useMemo(
    () => (offline ? [] : otherPlans.filter((p) => p.id !== projectId)),
    [offline, otherPlans, projectId],
  );

  const openPlan = useCallback(
    (planId: string) => {
      if (asked.current.has(planId)) return;
      asked.current.add(planId);
      const put = (pick: PlanPick) => setPicks((prev) => new Map(prev).set(planId, pick));
      put({ status: 'loading' });
      void (async () => {
        try {
          const grant = await planGrant(planId);
          if (!grant) return put({ status: 'error' });
          // Only a Participant or an Editor of the whole plan changes its cards.
          if (grant.level === 'view' || grant.tabId !== null) return put({ status: 'view' });
          const store = await fetchItems({ ownerId, projectId: planId, shareCode: null, tabId: null });
          // Another plan's own card types are its own; the built-in ones name its cards well enough here.
          put({ status: 'ready', cards: pickCardsOf(store.items, planId, ITEM_TYPES, thread) });
        } catch (err) {
          console.warn('[threads] picker.plan.failed', { error: String(err) });
          asked.current.delete(planId);
          put({ status: 'error' });
        }
      })();
    },
    [ownerId, thread],
  );

  const q = query.trim().toLowerCase();
  const shownLocal = useMemo(() => {
    const matched = local.filter((c) => matchesPick(c, q));
    return q ? matched : matched.slice(0, PICK_CARDS_SHOWN);
  }, [local, q]);
  // A plan is listed when its name matches, or (once read) any of its cards does.
  const shownPlans = useMemo(
    () =>
      plans.filter((p) => {
        if (!q) return true;
        if ((p.name || 'Untitled plan').toLowerCase().includes(q)) return true;
        const pick = picks.get(p.id);
        return pick?.status === 'ready' && pick.cards.some((c) => matchesPick(c, q));
      }),
    [plans, picks, q],
  );
  const cardsOf = useCallback(
    (planId: string): PickCard[] => {
      const pick = picks.get(planId);
      if (pick?.status !== 'ready') return [];
      const plan = plans.find((p) => p.id === planId);
      const nameMatches = !!plan && (plan.name || '').toLowerCase().includes(q);
      const matched = q && !nameMatches ? pick.cards.filter((c) => matchesPick(c, q)) : pick.cards;
      return q ? matched : matched.slice(0, PICK_CARDS_SHOWN);
    },
    [picks, plans, q],
  );

  return {
    query,
    setQuery,
    local,
    shownLocal,
    plans,
    shownPlans,
    picks,
    openPlan,
    cardsOf,
  };
}
