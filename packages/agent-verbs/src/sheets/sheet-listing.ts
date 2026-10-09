// A document's sheets for an agent (docs/specs/029-sheets/sheet-store.md "Agents", MCP list_sheets and `sheet ls`):
// each one's title, tab, size in use and filled range, and the Sheet element that frames it.
import type { ApiClient } from '@livediagram/api-client';
import type { DocumentResponse, TabResponse } from '@livediagram/api-schema';
import { AGENT_LOCALE, formatRange, sheetFromJson, Workbook } from '@livediagram/sheets';
import { tabPath } from '../verbs/shared';
import { readSheets } from './sheet-state';

export interface ListedSheet {
  id: string;
  title: string;
  tabId: string;
  tabName: string;
  // Rows and columns in use (to the last cell with an input), and that range in A1; null when empty.
  rows: number;
  cols: number;
  filled: string | null;
  // The Sheet element on the tab that frames it, or null when none does (a sheet no element frames is swept).
  elementId: string | null;
}

type Framing = { id?: unknown; shape?: unknown; planSheet?: { sheetId?: unknown } };

// The Sheet elements of the tabs that hold sheets, by sheet id: one tab read per such tab, in parallel.
async function framesOf(
  api: ApiClient,
  documentId: string,
  tabIds: readonly string[],
): Promise<Map<string, string>> {
  const tabs = await Promise.all(
    tabIds.map((id) => api.json<TabResponse>(tabPath(documentId, id)).catch(() => null)),
  );
  const out = new Map<string, string>();
  for (const answer of tabs)
    for (const raw of answer?.tab.elements ?? []) {
      const el = raw as Framing;
      const sheetId = el.planSheet?.sheetId;
      if (el.shape === 'plan-sheet' && typeof sheetId === 'string' && typeof el.id === 'string')
        out.set(sheetId, el.id);
    }
  return out;
}

export async function listSheets(
  api: ApiClient,
  documentId: string,
  tabId?: string,
): Promise<{ sheets: ListedSheet[] }> {
  const [{ document }, sheets] = await Promise.all([
    api.json<DocumentResponse>(`/documents/${encodeURIComponent(documentId)}`),
    readSheets(api, documentId, tabId),
  ]);
  const order = new Map(document.tabs.map((t) => [t.id, t.orderIndex ?? 0]));
  const names = new Map(document.tabs.map((t) => [t.id, t.name]));
  const frames = await framesOf(api, documentId, [...new Set(sheets.map((s) => s.tabId))]);
  // Only the extents are read: the workbook works nothing out until asked for a value.
  const wb = new Workbook({ sheets: sheets.map(sheetFromJson), locale: AGENT_LOCALE });
  const listed = sheets.map((s): ListedSheet => {
    const { rows, cols } = wb.extent(s.id);
    return {
      id: s.id,
      title: s.title,
      tabId: s.tabId,
      tabName: names.get(s.tabId) ?? s.tabId,
      rows,
      cols,
      filled: rows && cols ? formatRange({ r1: 0, c1: 0, r2: rows - 1, c2: cols - 1 }) : null,
      elementId: frames.get(s.id) ?? null,
    };
  });
  listed.sort(
    (a, b) =>
      (order.get(a.tabId) ?? 0) - (order.get(b.tabId) ?? 0) || a.title.localeCompare(b.title),
  );
  return { sheets: listed };
}
