import { isTimeSpent, unlinkedFields, type Item } from '@liveplanner/items';
import type { PlanContextValue } from './PlanContext';

// A copy of a card right after it, in its column, without its votes: they were for the original
// (docs/specs/026-plan/plan-board.md), without a linked card's link: the copy is a card of its own
// (docs/specs/026-plan/linked-boards.md), and without its tracked time: the copy's time is its own
// (docs/specs/026-plan/item-types.md "Time Spent"). The card menu's and the item panel's Duplicate.
export function duplicateItem(
  plan: Pick<PlanContextValue, 'addItem' | 'announce'> &
    Partial<Pick<PlanContextValue, 'itemTypes'>>,
  item: Item,
): void {
  const { votes: _votes, ...fields } = unlinkedFields(item.fields);
  void _votes;
  const type = plan.itemTypes?.types.find((t) => t.id === item.type);
  for (const f of type?.custom ?? []) if (isTimeSpent(f)) delete fields[f.id];
  const status = typeof item.fields['status'] === 'string' ? item.fields['status'] : '';
  void plan.addItem({ type: item.type, fields, status, after: item.id });
  plan.announce('Card duplicated');
}
