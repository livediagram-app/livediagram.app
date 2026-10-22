// Putting a new Sheet on a tab in Plan for an agent (docs/specs/029-sheets/sheet-store.md "Agents", MCP add_sheet and
// `sheet add`): the sheet is made in the store first (a title unique on the tab, optionally filled from rows or CSV
// text read as typed from A1), then a Sheet element framing it is placed beside what the tab holds, as add_board
// places a board, in one changeset (live to anyone with the tab open). The first cells are checked against the
// store's caps before the sheet is made, and a sheet whose filling or placing then fails is deleted, so a failed
// call leaves no unplaced sheet holding cells of the project's budget and a retry starts clean.
import { ApiError, type ApiClient } from '@liveplanner/api-client';
import {
  CLIENT_HEADER,
  type ChangesetRequest,
  type ChangesetResponse,
  type ProjectResponse,
  type SheetCreateRequest,
  type SheetResponse,
  type TabResponse,
} from '@liveplanner/api-schema';
import {
  SHEET_COL_HEAD_H,
  SHEET_HEADER_H,
  SHEET_ROW_HEAD_W,
  createShape,
} from '@liveplanner/project';
import { placeBeside } from '@liveplanner/items';
import {
  AGENT_LOCALE,
  NOBODY,
  applySheetWrite,
  formatRange,
  layoutIndex,
  sheetContentSize,
  splitCellKey,
  projectCellCount,
  emptyLayout,
  emptySheet,
  makeSheetId,
  nextSheetTitle,
  parseCsv,
  sheetFromJson,
  splitWrite,
  uniqueSheetTitle,
  Workbook,
  writeRows,
  type AgentValue,
  type Rand,
  type Sheet,
  type SheetWrite,
} from '@liveplanner/sheets';
import { apiRefusalOf } from '../plan/api-refusal';
import { tabPath } from '../verbs/shared';
import { capsRefusal, sendSheetWrite } from './change-sheet';
import { readSheets, sheetsPath, type SheetRefusal } from './sheet-state';
import { buildDesign, darkCanvas, type SheetDesignInput } from './sheet-design';
import { sheetChartElements, type SheetChartOut } from './sheet-charts';

// A Sheet's chrome round its cells (its row numbers; its title bar and column letters), and the largest a new Sheet is
// made to show what it holds.
const SHEET_CHROME = {
  width: SHEET_ROW_HEAD_W,
  height: SHEET_HEADER_H + SHEET_COL_HEAD_H,
} as const;
const SHEET_FRAME_MAX = { width: 1800, height: 1400 } as const;

interface AddSheetInput {
  tabId?: string;
  title?: string;
  // The first cells, from A1: rows of values, or CSV text (a tab-separated first line reads as TSV).
  rows?: AgentValue[][];
  csv?: string;
  // Or the sheet laid out as a template is (sheet-design.ts).
  design?: SheetDesignInput;
}

type AddSheetResult =
  | {
      ok: true;
      tabId: string;
      sheetId: string;
      elementId: string;
      title: string;
      // The cells filled, in A1; null for a blank sheet.
      filled: string | null;
      // What a design laid out, where each block landed, and its charts.
      laidOut?: string;
      truncated: boolean;
      changesetId: string | null;
      rev: number | null;
    }
  | SheetRefusal;

type FirstCells = {
  writes: SheetWrite[];
  filled: string | null;
  truncated: boolean;
  // A design's line and charts, and the workbook it was laid out in (the charts' first read).
  laidOut?: { line: string; charts: SheetChartOut[]; wb: Workbook };
};

