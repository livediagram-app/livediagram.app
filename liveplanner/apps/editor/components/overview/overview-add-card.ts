// The Overview's Add Card on a card type tile (docs/specs/026-plan/plan-overview.md "Card Types"): the card the type's
// first taking board would add from its header chip (chipClickCell), worked out from the tabs. Pure.
import {
  boardShowsType,
  projectBoard,
  typeIn,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import type { Tab } from '@liveplanner/project';
import { chipClickCell, type ChipCard } from '@/components/plan/card-type-chips';
import { boardsOf } from './overview-boards';

export function addCardOfType(
  tabs: readonly Tab[],
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[],
  typeId: string,
  statusNames: ReadonlyMap<string, string>,
): (ChipCard & { label: string }) | null {
  const board = boardsOf(tabs).find(
    (b) => !b.setup.archive && b.setup.columns.length > 0 && boardShowsType(b.setup, typeId, types),
  );
  if (!board) return null;
  const projection = projectBoard(board.setup, items, undefined, types, statusNames);
  const card = chipClickCell(board.setup, projection, types, typeId, statusNames);
  return card ? { ...card, label: typeIn(types, typeId).label } : null;
}
