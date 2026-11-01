// The plan's Blocked By lookup (docs/specs/026-plan/item-types.md "Blocked By"), made once per items change and
// shared by every card face, the item panel and the Gantt: a card reads its open blockers from a Map instead of
// scanning the plan. Kept per items map, and reused while the types and the plan-wide done columns keep their
// identity, so a board of 500 cards builds it once, not once per card.
import {
  blockingIndexOf,
  donePhase,
  hasBlocksFields,
  type BlockingIndex,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import type { PlanContextValue } from './PlanContext';

type Made = {
  types: readonly ItemTypeDef[];
  phases: PlanContextValue['statusPhases'];
  index: BlockingIndex;
};

const NONE: BlockingIndex = { blockers: new Map(), blocks: new Map(), open: new Map() };
const made = new WeakMap<ReadonlyMap<string, Item>, Made>();

export function planBlocking(
  plan: Pick<PlanContextValue, 'items' | 'types' | 'statusPhases'>,
): BlockingIndex {
  // A plan without a Blocked By field pays for nothing.
  if (!plan.items || !plan.types || !hasBlocksFields(plan.types)) return NONE;
  const had = made.get(plan.items);
  if (had && had.types === plan.types && had.phases === plan.statusPhases) return had.index;
  const index = blockingIndexOf(plan.items.values(), plan.types, donePhase(plan.statusPhases));
  made.set(plan.items, { types: plan.types, phases: plan.statusPhases, index });
  return index;
}