// The first cells as writes against the new sheet, read as typed in the agents' locale, or a design laid out on it.
function firstCells(
  input: AddSheetInput,
  tabSheets: readonly Sheet[],
  blank: Sheet,
  dark: boolean,
  rand: Rand,
): FirstCells | SheetRefusal {
  const wb = new Workbook({ sheets: [...tabSheets, blank], locale: AGENT_LOCALE });
  if (input.design) {
    const built = buildDesign(wb, blank.id, input.design, { dark }, rand);
    if (!built.ok) return built;
    let laid = blank;
    for (const w of built.writes) laid = applySheetWrite(laid, w, { now: 0, by: NOBODY }).sheet;
    wb.updateSheet(laid);
    const extent = filledExtent(laid);
    return {
      writes: built.writes,
      filled: extent,
      truncated: false,
      laidOut: { line: built.line, charts: built.charts, wb },
    };
  }
  const parsed = input.csv !== undefined ? parseCsv(input.csv) : null;
  const rows: AgentValue[][] | undefined = parsed?.rows ?? input.rows;
  if (!rows?.length || rows.every((r) => r.length === 0))
    return { writes: [], filled: null, truncated: !!parsed?.truncated };
  const made = writeRows(wb, blank.id, 'A1', rows, rand);
  // The blank sheet is in the workbook and A1 is a cell, so only a formula can be refused.
  if (!made.ok)
    return {
      ok: false,
      code: 'formula_invalid',
      message: `The formula in ${made.at} cannot be read: ${made.why}.`,
    };
  return {
    writes: [made.write],
    filled: made.range,
    truncated: made.truncated || !!parsed?.truncated,
  };
}

// The range a laid-out sheet fills, A1 to its last cell with an input, in A1.
function filledExtent(sheet: Sheet): string {
  const ix = layoutIndex(sheet.layout);
  let r2 = -1;
  let c2 = -1;
  for (const [key, cell] of sheet.cells) {
    if (!cell.input) continue;
    const { r, c } = splitCellKey(key);
    // A stored cell's row and column are the sheet's.
    r2 = Math.max(r2, ix.rowPos.get(r)!);
    c2 = Math.max(c2, ix.colPos.get(c)!);
  }
  // A design's heading is always written, so A1 at least.
  return formatRange({ r1: 0, c1: 0, r2: Math.max(0, r2), c2: Math.max(0, c2) });
}

export async function addSheet(
  api: ApiClient,
  projectId: string,
  input: AddSheetInput,
  client: 'mcp' | 'cli',
  rand: Rand = Math.random,
): Promise<AddSheetResult> {
  try {
    const { project } = await api.json<ProjectResponse>(
      `/projects/${encodeURIComponent(projectId)}`,
    );
    const tabs = [...project.tabs].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    // The tab named, else the first tab holding a sheet, else the first tab.
    const all = input.tabId ? null : await readSheets(api, projectId);
    const tabId =
      input.tabId ?? tabs.find((t) => all?.some((s) => s.tabId === t.id))?.id ?? tabs[0]?.id;
    if (!tabId) return { ok: false, code: 'tab_not_found', message: 'That project has no tabs.' };
    if (!tabs.some((t) => t.id === tabId))
      return {
        ok: false,
        code: 'tab_not_found',
        message: `No tab "${tabId}". Tabs: ${tabs.map((t) => `${t.name} (${t.id})`).join(', ')}.`,
      };
    const { tab } = await api.json<TabResponse>(tabPath(projectId, tabId));
    const onTab = (all ?? (await readSheets(api, projectId, tabId))).filter(
      (s) => s.tabId === tabId,
    );
    const taken = onTab.map((s) => s.title);
    const title = input.title?.trim()
      ? uniqueSheetTitle(input.title, taken)
      : nextSheetTitle(taken);
    const layout = emptyLayout(rand);
    const blank = emptySheet({ id: makeSheetId(rand), tabId, title, layout });
    // A design is tinted for the tab's canvas.
    const dark = darkCanvas(input.design ? tab.backgroundColor : undefined);
    const first = firstCells(input, onTab.map(sheetFromJson), blank, dark, rand);
    if ('ok' in first) return first;
    if (first.writes.length) {
      const cells = projectCellCount(all ?? (await readSheets(api, projectId)));
      const over = capsRefusal(blank, first.writes, cells);
      if (over) return { ok: false, ...over };
    }

    // The sheet, blank, then its first cells as the editor fills a dropped CSV: one write a call, split when large.
    const create: SheetCreateRequest = { id: blank.id, tabId, title, layout };
    const { sheet: made } = await api.json<SheetResponse>(sheetsPath(projectId), {
      method: 'POST',
      headers: { [CLIENT_HEADER]: client },
      body: JSON.stringify(create),
    });
    return await fillAndPlace(api, projectId, tabId, sheetFromJson(made), first, client);
  } catch (err) {
    const refusal = apiRefusalOf(err);
    if (!refusal) throw err;
    return { ok: false, ...refusal };
  }
}

