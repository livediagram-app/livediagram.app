// A Sheet cell thread's names (docs/specs/029-sheets/sheet.md "Cell comments"), from the tab's stored sheets: its
// Sheet's title and its cell's A1, for the comment listing and the Inbox row. Read only when a Sheet on the tab
// carries cell threads, one query for the tab's sheets.
import { sheetNamesFrom, type SheetNames } from '@liveplanner/sheets';
import type { Element } from '@liveplanner/project';
import { listSheetHeads } from './db';
import type { PlanEnv } from './types';

const NONE: SheetNames = { title: () => undefined, cellRef: () => undefined };

export async function sheetCellNames(
  env: PlanEnv,
  projectId: string,
  tabId: string,
  elements: readonly Element[],
): Promise<SheetNames> {
  if (!elements.some((el) => (el as { cellComments?: unknown }).cellComments)) return NONE;
  return sheetNamesFrom(await listSheetHeads(env, projectId, tabId));
}
