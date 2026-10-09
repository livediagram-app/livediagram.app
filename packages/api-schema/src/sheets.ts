// The sheet store on the wire (docs/specs/029-sheets/sheet-store.md, blueprint sheet-store.md "Interfaces and
// contracts"). Sheet shapes come from @livediagram/sheets; these are the request and response bodies. A sheet's
// cells travel as a list (a Map is not JSON).

import type {
  SheetCellJson,
  SheetJson,
  SheetLayout,
  SheetPerson,
  SheetWrite,
} from '@livediagram/sheets';

export type {
  CellFormat,
  CellInput,
  SheetLayout,
  SheetPerson,
  SheetWrite,
} from '@livediagram/sheets';

// One stored cell (its row id, column id, input and format; neither means "nothing") and a whole sheet, as JSON.
export type SheetCellDto = SheetCellJson;
export type SheetDto = SheetJson;

export type SheetsResponse = { sheets: SheetDto[] };

export type SheetResponse = { sheet: SheetDto };

// A new sheet: a blank one (layout made by the client), one filled (a CSV, a paste, a restore), or a copy of
// another of the document's sheets (`copyOf`, its cells copied on the server).
export type SheetCreateRequest = {
  id?: string;
  tabId: string;
  title: string;
  layout?: SheetLayout;
  cells?: SheetCellDto[];
  copyOf?: string;
};

// One write. `wid` is the client's id for it, echoed on the room op so the writer knows its own; `undo` marks an
// undo or redo (never refused for a title its own undo puts back).
export type SheetWriteRequest = { write: SheetWrite; wid?: string; undo?: boolean };

// The write as it landed, the sheet's new rev, and the stored state of every cell it touched (a cell with no `i`
// and no `f` is gone).
export type SheetWriteResponse = { applied: SheetWrite; rev: number; cells: SheetCellDto[] };

export const SHEET_ERRORS = [
  'sheet_not_found',
  'sheet_exists',
  'sheet_busy',
  'sheet_title_taken',
  'sheet_full',
  'sheets_full',
  'sheet_too_large',
  'input_too_long',
  'formula_invalid',
  'format_invalid',
  'axis_id_invalid',
  'title_invalid',
  'merge_invalid',
  'filter_invalid',
  'write_too_large',
  'write_invalid',
  'tab_not_found',
] as const;
export type SheetError = (typeof SHEET_ERRORS)[number];

// The room op for a sheet write (a system op: only the api sends it). `applied` with `at`/`by` is the write to
// apply in order at `rev`; `created`/`deleted` say a sheet came or went; `refetch` (a write too large to relay)
// asks clients to fetch the sheet.
export type SheetsRoomOp = {
  kind: 'sheets';
  sheetId: string;
  tabId: string;
  rev: number;
  applied?: SheetWrite;
  at?: number;
  by?: SheetPerson;
  wid?: string;
  created?: true;
  deleted?: true;
  refetch?: true;
};

// Someone's selection on a sheet (an ephemeral presence op, never stored): ids, so it follows rows that move.
export type SheetPresenceOp = {
  kind: 'sheet-presence';
  tabId: string;
  sheetId: string;
  ranges: { r1: string; c1: string; r2: string; c2: string }[] | null;
  editing: boolean;
};
