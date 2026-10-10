// A template's Sheets made in the browser (docs/specs/029-sheets/sheet-store.md "Template starts"), for the paths
// that make tabs without the api's create: a Local only document from the wizard, and Quick Start. The sheets engine
// loads only when a tab holds such a Sheet (hasTemplateSheets is engine-free), so no other template pays for it.
import { hasTemplateSheets } from '@livediagram/templates';
import type { SheetCreateRequest } from '@livediagram/api-schema';
import type { SheetJson } from '@livediagram/sheets';
import type { Tab } from '@livediagram/document';
import { debugLog } from '@/lib/debug-log';

// Who a template's sheet was last changed by: nobody yet.
const MADE_BY = { id: '', name: 'Someone', color: '#94a3b8' };

// The tabs with each template Sheet's mark dropped, and its sheet as stored (rev 0, made now). Null when no tab holds
// one, so nothing loads.
export async function withTemplateSheets<T extends Tab>(
  tabs: readonly T[],
  now: number,
): Promise<{ tabs: T[]; sheets: SheetJson[]; creates: SheetCreateRequest[] } | null> {
  if (!hasTemplateSheets(tabs)) return null;
  const { materialiseTemplateSheets } = await import('@livediagram/templates/template-sheets');
  const made = materialiseTemplateSheets(tabs, now);
  debugLog('[sheets] template sheets made', { count: made.sheets.length });
  return {
    tabs: made.tabs,
    creates: made.sheets,
    sheets: made.sheets.map((c) => ({
      id: c.id!,
      tabId: c.tabId,
      title: c.title,
      layout: c.layout!,
      cells: c.cells ?? [],
      rev: 0,
      createdAt: now,
      updatedAt: now,
      updatedBy: MADE_BY,
    })),
  };
}
