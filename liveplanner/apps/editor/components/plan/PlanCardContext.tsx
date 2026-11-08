'use client';

// What a card on a board draws from (docs/specs/026-plan/blueprints/plan-board.md "Card redraws"): PlanBoardCard,
// PlanCardFace, card-file-drop and useAttachmentUpload read the plan's parts a card shows, kept by those parts in
// PlanProvider (PlanContext.tsx), so a plan change no card shows (a card picked up, someone's presence, an open item)
// redraws no card; on a 2,000-card board picking a card up redrew every one (plan-board.md "A drag stays smooth").
// The plan's cards are apart again (plan-items-store.ts): a card picks the little it reads of other cards, so a drop
// or an edit redraws the cards it changed, not every card.
import { createContext, use, type RefObject } from 'react';
import { usePlan, type PlanContextValue } from './PlanContext';

export type PlanCardData = Pick<
  PlanContextValue,
  'types' | 'statusNames' | 'statusPhases' | 'canEditCards' | 'itemsScope'
>;

export const PlanCardContext = createContext<PlanCardData | undefined>(undefined);
// The plan as it is now, for a card's handlers to read when they run (a file dropped on it), never in a render.
export const PlanLatestContext = createContext<RefObject<PlanContextValue | undefined> | null>(
  null,
);

// Outside a PlanProvider (a test's stand-in plan) the plan itself stands in: it carries every part. A card is either
// always inside a provider or never, so the hooks it calls never change between its renders.
export function usePlanCard(): PlanCardData | undefined {
  const card = use(PlanCardContext);
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  return card ?? usePlan() ?? undefined;
}

export function usePlanLatest(): RefObject<PlanContextValue | undefined> {
  const latest = use(PlanLatestContext);
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  return latest ?? { current: usePlan() ?? undefined };
}
