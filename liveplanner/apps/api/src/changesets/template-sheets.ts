// A template's Sheets made when a changeset's replace lands a template on a tab (docs/specs/029-sheets/sheet-store.md
// "Template starts"; the MCP's add_tab, the CLI's replace --template): made before the tab is written, so an agent
// reading the sheet right after finds it. A sheet that cannot be made (the project's sheet cap) leaves its Sheet
// marked, for the editor to try when it is drawn; it never refuses the changeset.
import type { Tab } from '@liveplanner/project';
import {
  PROJECT_CELLS_MAX,
  PROJECT_SHEETS_MAX,
  sheetFromJson,
  uniqueSheetTitle,
  validateSheetCreate,
  type SheetJson,
  type SheetPerson,
} from '@liveplanner/sheets';
import { hasTemplateSheets } from '@liveplanner/templates';
import { materialiseTemplateSheets } from '@liveplanner/templates/template-sheets';
import type { PlanEnv } from '../types';
import {
  projectSheetTotals,
  insertSheetStatements,
  listSheetHeads,
  readSheetHead,
} from '../db/sheets';
import { changesetLog } from './log';

export async function makeTemplateSheets(
  env: PlanEnv,
  projectId: string,
  tab: Tab,
  by: SheetPerson,
): Promise<Tab> {
  if (!hasTemplateSheets([tab])) return tab;
  const now = Date.now();
  const made = materialiseTemplateSheets([tab], now);
  const madeIds = new Set<string>();
  let totals = await projectSheetTotals(env, projectId);
  for (const create of made.sheets) {
    const id = create.id!;
    if (await readSheetHead(env, projectId, id)) continue;
    const titles = (await listSheetHeads(env, projectId, create.tabId)).map((h) => h.title);
    const sheet: SheetJson = {
      id,
      tabId: create.tabId,
      title: uniqueSheetTitle(create.title, titles),
      layout: create.layout!,
      cells: create.cells ?? [],
      rev: 0,
      createdAt: now,
      updatedAt: now,
      updatedBy: by,
    };
    const full =
      totals.sheets >= PROJECT_SHEETS_MAX ||
      totals.cells + sheet.cells.length > PROJECT_CELLS_MAX;
    if (full || !validateSheetCreate(sheetFromJson(sheet)).ok) {
      changesetLog('warn', '[changeset] template sheet skipped', { projectId, full });
      continue;
    }
    await env.PLAN_DB.batch(insertSheetStatements(env, projectId, sheet, now));
    totals = { ...totals, sheets: totals.sheets + 1, cells: totals.cells + sheet.cells.length };
    madeIds.add(id);
  }
  changesetLog('info', '[changeset] template sheets made', { projectId, count: madeIds.size });
  // Only the Sheets whose sheets were made lose the mark.
  return {
    ...tab,
    elements: tab.elements.map((el, i) => {
      const done = made.tabs[0]!.elements[i]!;
      return el.type === 'shape' && el.planSheet?.start && madeIds.has(el.planSheet.sheetId)
        ? done
        : el;
    }),
  };
}
