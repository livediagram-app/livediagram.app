'use client';

// The Sheets track's practice sheet (docs/specs/026-plan/plan-tour.md "Sheets: Five Small Wins"): a real Sheet, in a
// store of its own that never reaches the server (its api answers here), seeded with a small budget. One store serves
// the page; each run is a tab of its own in it, so a second run starts from the seed again.

import {
  cellKey,
  emptyLayout,
  sheetToJson,
  typeInto,
  type CellFormat,
  type Sheet,
  type SheetJson,
  type SheetPerson,
  type SheetWrite,
} from '@liveplanner/sheets';
import { SheetStore } from '@/components/sheets/sheet-store-client';
import type { ItemUndoStep } from '@/hooks/plan/item-undo-journal';
import type { PracticeSheetCtx } from './plan-tour-steps';

// The practice budget, typed in as a person would (plan-tour.md's table).
export const PRACTICE_CELLS: Readonly<Record<string, string>> = {
  A1: 'Category',
  B1: 'Planned',
  C1: 'Actual',
  D1: 'Left',
  A2: 'Rent',
  B2: '1200',
  C2: '1200',
  D2: '=B2-C2',
  A3: 'Groceries',
  B3: '400',
  C3: '436',
  A4: 'Transport',
  B4: '150',
  A5: 'Fun',
  B5: '200',
  C5: '265',
  A6: 'Savings',
  B6: '500',
  C6: '500',
  A7: 'Total',
  B7: '=SUM(B2:B6)',
};
const BOLD: readonly string[] = ['A1', 'B1', 'C1', 'D1', 'A7', 'B7', 'C7'];
const ROWS = 14;
const COLS = 6;
export const PRACTICE_TITLE = 'Practice Budget';

// Who the practice sheet's changes are by: nobody is told of them.
const PRACTICE_BY: SheetPerson = { id: 'practice', name: 'You', color: '#7c5cff' };

// The page's practice store and the hooks its dialog plugs in for the run on screen (undo, toasts).
type Sinks = { undo: (step: ItemUndoStep) => void; toast: (message: string) => void };
let sinks: Sinks = { undo: () => {}, toast: () => {} };
let store: SheetStore | null = null;
let runs = 0;
const seeds = new Map<string, SheetJson>();

function practiceStore(locale: string): SheetStore {
  store ??= new SheetStore({
    scope: { projectId: 'practice-sheet', ownerId: 'practice', shareCode: null, tabId: null },
    self: () => PRACTICE_BY,
    locale,
    pushUndo: (step) => sinks.undo(step),
    toast: (message) => sinks.toast(message),
    // Answered here: nothing is sent, nothing is saved (plan-tour.md "Sheets: Five Small Wins").
    api: {
      fetchSheets: async (_scope: unknown, which: { tabId?: string }) =>
        [...seeds.values()].filter((s) => s.tabId === which.tabId),
      createSheet: async () => ({ rev: 0 }),
      writeSheet: async (_scope: unknown, _id: string, req: { write: SheetWrite }) => ({
        rev: 0,
        applied: req.write,
      }),
      deleteSheet: async () => ({ rev: 0 }),
    } as never,
  });
  return store;
}

// A fresh practice sheet: its store, its tab and its id, seeded and ready to draw.
export async function startPracticeSheet(
  locale: string,
  plug: Sinks,
): Promise<{ store: SheetStore; tabId: string; sheetId: string }> {
  sinks = plug;
  const s = practiceStore(locale);
  runs += 1;
  const tabId = `practice-tab-${runs}`;
  const sheetId = `practice-${runs}`;
  const layout = { ...emptyLayout(Math.random, ROWS, COLS), frozenRows: 1 };
  seeds.set(sheetId, {
    id: sheetId,
    tabId,
    title: PRACTICE_TITLE,
    layout,
    cells: [],
    rev: 0,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: PRACTICE_BY,
  });
  await s.loadTab(tabId);
  const at = (a1: string) => ({ r: Number(a1.slice(1)) - 1, c: a1.charCodeAt(0) - 65 });
  for (const [a1, text] of Object.entries(PRACTICE_CELLS)) {
    const typed = typeInto(s.workbook(tabId), sheetId, at(a1), text);
    if (typed?.ok) s.write(sheetId, typed.write, { undoable: false });
  }
  const bold: CellFormat = { b: true };
  s.write(
    sheetId,
    {
      kind: 'cells',
      cells: BOLD.map((a1) => {
        const p = at(a1);
        return { r: layout.rows[p.r]!, c: layout.cols[p.c]!, f: bold };
      }),
    },
    { undoable: false },
  );
  await s.settle();
  return { store: s, tabId, sheetId };
}

// What the challenges read, from the practice sheet as it is now.
export function practiceSheetCtx(
  sheet: Sheet,
  value: (r: number, c: number) => unknown,
  charted: boolean,
): PracticeSheetCtx {
  const at = (a1: string) => ({ r: Number(a1.slice(1)) - 1, c: a1.charCodeAt(0) - 65 });
  const cell = (a1: string) => {
    const p = at(a1);
    const r = sheet.layout.rows[p.r];
    const c = sheet.layout.cols[p.c];
    return r && c ? sheet.cells.get(cellKey(r, c)) : undefined;
  };
  return {
    value: (a1) => {
      const p = at(a1);
      const v = value(p.r, p.c);
      return typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' ? v : null;
    },
    isFormula: (a1) => {
      const input = cell(a1)?.input;
      return !!input && 'f' in input;
    },
    currency: (a1) => {
      const nf = cell(a1)?.format?.nf;
      return nf === 'currency' || nf === 'accounting';
    },
    charted,
  };
}

// The practice sheet as the seed of a kept copy: its cells and layout under a new sheet's id.
export function keptSheetSeed(sheet: Sheet): SheetJson {
  return { ...sheetToJson(sheet), rev: 0 };
}
