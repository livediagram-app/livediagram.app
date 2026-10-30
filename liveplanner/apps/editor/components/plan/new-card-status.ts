// The status a card made off a board starts in (docs/specs/026-plan/item-types.md "An item type"): its type's Default
// State (its own, else its built-in one by name), else the first status its type uses. Shared by New {Type} in a
// Linked as section, a Gantt chart's Add card and a board's card type chips.
import { resolvedDefaultStatus, typeAllowsStatus, type ItemTypeDef } from '@liveplanner/items';

export function newCardStatus(type: ItemTypeDef, statusNames: ReadonlyMap<string, string>): string {
  return (
    resolvedDefaultStatus(type, statusNames) ??
    [...statusNames.keys()].find((st) => typeAllowsStatus(type, st)) ??
    'todo'
  );
}
