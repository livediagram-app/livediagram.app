// Whether a form's destination still holds (docs/specs/030-forms/forms.md "Publishing and the form link"): its
// Board tab, a board there with a column of its status, and its card type, which that board takes. One rule for the
// builder (Publish Form, the paused notice) and the api (every response).
import { boardTakesType, type ItemTypeDef, type PlanBoardSetup } from '@liveplanner/items';
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
  board_missing: 'Its board was removed. Choose where responses go.',
  status_missing: 'Its column was removed. Choose where responses go.',
  type_missing: 'Its card type was removed. Choose where responses go.',
  type_not_on_board: 'Its board no longer takes that card type. Choose where responses go.',
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

// `boards`: the board set-ups on the destination's tab (none when the tab is gone or is no Board tab); only their
// columns, the types they take and whether they are an Archive are read, so an agent's board outline serves too.
export function destinationProblem(
  destination: FormDestination | undefined,
  boards: readonly (Pick<PlanBoardSetup, 'addTypes' | 'archive'> & {
    columns: readonly { status: string }[];
  })[],
  types: readonly ItemTypeDef[],
): DestinationProblem | null {
  if (!destination) return 'no_destination';
  const live = boards.filter((b) => !b.archive);
  if (live.length === 0) return 'board_missing';
  const board = live.find((b) => b.columns.some((c) => c.status === destination.status));
  if (!board) return 'status_missing';
  if (!types.some((t) => t.id === destination.typeId)) return 'type_missing';
  if (!boardTakesType(board, types, destination.typeId)) return 'type_not_on_board';
  return null;
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
  boards: readonly (Pick<PlanBoardSetup, 'archive'> & { columns: readonly { status: string }[] })[],
  type: ItemTypeDef | undefined,
): DestinationWarning | null {
  if (!destination || !type || typeUsesStatus(type, destination.status)) return null;
  const board = boards.find(
    (b) => !b.archive && b.columns.some((c) => c.status === destination.status),
  );
  if (!board) return null;
  return typeColumns(board.columns, type).length ? 'status_not_in_type' : 'no_type_column';
}

// The warning's words, naming the type and its board.
export function destinationWarningText(
  warning: DestinationWarning,
  typeLabel: string,
  boardName: string,
): string {
  return warning === 'no_type_column'
    ? `None of ${boardName}’s columns is a ${typeLabel} state. Add one to the board, or choose another board.`
    : `Its column isn’t one of ${typeLabel}’s states, so its cards miss ${typeLabel}’s boards. Choose another column.`;
}
