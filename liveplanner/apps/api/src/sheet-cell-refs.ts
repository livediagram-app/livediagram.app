// The A1 of a Sheet cell's thread (docs/specs/029-sheets/sheet.md "Cell comments"), from the tab's stored sheets: what
// names a cell thread in the comment listing and on its Inbox row. Read only when a Sheet on the tab carries cell
// threads, one query for the tab's sheets.
import type { Element } from '@liveplanner/project';
import { formatA1, layoutIndex } from '@liveplanner/sheets';
import { listSheetHeads } from './db';
import type { PlanEnv } from './types';

// A cell's A1; null when its row or column is gone; undefined when its Sheet's store is not on the tab.
export type SheetCellRefs = (el: Element, cell: string) => string | null | undefined;

const none: SheetCellRefs = () => undefined;

export async function sheetCellRefs(
  env: PlanEnv,
  projectId: string,
  tabId: string,
  elements: readonly Element[],
): Promise<SheetCellRefs> {
  if (!elements.some((el) => (el as { cellComments?: unknown }).cellComments)) return none;
  const heads = await listSheetHeads(env, projectId, tabId);
  const indexes = new Map(heads.map((h) => [h.id, layoutIndex(h.layout)]));
  return (el, cell) => {
    const sheetId = el.type === 'shape' ? el.planSheet?.sheetId : undefined;
    const ix = sheetId ? indexes.get(sheetId) : undefined;
    if (!ix) return undefined;
    const [r, c] = cell.split(':');
    const row = ix.rowPos.get(r!);
    const col = ix.colPos.get(c!);
    return row === undefined || col === undefined ? null : formatA1(row, col);
  };
}
