'use client';

// Whether Plan offers its session tools (docs/specs/012-collaboration/session-tools.md "The Session strip"): Timer and
// Vote belong to boards made for them, those whose card types carry a Votes field (a Retro's Notes and Ideas, or a
// type someone gave Votes). Never on a Dashboard tab. A vote or timer already running keeps its button, so it can be
// seen and stopped.
import { useMemo } from 'react';
import {
  ITEM_TYPES,
  boardAddTypes,
  normaliseBoardSetup,
  type ItemTypeDef,
} from '@livepages/items';
import type { Element } from '@livepages/document';
import { usePlan } from '@/components/plan/PlanContext';
import { usePlanTabKind } from './plan-cover-store';

// Some board on the tab takes a card type with a Votes field (an Archive board takes none).
export function boardsTakeVotes(
  elements: readonly Element[],
  types: readonly ItemTypeDef[],
): boolean {
  for (const el of elements) {
    if (el.type !== 'shape' || el.shape !== 'plan-board') continue;
    const setup = normaliseBoardSetup((el as { planBoard?: unknown }).planBoard);
    if (!setup || setup.archive) continue;
    if (boardAddTypes(setup, types).some((t) => t.fields.includes('votes'))) return true;
  }
  return false;
}

export function usePlanVoting(elements: readonly Element[], running: boolean): boolean {
  const kind = usePlanTabKind();
  const types = usePlan()?.types ?? ITEM_TYPES;
  const takes = useMemo(
    () => kind !== 'dashboard' && boardsTakeVotes(elements, types),
    [kind, elements, types],
  );
  return running || takes;
}