// A sheet made by a call that then failed: nothing frames it, so it is deleted rather than left holding cells.
async function deleteUnplaced(api: ApiClient, projectId: string, sheetId: string): Promise<void> {
  try {
    const res = await api.fetch(`${sheetsPath(projectId)}/${encodeURIComponent(sheetId)}`, {
      method: 'DELETE',
    });
    console.info('[sheets] add_sheet failed; unplaced sheet deleted', { status: res.status });
  } catch {
    console.warn('[sheets] add_sheet failed; unplaced sheet not deleted');
  }
}

// Fills the made sheet with its first cells, then places its element. A failure deletes the sheet, except a
// placing request that never answered: its element may have landed, and a frame with no sheet is worse.
async function fillAndPlace(
  api: ApiClient,
  projectId: string,
  tabId: string,
  made: Sheet,
  first: FirstCells,
  client: 'mcp' | 'cli',
): Promise<AddSheetResult> {
  let sheet = made;
  try {
    for (const part of first.writes.flatMap((w) => splitWrite(w)))
      sheet = await sendSheetWrite(api, projectId, sheet, part, client);
  } catch (err) {
    await deleteUnplaced(api, projectId, made.id);
    throw err;
  }
  const { tab } = await api.json<TabResponse>(tabPath(projectId, tabId));
  const { x, y } = placeBeside(tab.elements);
  // A Sheet as large as what it holds, so it shows every filled cell, within bounds; a blank one its usual size.
  const element = { ...createShape('plan-sheet', x, y), planSheet: { sheetId: sheet.id } };
  const content = sheetContentSize(sheet);
  if (content) {
    element.width = Math.min(
      SHEET_FRAME_MAX.width,
      Math.max(element.width, SHEET_CHROME.width + content.width),
    );
    element.height = Math.min(
      SHEET_FRAME_MAX.height,
      Math.max(element.height, SHEET_CHROME.height + content.height),
    );
  }
  const charts = first.laidOut
    ? sheetChartElements(first.laidOut.wb, element, sheet.id, first.laidOut.charts)
    : [];
  const body: ChangesetRequest = {
    operations: [
      { op: 'add', element },
      ...charts.map((el) => ({ op: 'add' as const, element: el })),
    ],
    base: { rev: tab.rev, elements: {} },
    summary: `Add the ${sheet.title} sheet`,
  };
  let answer: ChangesetResponse;
  try {
    answer = await api.json<ChangesetResponse>(`${tabPath(projectId, tabId)}/changesets`, {
      method: 'POST',
      headers: { [CLIENT_HEADER]: client },
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (err instanceof ApiError) await deleteUnplaced(api, projectId, made.id);
    throw err;
  }
  return {
    ok: true,
    tabId,
    sheetId: sheet.id,
    elementId: element.id,
    title: sheet.title,
    filled: first.filled,
    ...(first.laidOut ? { laidOut: first.laidOut.line } : {}),
    truncated: first.truncated,
    changesetId: answer.changeset?.id ?? null,
    rev: answer.changeset?.rev ?? null,
  };
}
