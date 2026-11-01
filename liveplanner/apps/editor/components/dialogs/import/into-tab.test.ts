// @vitest-environment jsdom

// The Import dialog's Into This Tab row (docs/specs/026-plan/plan-tabs.md "The Import dialog"): a Board or Sheet tab's
// CSV through its own import, any other tab's liveplanner Tab JSON, each dimmed with its reason.
import { describe, expect, it, vi } from 'vitest';
import type { Element } from '@liveplanner/project';

const entry = {
  controller: { canShape: true, workbook: { id: 'wb' }, sheet: { id: 'sh' } },
  actions: {},
  onImportCsv: vi.fn(),
  onImportCsvFile: vi.fn(),
};
let published: typeof entry | undefined = entry;
vi.mock('@/components/sheets/sheet-settings-registry', () => ({
  sheetSettingsEntryOf: () => published,
}));
const board = {
  canImport: true,
  onImportCsv: vi.fn(),
  onImportCsvFile: vi.fn(),
  csvText: () => 'Key,Title',
};
let boardPublished: typeof board | undefined = board;
vi.mock('@/components/plan/board-csv-registry', () => ({
  boardCsvEntryOf: (id: string) => (id === 'b' ? boardPublished : undefined),
}));

const { intoTabOf, INTO_BOARD_BLOCKED, INTO_SHEET_BLOCKED, INTO_TAB_LOCKED } =
  await import('./into-tab');

const sheetTab = {
  kind: 'sheet' as const,
  elements: [{ id: 'el', type: 'shape', shape: 'plan-sheet' }] as unknown as Element[],
};
const boardTab = {
  kind: 'board' as const,
  elements: [{ id: 'b', type: 'shape', shape: 'plan-board' }] as unknown as Element[],
};
const file = new File(['a,b'], 'rows.csv');

describe('the Import dialog’s Into This Tab row', () => {
  it('is the Sheet’s own CSV import on a Sheet tab, a picked file or one in hand', () => {
    const row = intoTabOf(sheetTab);
    expect(row).toMatchObject({ kind: 'csv', target: 'sheet' });
    expect(row.blocked).toBeUndefined();
    if (row.kind !== 'csv') throw new Error('csv');
    row.onPick();
    expect(entry.onImportCsv).toHaveBeenCalledOnce();
    row.onFile(file);
    expect(entry.onImportCsvFile).toHaveBeenCalledWith(file);
  });

  it('is dimmed for someone who may not shape the Sheet', () => {
    published = { ...entry, controller: { ...entry.controller, canShape: false } };
    expect(intoTabOf(sheetTab).blocked).toBe(INTO_SHEET_BLOCKED);
    published = entry;
  });

  it('is the board’s own CSV import on a Board tab', () => {
    const row = intoTabOf(boardTab);
    expect(row).toMatchObject({ kind: 'csv', target: 'board' });
    if (row.kind !== 'csv') throw new Error('csv');
    row.onPick();
    expect(board.onImportCsv).toHaveBeenCalledOnce();
    row.onFile(file);
    expect(board.onImportCsvFile).toHaveBeenCalledWith(file);
  });

  it('is dimmed for someone who may not add cards, or before the board is drawn', () => {
    boardPublished = { ...board, canImport: false };
    expect(intoTabOf(boardTab).blocked).toBe(INTO_BOARD_BLOCKED);
    boardPublished = undefined;
    const row = intoTabOf(boardTab);
    expect(row.blocked).toBe(INTO_BOARD_BLOCKED);
    if (row.kind !== 'csv') throw new Error('csv');
    // A press with nothing published does nothing.
    row.onPick();
    row.onFile(file);
    boardPublished = board;
  });

  it('is a liveplanner tab’s JSON on any other tab, a Board or Sheet tab without its element included', () => {
    expect(intoTabOf({ kind: undefined, elements: [] })).toEqual({ kind: 'json' });
    expect(intoTabOf({ kind: 'dashboard', elements: [] })).toEqual({ kind: 'json' });
    expect(intoTabOf({ kind: 'sheet', elements: [] })).toEqual({ kind: 'json' });
    expect(intoTabOf({ kind: 'board', elements: [] })).toEqual({ kind: 'json' });
  });

  it('is dimmed on a locked tab, whatever it takes', () => {
    expect(intoTabOf({ kind: 'dashboard', elements: [], locked: true }).blocked).toBe(
      INTO_TAB_LOCKED,
    );
    expect(intoTabOf({ ...boardTab, locked: true }).blocked).toBe(INTO_TAB_LOCKED);
    expect(intoTabOf({ ...sheetTab, locked: true }).blocked).toBe(INTO_TAB_LOCKED);
  });
});
