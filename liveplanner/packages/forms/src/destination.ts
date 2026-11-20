// Whether a form's destination still holds (docs/specs/030-forms/forms.md "Publishing and the form link"): its card
// type, and a board of the plan that shows that type in its status (a card target, @liveplanner/items). No one board
// is named: deleting a board breaks nothing while another shows the card. One rule for the builder (Publish Form, the
// paused notice) and the api (every response).
import {
  boardsShowing,
  cardTargetProblem,
  type ItemTypeDef,
  type TargetBoard,
} from '@liveplanner/items';
import type { FormDestination, FormSheetDestination } from './model';

export type DestinationProblem =
  | 'no_destination'
  | 'board_missing'
  | 'status_missing'
  | 'type_missing'
  | 'type_not_on_board'
  | 'sheet_missing';

// What the builder says for each problem.
export const DESTINATION_PROBLEM_TEXT: Readonly<Record<DestinationProblem, string>> = {
  no_destination: 'Choose where responses go.',
  board_missing: 'No board is left to show its cards. Add a board, or choose where responses go.',
  status_missing: 'Its column was removed. Choose where responses go.',
  type_missing: 'Its card type was removed. Choose where responses go.',
  type_not_on_board:
    'No board shows its cards, so nobody would see them. Add a board, or choose where responses go.',
  sheet_missing: 'Its sheet was removed. Choose where responses go.',
};

// A Sheet destination's problem (docs/specs/030-forms/forms.md "Responses to a Sheet"): its sheet no longer on its tab.
// `sheets`: the project's sheets, each with its tab.
export function sheetDestinationProblem(
  sheet: FormSheetDestination,
  sheets: readonly FormSheetDestination[],
): DestinationProblem | null {
  return sheets.some((s) => s.sheetId === sheet.sheetId && s.tabId === sheet.tabId)
    ? null
    : 'sheet_missing';
}

// `boards`: every board of the plan (only their columns, the types they take and whether they are an Archive are
// read, so an agent's board outline serves too).
export function destinationProblem(
  destination: FormDestination | undefined,
  boards: readonly TargetBoard[],
  types: readonly ItemTypeDef[],
): DestinationProblem | null {
  if (!destination) return 'no_destination';
  return cardTargetProblem(destination, boards, types);
}

// The board a destination is read back on, opened to and drawn as: the first that shows its cards, one on the tab it
// was last seen on (`tabId`) before any other. Undefined when no board shows them.
export function destinationHome<B extends TargetBoard & { tabId?: string | undefined }>(
  destination: Pick<FormDestination, 'typeId' | 'status' | 'tabId'> | undefined,
  boards: readonly B[],
  types: readonly ItemTypeDef[],
): B | undefined {
  if (!destination) return undefined;
  const showing = boardsShowing(boards, types, destination);
  return showing.find((b) => b.tabId !== undefined && b.tabId === destination.tabId) ?? showing[0];
}

// The destination's card type, as the catalogue holds it.
export function destinationType(
  destination: FormDestination | undefined,
  types: readonly ItemTypeDef[],
): ItemTypeDef | undefined {
  return destination ? types.find((t) => t.id === destination.typeId) : undefined;
}

type StatusesPart = Pick<ItemTypeDef, 'statuses' | 'excludedStatuses'>;

// Columns follow the card type (docs/specs/030-forms/forms.md "Columns follow the card type"): whether `type` uses
// `status`. A type with its own list uses what it lists; a legacy one every status but those it left out.
export function typeUsesStatus(type: StatusesPart, status: string): boolean {
  if (type.statuses) return type.statuses.includes(status);
  return !(type.excludedStatuses ?? []).includes(status);
}

// The columns of a board `type` uses (every column while there is no type yet).
export function typeColumns<C extends { status: string }>(
  columns: readonly C[],
  type: StatusesPart | undefined,
): C[] {
  return type ? columns.filter((c) => typeUsesStatus(type, c.status)) : [...columns];
}

// The status a destination takes on a board for `type`: `status` while the type uses it and the board has it, else
// the board's first column the type uses, else `status` as it was (the builder says why).
export function columnForType(
  columns: readonly { status: string }[],
  type: StatusesPart | undefined,
  status: string | undefined,
): string | undefined {
  const usable = typeColumns(columns, type);
  if (status && usable.some((c) => c.status === status)) return status;
  return usable[0]?.status ?? status;
}

// A destination that holds but whose column its type leaves out: a warning in the builder alone (responses keep
// arriving where they did), never read by the api.
export type DestinationWarning = 'status_not_in_type' | 'no_type_column';

export function destinationWarning(
  destination: FormDestination | undefined,
  boards: readonly TargetBoard[],
  type: ItemTypeDef | undefined,
): DestinationWarning | null {
  if (!destination || !type || typeUsesStatus(type, destination.status)) return null;
  const holding = boards.filter(
    (b) => !b.archive && b.columns.some((c) => c.status === destination.status),
  );
  if (holding.length === 0) return null;
  return holding.some((b) => typeColumns(b.columns, type).length)
    ? 'status_not_in_type'
    : 'no_type_column';
}

// The warning's words, naming the type and its board.
export function destinationWarningText(
  warning: DestinationWarning,
  typeLabel: string,
  boardName: string,
): string {
  return warning === 'no_type_column'
    ? `None of ${boardName}’s columns is a ${typeLabel} state. Add one to the board, or choose another card type.`
    : `Its column isn’t one of ${typeLabel}’s states, so its cards miss ${typeLabel}’s boards. Choose another column.`;
}
