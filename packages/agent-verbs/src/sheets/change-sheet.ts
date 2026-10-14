// Changing a sheet for an agent (docs/specs/029-sheets/sheet-store.md "Agents", MCP change_sheet and the CLI's sheet
// verbs): changes in order, each built against the sheet as the ones before it left it, and sent through the api's
// write route as the editor sends them (one write a call, a large one split, each with its own write id). The
// api answers with the write as it landed, which is applied here so the next change reads what is stored. A refused
// change stops the rest and says which went through. A change is checked against the store's caps whole before any
// part is sent (writesCapsProblem), and one whose later part is still refused says how much of it landed.
import type { ApiClient } from '@livediagram/api-client';
import {
  CLIENT_HEADER,
  type ChangesetRequest,
  type ChangesetResponse,
  type SheetWriteRequest,
  type SheetWriteResponse,
  type TabRecord,
  type TabResponse,
} from '@livediagram/api-schema';
import { isLightColor } from '@livediagram/document';
import { tabPath } from '../verbs/shared';
import { sheetChartElements, type SheetChartOut } from './sheet-charts';
import {
  applySheetWrite,
  documentCellCount,
  NOBODY,
  splitWrite,
  writesCapsProblem,
  type Rand,
  type Sheet,
  type SheetWrite,
  type Workbook,
} from '@livediagram/sheets';
import { apiRefusalOf } from '../plan/api-refusal';
import { SHEET_REFUSAL_WORDS } from './sheet-refusals';
import { buildSheetChange, type SheetChange, type SheetChangeContext } from './sheet-change-build';
import { readSheets, resolveSheet, sheetWritesPath, workbookFor } from './sheet-state';

export interface SheetChangesResult {
  sheetId: string;
  title: string;
  applied: string[];
  rev: number | null;
  refusal?: { code: string; message: string };
}

// What applying changes answers: the lines, the revision, a refusal, and the charts they put over the cells.
type Applied = Omit<SheetChangesResult, 'sheetId' | 'title'> & { charts: SheetChartOut[] };

// One write through the api, and the sheet after it as stored.
export async function sendSheetWrite(
  api: ApiClient,
  documentId: string,
  sheet: Sheet,
  write: SheetWrite,
  client: 'mcp' | 'cli',
): Promise<Sheet> {
  const body: SheetWriteRequest = { write, wid: crypto.randomUUID() };
  const answer = await api.json<SheetWriteResponse>(sheetWritesPath(documentId, sheet.id), {
    method: 'POST',
    headers: { [CLIENT_HEADER]: client },
    body: JSON.stringify(body),
  });
  const landed = applySheetWrite(sheet, answer.applied, { now: Date.now(), by: NOBODY });
  return { ...landed.sheet, rev: answer.rev };
}

// A cap the whole change would cross, in the api's words, before anything is sent.
export function capsRefusal(
  sheet: Sheet,
  writes: readonly SheetWrite[],
  documentCells: number,
): { code: string; message: string } | null {
  const code = writesCapsProblem(sheet, writes, documentCells);
  if (!code) return null;
  console.info('[sheets] agent change over a cap', { code });
  return {
    code,
    message: `This change would pass a limit, so none of it was written: ${SHEET_REFUSAL_WORDS[code]}`,
  };
}

// A change goes in parts only when splitWrite cut its cells, so every part of one holds cells: a title, or a write
// with no cells, is always sent whole and never lands partly.
const cellsIn = (write: SheetWrite) => (write as { cells: readonly unknown[] }).cells.length;

// What a change whose later part was refused left behind, as its applied line: the cells that landed.
function partlyLine(line: string, parts: readonly SheetWrite[], sent: number): string {
  const total = parts.reduce((n, p) => n + cellsIn(p), 0);
  const landed = parts.slice(0, sent).reduce((n, p) => n + cellsIn(p), 0);
  return `partly ${line}: ${landed} of its ${total} cells landed before the refusal`;
}

