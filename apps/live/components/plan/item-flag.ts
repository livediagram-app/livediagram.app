import { isFlagged, type Item } from '@livediagram/items';
import { track } from '@/lib/telemetry';
import type { PlanContextValue } from './PlanContext';

// The flag's colour on a card face and in the item panel (docs/specs/026-plan/items.md "Flags").
export const FLAG_COLOUR = '#e11d48';

// Flag a card, or take its flag off: `flagged: true`, or the key removed. The card menu's and the item
// panel's Flag / Remove Flag.
export function toggleFlag(
  plan: Pick<PlanContextValue, 'patchItem' | 'announce'>,
  item: Item,
): void {
  const was = isFlagged(item);
  plan.patchItem(item.id, was ? { clear: ['flagged'] } : { set: { flagged: true } });
  plan.announce(was ? 'Flag removed' : 'Card flagged');
  track('Plan', 'Toggled', was ? 'FlagOff' : 'FlagOn');
}
