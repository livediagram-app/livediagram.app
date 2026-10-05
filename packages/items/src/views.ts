// Text for an item: card accessible names, move announcements and the agents'
// board view (docs/specs/025-plan/plan-mode.md "Agents").

import type { Item } from './item';
import { itemAssignee, itemTitle } from './item';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import { typeIn } from './type-catalogue';
import { PRIORITY_LABELS, isPriority } from './fields';

export function itemKeyLabel(item: Pick<Item, 'key'>): string {
  return `#${item.key}`;
}

// "#12 Fix login, Bug, assigned to Sam, high priority"
export function itemAccessibleName(item: Item, types: readonly ItemTypeDef[] = ITEM_TYPES): string {
  const parts = [`${itemKeyLabel(item)} ${itemTitle(item)}`, typeIn(types, item.type).label];
  const who = itemAssignee(item);
  if (who) parts.push(`assigned to ${who.name}`);
  const p = item.fields['priority'];
  if (isPriority(p)) parts.push(`${PRIORITY_LABELS[p].toLowerCase()} priority`);
  return parts.join(', ');
}

// "#12 [bug] Fix login (@Sam, !high)"
export function itemSummary(item: Item): string {
  const extras: string[] = [];
  const who = itemAssignee(item);
  if (who) extras.push(`@${who.name}`);
  const p = item.fields['priority'];
  if (isPriority(p)) extras.push(`!${p}`);
  const tail = extras.length ? ` (${extras.join(', ')})` : '';
  return `${itemKeyLabel(item)} [${item.type}] ${itemTitle(item)}${tail}`;
}
