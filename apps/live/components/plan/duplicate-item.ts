import type { Item } from '@livediagram/items';
import type { PlanContextValue } from './PlanContext';

// A copy of a card right after it, in its column, without its votes: they were for the original
// (docs/specs/026-plan/plan-board.md). The card menu's and the item panel's Duplicate.
export function duplicateItem(
  plan: Pick<PlanContextValue, 'addItem' | 'announce'>,
  item: Item,
): void {
  const { votes: _votes, ...fields } = item.fields;
  void _votes;
  const status = typeof item.fields['status'] === 'string' ? item.fields['status'] : '';
  plan.addItem({ type: item.type, fields, status, after: item.id });
  plan.announce('Card duplicated');
}
