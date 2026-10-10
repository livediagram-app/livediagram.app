// The card types the open tab's boards take (docs/specs/026-plan/plan-mode.md "The palette"), published by
// CanvasChrome for the active tab and read by the palette, which greys out a card tile no board would take. A
// module store: one value, set only when the reading changes, so the palette re-renders only then.
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  ITEM_TYPES,
  cardTileRefusal,
  cardTypesTakenKey,
  cardTypesTakenOnTab,
  normaliseBoardSetup,
  typeIn,
  type CardTypesTaken,
} from '@livediagram/items';
import type { Element } from '@livediagram/document';
import { usePlan } from '@/components/plan/PlanContext';

// Before any tab has published (a palette outside the editor): every type is taken, so nothing greys out.
let taken: CardTypesTaken = { kind: 'all' };
let key = 'all';
const listeners = new Set<() => void>();

export function setCardTypesTaken(next: CardTypesTaken): void {
  const k = cardTypesTakenKey(next);
  if (k === key) return;
  taken = next;
  key = k;
  for (const l of listeners) l();
}

export function getCardTypesTaken(): CardTypesTaken {
  return taken;
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

// CanvasChrome: publishes the active tab's reading as its elements change (cheap: its boards' set-ups only).
export function usePublishCardTypesTaken(elements: readonly Element[]): void {
  const reading = useMemo(
    () =>
      cardTypesTakenOnTab(
        elements
          .filter((e) => e.type === 'shape' && e.shape === 'plan-board')
          .map((e) => normaliseBoardSetup((e as { planBoard?: unknown }).planBoard)),
      ),
    [elements],
  );
  useEffect(() => setCardTypesTaken(reading), [reading]);
}

// A palette tile's action, when it is a card tile: the reason it is greyed out, or undefined when some board on
// the tab takes its type.
export function usePlanCardTileDisabled(
  action: { type: string; kind?: string; plan?: string } | undefined,
): { reason: string } | undefined {
  const current = useSyncExternalStore(subscribe, getCardTypesTaken, getCardTypesTaken);
  const plan = usePlan();
  if (action?.type !== 'shape' || action.kind !== 'plan-card' || !action.plan) return undefined;
  const label = typeIn(plan?.types ?? ITEM_TYPES, action.plan).label;
  const reason = cardTileRefusal(current, action.plan, label);
  return reason ? { reason } : undefined;
}
