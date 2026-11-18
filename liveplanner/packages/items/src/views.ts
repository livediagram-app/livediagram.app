// Text for an item: card accessible names, move announcements and the agents'
// board view (docs/specs/026-plan/plan-mode.md "Agents").

import type { Item } from './item';
import { itemAssignee, itemTitle } from './item';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import { typeIn } from './type-catalogue';
import { PRIORITY_LABELS, isPriority } from './fields';
import { cardRef, cardRefTitle } from './card-prefix';

// "WI-12 Fix login" ("#12 Fix login" with no types to read its prefix from: item-types.md "Card number prefixes"), or
// just the title for a card with no number of its own: a tour's practice card is key 0
// (docs/specs/026-plan/plan-tour.md "Practice cards"), never read out as "#0".
export function itemNumberedTitle(item: Item, types?: readonly ItemTypeDef[]): string {
  return cardRefTitle(item, itemTitle(item), types);
}

// "WI-12 Fix login, Work Item, assigned to Sam, high priority"
export function itemAccessibleName(item: Item, types: readonly ItemTypeDef[] = ITEM_TYPES): string {
  const parts = [itemNumberedTitle(item, types), typeIn(types, item.type).label];
  const who = itemAssignee(item);
  if (who) parts.push(`assigned to ${who.name}`);
  const p = item.fields['priority'];
  if (isPriority(p)) parts.push(`${PRIORITY_LABELS[p].toLowerCase()} priority`);
  return parts.join(', ');
}

// "B-12 [bug] Fix login (@Sam, !high)"; "#12 [bug] ..." with no types to read its prefix from.
export function itemSummary(item: Item, types?: readonly ItemTypeDef[]): string {
  const extras: string[] = [];
  const who = itemAssignee(item);
  if (who) extras.push(`@${who.name}`);
  const p = item.fields['priority'];
  if (isPriority(p)) extras.push(`!${p}`);
  const tail = extras.length ? ` (${extras.join(', ')})` : '';
  return `${cardRef(item, types) || `#${item.key}`} [${item.type}] ${itemTitle(item)}${tail}`;
}