// Builds and sends each change in turn against the workbook, which follows every landed write.
export async function applySheetChanges(
  api: ApiClient,
  documentId: string,
  wb: Workbook,
  sheetId: string,
  changes: readonly SheetChange[],
  client: 'mcp' | 'cli',
  documentCells: number,
  rand: Rand = Math.random,
  context: SheetChangeContext = {},
): Promise<Applied> {
  const applied: string[] = [];
  const charts: SheetChartOut[] = [];
  let rev: number | null = null;
  let cells = documentCells;
  for (const change of changes) {
    const sheet = wb.sheet(sheetId)!;
    const others = wb
      .sheetList()
      .filter((s) => s.id !== sheetId)
      .map((s) => s.title);
    const built = buildSheetChange(wb, sheetId, change, others, rand, context);
    if (!built.ok)
      return { applied, rev, charts, refusal: { code: built.code, message: built.message } };
    const over = capsRefusal(sheet, built.writes, cells);
    if (over) return { applied, rev, charts, refusal: over };
    const parts = built.writes.flatMap((w) => splitWrite(w));
    let next = sheet;
    let sent = 0;
    try {
      for (const part of parts) {
        next = await sendSheetWrite(api, documentId, next, part, client);
        sent++;
      }
    } catch (err) {
      const refusal = apiRefusalOf(err);
      if (!refusal) throw err;
      if (sent > 0) {
        // Some parts landed: the sheet holds them, so say so rather than report nothing applied.
        wb.updateSheet(next);
        rev = next.rev;
        applied.push(partlyLine(built.line, parts, sent));
      }
      return { applied, rev, charts, refusal };
    }
    if (next !== sheet) {
      cells += next.cells.size - sheet.cells.size;
      wb.updateSheet(next);
      rev = next.rev;
    }
    applied.push(built.line);
    charts.push(...(built.charts ?? []));
  }
  return { applied, rev, charts };
}

// The charts changes made, added to the sheet's tab over its Sheet element in one changeset, each with its first read.
// A tab with no Sheet framing the sheet takes none, and says so.
export async function placeSheetCharts(
  api: ApiClient,
  documentId: string,
  tab: TabRecord,
  wb: Workbook,
  sheetId: string,
  charts: readonly SheetChartOut[],
  client: 'mcp' | 'cli',
): Promise<string | null> {
  if (charts.length === 0) return null;
  const frame = tab.elements.find(
    (el) =>
      el.type === 'shape' &&
      el.shape === 'plan-sheet' &&
      (el as { planSheet?: { sheetId?: string } }).planSheet?.sheetId === sheetId,
  ) as { x: number; y: number; width: number; height: number } | undefined;
  if (!frame) return 'no Sheet on its tab frames the sheet, so its charts were not placed';
  const elements = sheetChartElements(wb, frame, sheetId, charts);
  const body: ChangesetRequest = {
    operations: elements.map((element) => ({ op: 'add', element })),
    base: { rev: tab.rev, elements: {} },
    summary: elements.length === 1 ? 'Add a chart' : `Add ${elements.length} charts`,
  };
  await api.json<ChangesetResponse>(`${tabPath(documentId, tab.id)}/changesets`, {
    method: 'POST',
    headers: { [CLIENT_HEADER]: client },
    body: JSON.stringify(body),
  });
  return elements.length === 1 ? 'placed a chart' : `placed ${elements.length} charts`;
}

export async function changeSheet(
  api: ApiClient,
  documentId: string,
  input: { sheet: string; changes: readonly SheetChange[] },
  client: 'mcp' | 'cli',
): Promise<SheetChangesResult> {
  const sheets = await readSheets(api, documentId);
  const found = resolveSheet(sheets, input.sheet);
  if (!found.ok) {
    const { code, message } = found;
    return { sheetId: '', title: input.sheet, applied: [], rev: null, refusal: { code, message } };
  }
  const { id, tabId } = found.sheet;
  const wb = await workbookFor(api, documentId, sheets, tabId);
  // A design is tinted for its tab's canvas, and charts go on the tab: read it only when a change needs it.
  const needsTab = input.changes.some((c) => c.op === 'design' || c.op === 'chart');
  const tab = needsTab ? (await api.json<TabResponse>(tabPath(documentId, tabId))).tab : null;
  const dark = !!tab?.backgroundColor && !isLightColor(tab.backgroundColor);
  const { charts, ...result } = await applySheetChanges(
    api,
    documentId,
    wb,
    id,
    input.changes,
    client,
    documentCellCount(sheets),
    Math.random,
    { dark },
  );
  if (tab && charts.length) {
    try {
      const line = await placeSheetCharts(api, documentId, tab, wb, id, charts, client);
      if (line) result.applied.push(line);
    } catch (err) {
      const refusal = apiRefusalOf(err);
      if (!refusal) throw err;
      return { sheetId: id, title: wb.sheet(id)!.title, ...result, refusal };
    }
  }
  return { sheetId: id, title: wb.sheet(id)!.title, ...result };
}
