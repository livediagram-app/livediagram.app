// A card target (docs/specs/026-plan/items.md "Card targets"): what something that makes cards names, a card type
// and a status, never a board. The boards that show such a card are worked out from every board of the plan: a live
// board (not an Archive) holding a column of the status and taking the type. Pure; a Form's destination and an Email
// to Board address both read it.
import { boardTakesType } from './board-setup';

/** What a card is made as. */
export type CardTarget = { typeId: string; status: string };

/** The parts of a board a target is judged against, so an agent's board outline serves too. */
export type TargetBoard = {
  addTypes?: string[] | undefined;
  archive?: boolean | undefined;
  columns: readonly { status: string }[];
};

// Whether a board takes a type, by boardTakesType's rule (a board naming none takes every type).
const takes = (board: TargetBoard, types: readonly { id: string }[], typeId: string): boolean =>
  boardTakesType(board.addTypes ? { addTypes: board.addTypes } : {}, types, typeId);

export type CardTargetProblem =
  'board_missing' | 'status_missing' | 'type_missing' | 'type_not_on_board';

const live = <B extends TargetBoard>(boards: readonly B[]): B[] => boards.filter((b) => !b.archive);

/** The live boards that show a `typeId` card in `status`, in the order given. */
export function boardsShowing<B extends TargetBoard>(
  boards: readonly B[],
  types: readonly { id: string }[],
  target: CardTarget,
): B[] {
  return live(boards).filter(
    (b) => b.columns.some((c) => c.status === target.status) && takes(b, types, target.typeId),
  );
}

/** The live boards that take `typeId`, whatever their columns. */
export function boardsTaking<B extends TargetBoard>(
  boards: readonly B[],
  types: readonly { id: string }[],
  typeId: string,
): B[] {
  return live(boards).filter((b) => takes(b, types, typeId));
}

/** Each column a `typeId` card can be seen in, once per status, in board then column order. */
export function targetColumns<C extends { status: string }>(
  boards: readonly (TargetBoard & { columns: readonly C[] })[],
  types: readonly { id: string }[],
  typeId: string,
): C[] {
  const seen = new Set<string>();
  const out: C[] = [];
  for (const board of boardsTaking(boards, types, typeId))
    for (const column of board.columns) {
      if (seen.has(column.status)) continue;
      seen.add(column.status);
      out.push(column);
    }
  return out;
}

/**
 * Why a card made as `target` would be seen on no board, or null when some board shows it: the plan has no live
 * board, none has a column of the status, the type is gone, or no board with that column takes the type. A status
 * no board has reads as its column removed only while some board still takes the type: when none does (the one
 * board that showed its cards was deleted, its columns with it), what is missing is a board for the type.
 */
export function cardTargetProblem(
  target: CardTarget,
  boards: readonly TargetBoard[],
  types: readonly { id: string }[],
): CardTargetProblem | null {
  const boardsLive = live(boards);
  if (boardsLive.length === 0) return 'board_missing';
  if (!boardsLive.some((b) => b.columns.some((c) => c.status === target.status)))
    return boardsTaking(boardsLive, types, target.typeId).length
      ? 'status_missing'
      : 'type_not_on_board';
  if (!types.some((t) => t.id === target.typeId)) return 'type_missing';
  return boardsShowing(boardsLive, types, target).length ? null : 'type_not_on_board';
}

/** "Bugs", "Bugs and All Cards", "Bugs, Triage and All Cards": the boards a card shows on, in words. */
export function boardNamesText(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
