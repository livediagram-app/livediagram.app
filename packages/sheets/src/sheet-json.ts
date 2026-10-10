// A sheet as JSON (the wire, the offline record, the Drive file): cells as a list, since a Map is not JSON.
import {
  cellKey,
  splitCellKey,
  type Cell,
  type CellFormat,
  type CellInput,
  type Sheet,
  type SheetLayout,
  type SheetPerson,
} from './sheet';

export type SheetCellJson = { r: string; c: string; i?: CellInput; f?: CellFormat };

export type SheetJson = {
  id: string;
  tabId: string;
  title: string;
  layout: SheetLayout;
  cells: SheetCellJson[];
  rev: number;
  createdAt: number;
  updatedAt: number;
  updatedBy: SheetPerson;
};

export function cellToJson(key: string, cell: Cell | undefined): SheetCellJson {
  const { r, c } = splitCellKey(key);
  return {
    r,
    c,
    ...(cell?.input ? { i: cell.input } : {}),
    ...(cell?.format ? { f: cell.format } : {}),
  };
}

export function sheetToJson(sheet: Sheet): SheetJson {
  return {
    id: sheet.id,
    tabId: sheet.tabId,
    title: sheet.title,
    layout: sheet.layout,
    cells: [...sheet.cells].map(([key, cell]) => cellToJson(key, cell)),
    rev: sheet.rev,
    createdAt: sheet.createdAt,
    updatedAt: sheet.updatedAt,
    updatedBy: sheet.updatedBy,
  };
}

export function cellsFromJson(cells: readonly SheetCellJson[]): Map<string, Cell> {
  const out = new Map<string, Cell>();
  for (const x of cells) {
    if (!x.i && !x.f) continue;
    out.set(cellKey(x.r, x.c), { ...(x.i ? { input: x.i } : {}), ...(x.f ? { format: x.f } : {}) });
  }
  return out;
}

export function sheetFromJson(json: SheetJson): Sheet {
  return { ...json, cells: cellsFromJson(json.cells) };
}
