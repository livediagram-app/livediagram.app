// The card types the card panel's Card Type picker offers (docs/specs/026-plan/plan-board.md "The types it offers"):
// those the card's boards take (every board naming its status as a column), always with the card's own type, in
// catalogue order. A board taking every type, or no board naming the status, offers the whole catalogue. Pure.
import { itemStatus, type BoardStatusTypes, type Item, type ItemTypeDef } from '@liveplanner/items';

export function typeChoices(
  types: readonly ItemTypeDef[],
  statusTypes: BoardStatusTypes,
  item: Pick<Item, 'type' | 'fields'>,
): readonly ItemTypeDef[] {
  const status = itemStatus(item);
  const shown = status ? statusTypes.get(status) : undefined;
  if (shown === undefined || shown === 'all') return types;
  return types.filter((t) => t.id === item.type || shown.has(t.id));
}

// Whether the picker has anything to choose: another type than the card's own.
export const hasTypeChoice = (choices: readonly ItemTypeDef[], current: string): boolean =>
  choices.some((t) => t.id !== current);
