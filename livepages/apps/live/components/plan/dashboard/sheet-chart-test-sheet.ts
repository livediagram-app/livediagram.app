// A small Budget sheet for the Sheet Chart tests (docs/specs/026-plan/plan-tabs.md "Sheet Chart").
import { Workbook, cellKey, type Sheet } from '@livepages/sheets';
import type { SheetRead } from './useSheetReader';

export const SHEET_ID = 'sheetAAAA';
export const ROWS = ['row0a', 'row1a', 'row2a', 'row3a'];
export const COLS = ['colAa', 'colBa'];

export function budgetSheet(): Sheet {
  const cell = (s: string | number) => ({ input: typeof s === 'number' ? { n: s } : { s } });
  return {
    id: SHEET_ID,
    tabId: 'sheet-tab',
    title: 'Budget',
    layout: { rows: ROWS, cols: COLS },
    cells: new Map([
      [cellKey('row0a', 'colAa'), cell('Item')],
      [cellKey('row0a', 'colBa'), cell('Spent')],
      [cellKey('row1a', 'colAa'), cell('Rent')],
      [cellKey('row1a', 'colBa'), cell(1200)],
      [cellKey('row2a', 'colAa'), cell('Food')],
      [cellKey('row2a', 'colBa'), cell(300)],
    ]),
    rev: 1,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: { id: '', name: '', color: '#000' },
  };
}

export function budgetRead(): Extract<SheetRead, { state: 'ready' }> {
  const sheet = budgetSheet();
  return {
    state: 'ready',
    sheet,
    wb: new Workbook({ sheets: [sheet], locale: 'en-GB' }),
    locale: 'en-GB',
    version: 1,
  };
}
