// A card type's left-out statuses on a board (docs/specs/026-plan/item-types.md "An item type"): the refusal a card
// of `typeId` meets moving (or being made) into `status`, named by the board's column, or null when the type uses
// the status. Shared by drags, the palette, keyboard moves and quick add.
import {
  itemStatus,
  statusRefusal,
  typeAllowsStatus,
  typeIn,
  type Item,
  type ItemTypeDef,
} from '@livediagram/items';

export function typeStatusRefusal(
  types: readonly ItemTypeDef[],
  typeId: string,
  status: string | null | undefined,
  statusName: (status: string) => string,
): string | null {
  if (!status) return null;
  const type = typeIn(types, typeId);
  return typeAllowsStatus(type, status) ? null : statusRefusal(type.label, statusName(status));
}

// The ids of `items` that stay put when all are moved into `status` (a removed column's cards): those whose type
// leaves `status` out, unless they are in it already.
export function cardsMovingRefused(
  items: readonly Pick<Item, 'id' | 'type' | 'fields'>[],
  types: readonly ItemTypeDef[],
  status: string,
): Set<string> {
  const stay = new Set<string>();
  for (const it of items)
    if (itemStatus(it) !== status && !typeAllowsStatus(typeIn(types, it.type), status))
      stay.add(it.id);
  return stay;
}

// What is announced when some of a removed column's cards could not move: one line for them all.
export function cardsStayedMessage(count: number, statusName: string): string {
  return count === 1
    ? `1 card stayed: its type can't be ${statusName}`
    : `${count} cards stayed: their types can't be ${statusName}`;
}

// The refusal a card meets moving to `to` (its status, and the type a swimlane by type gives it), or null. Only a
// change of status is refused: a card already in a left-out status may stay, be reordered there and change lanes,
// as the api lets it (docs/specs/026-plan/item-types.md "An item type").
export function moveStatusRefusal(
  types: readonly ItemTypeDef[],
  item: Pick<Item, 'type' | 'fields'>,
  to: { status?: string | null; type?: string },
  statusName: (status: string) => string,
): string | null {
  if (!to.status || to.status === itemStatus(item)) return null;
  return typeStatusRefusal(types, to.type ?? item.type, to.status, statusName);
}
