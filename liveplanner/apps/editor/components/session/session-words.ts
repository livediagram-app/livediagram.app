// A decision in words (docs/specs/026-plan/session-tabs.md "The action bar", "Bug Triage"): a decided card's note
// after its outcome (a Close's duplicate and reason) and Undo Last's name for the latest decision. Pure.
import { cardRefOrKey, type Item, type ItemTypeDef } from '@liveplanner/items';
import type { SessionDecision } from '@liveplanner/project';
import { OUTCOME_LOOKS } from './session-kinds';

// A card's number as people see it ("BUG-12"), or words for one since deleted.
export const refOf = (
  id: string,
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[],
): string => {
  const card = items.get(id);
  return card ? cardRefOrKey(card, types) : 'a deleted card';
};

// What a decided card's line adds after its outcome: "Duplicate of BUG-12 · Can't reproduce", or null.
export function decisionNote(
  d: SessionDecision,
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[],
): string | null {
  const parts: string[] = [];
  if (d.duplicateOf) parts.push(`Duplicate of ${refOf(d.duplicateOf, items, types)}`);
  if (d.reason) parts.push(d.reason);
  return parts.length ? parts.join(' · ') : null;
}

// Undo Last's name for the latest decision: "Closed BUG-33".
export function undoLabel(
  itemId: string,
  d: SessionDecision,
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[],
): string {
  return `${OUTCOME_LOOKS[d.outcome].done} ${refOf(itemId, items, types)}`;
}
