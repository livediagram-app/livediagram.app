// How a cell thread names its Sheet and cell outside the grid (docs/specs/029-sheets/sheet.md "Cell comments" "Inbox"):
// the stored sheet's title and the cell key's A1, from a plan's sheets by store id. One reader for the api's push and
// listing and the editor's This Browser Inbox. Each sheet's layout is indexed only when one of its cells is asked for.
import { formatA1 } from './address';
import { layoutIndex } from './layout';
import type { SheetLayout } from './sheet';

export type SheetNames = {
  // The stored sheet's title; undefined when the store has no such sheet or its title is blank.
  title: (sheetId: string) => string | undefined;
  // A cell key's (`rowId:colId`) A1; null when its row or column is gone; undefined when the store has no such sheet.
  cellRef: (sheetId: string, cell: string) => string | null | undefined;
};

export function sheetNamesFrom(
  sheets: readonly { id: string; title: string; layout: SheetLayout }[],
): SheetNames {
  const byId = new Map(sheets.map((s) => [s.id, s]));
  return {
    title: (sheetId) => byId.get(sheetId)?.title.trim() || undefined,
    cellRef: (sheetId, cell) => {
      const sheet = byId.get(sheetId);
      if (!sheet) return undefined;
      const ix = layoutIndex(sheet.layout);
      const colon = cell.indexOf(':');
      const row = ix.rowPos.get(cell.slice(0, colon));
      const col = ix.colPos.get(cell.slice(colon + 1));
      return row === undefined || col === undefined ? null : formatA1(row, col);
    },
  };
}
