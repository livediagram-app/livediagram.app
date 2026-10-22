// Whether a form's destination still holds (docs/specs/030-forms/forms.md "Publishing and the form link"): its
// Board tab, a board there with a column of its status, and its card type, which that board takes. One rule for the
// builder (Publish Form, the paused notice) and the api (every response).
import { boardTakesType, type ItemTypeDef, type PlanBoardSetup } from '@livedesign/items';
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
// `sheets`: the document's sheets, each with its tab.
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
