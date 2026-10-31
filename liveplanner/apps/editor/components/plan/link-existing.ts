import { linkedValue, type Item, type LinkedGroup } from '@liveplanner/items';
import { track } from '@/lib/telemetry';
import type { PlanContextValue } from './PlanContext';

// Link Existing's write (docs/specs/026-plan/item-types.md "Link Existing"): the picked card's field now names the
// open card. One ordinary card write through `patchItem`, the same as choosing it in that card's own field, so it
// undoes, syncs live, keeps to the plan's permissions and works in a This Browser plan alike. False: the card is
// gone or the write was refused (nothing announced). `moved`: it linked to another card before.
export async function linkExistingCard(
  plan: Pick<PlanContextValue, 'items' | 'patchItem' | 'announce'>,
  target: Item,
  group: Pick<LinkedGroup, 'fieldId' | 'label' | 'several'>,
  cardId: string,
  moved: boolean,
): Promise<boolean> {
  const card = plan.items.get(cardId);
  if (!card || cardId === target.id) return false;
  // A field that holds several gains the open card at the end of its list (item-types.md "Holds Several").
  const done = await plan.patchItem(cardId, {
    set: { [group.fieldId]: linkedValue(card, group, target.id) },
  });
  if (!done) return false;
  plan.announce(`Linked #${card.key} as ${group.label}`);
  track('Plan', 'Linked', moved ? 'LinkedCardMoved' : 'LinkedCard');
  return true;
}
