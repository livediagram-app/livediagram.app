// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { Element } from '@liveplanner/project';

const entry = {
  controller: { canShape: true, workbook: { id: 'wb' }, sheet: { id: 'sh' } },
  actions: {},
  onImportCsv: vi.fn(),
};
let published: typeof entry | undefined = entry;
vi.mock('@/components/sheets/sheet-settings-registry', () => ({
  sheetSettingsEntryOf: () => published,
}));
const board = { canImport: true, onImportCsv: vi.fn(), csvText: () => 'Key,Title' };
let boardPublished: typeof board | undefined = board;
vi.mock('@/components/plan/board-csv-registry', () => ({
  boardCsvEntryOf: (id: string) => (id === 'b' ? boardPublished : undefined),
}));

const { tabDataRows } = await import('./tab-data-rows');

const sheetTab = {
  kind: 'sheet' as const,
  elements: [{ id: 'el', type: 'shape', shape: 'plan-sheet' }] as unknown as Element[],
};

// Download CSV is the Export dialog's CSV now (lib/export-plan/tab-csv.ts); the menu keeps Import CSV… alone.
describe('a tab menu’s Import CSV…', () => {
  it('is the Sheet’s own import on a Sheet tab', () => {
    const rows = tabDataRows(sheetTab)!;
    expect(rows.importLabel).toBe('Import CSV…');
    rows.onImport!();
    expect(entry.onImportCsv).toHaveBeenCalledOnce();
  });

  it('offers no import to someone who may not shape the Sheet', () => {
    published = { ...entry, controller: { ...entry.controller, canShape: false } };
    expect(tabDataRows(sheetTab)!.onImport).toBeUndefined();
    published = entry;
  });

  it('keeps the project’s dialogs on any other tab', () => {
    expect(tabDataRows({ kind: undefined, elements: [] })).toBeUndefined();
    expect(tabDataRows({ kind: 'sheet', elements: [] })).toBeUndefined();
  });

  const boardTab = {
    kind: 'board' as const,
    elements: [{ id: 'b', type: 'shape', shape: 'plan-board' }] as unknown as Element[],
  };

  it('is the board’s own import on a Board tab', () => {
    const rows = tabDataRows(boardTab)!;
    expect(rows.importLabel).toBe('Import CSV…');
    rows.onImport!();
    expect(board.onImportCsv).toHaveBeenCalledOnce();
  });

  it('offers no import to someone who may not add cards', () => {
    boardPublished = { ...board, canImport: false };
    expect(tabDataRows(boardTab)!.onImport).toBeUndefined();
    boardPublished = undefined;
    expect(tabDataRows(boardTab)!.onImport).toBeUndefined();
    boardPublished = board;
  });

  it('keeps the project’s dialogs on a Board tab without its board', () => {
    expect(tabDataRows({ kind: 'board', elements: [] })).toBeUndefined();
  });
});
