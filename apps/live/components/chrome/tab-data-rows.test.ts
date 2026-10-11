// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { Element } from '@livediagram/document';

const entry = {
  controller: { canShape: true, workbook: { id: 'wb' }, sheet: { id: 'sh' } },
  actions: {},
  onImportCsv: vi.fn(),
};
let published: typeof entry | undefined = entry;
vi.mock('@/components/sheets/sheet-settings-registry', () => ({
  sheetSettingsEntryOf: () => published,
}));
vi.mock('@/components/sheets/sheet-csv', () => ({ downloadSheetCsv: vi.fn() }));
const board = { canImport: true, onImportCsv: vi.fn(), onDownloadCsv: vi.fn() };
let boardPublished: typeof board | undefined = board;
vi.mock('@/components/plan/board-csv-registry', () => ({
  boardCsvEntryOf: (id: string) => (id === 'b' ? boardPublished : undefined),
}));

const { tabDataRows } = await import('./tab-data-rows');
const { downloadSheetCsv } = await import('@/components/sheets/sheet-csv');

const sheetTab = {
  kind: 'sheet' as const,
  elements: [{ id: 'el', type: 'shape', shape: 'plan-sheet' }] as unknown as Element[],
};

describe('a tab menu’s Import and Download CSV', () => {
  it('is the Sheet’s own CSV on a Sheet tab', () => {
    const rows = tabDataRows(sheetTab)!;
    expect([rows.importLabel, rows.downloadLabel]).toEqual(['Import CSV…', 'Download CSV']);
    rows.onImport!();
    expect(entry.onImportCsv).toHaveBeenCalledOnce();
    rows.onDownload();
    expect(downloadSheetCsv).toHaveBeenCalledWith(
      entry.controller.workbook,
      entry.controller.sheet,
    );
  });

  it('offers no import to someone who may not shape the Sheet', () => {
    published = { ...entry, controller: { ...entry.controller, canShape: false } };
    expect(tabDataRows(sheetTab)!.onImport).toBeUndefined();
    published = entry;
  });

  it('keeps the document’s dialogs on any other tab', () => {
    expect(tabDataRows({ kind: undefined, elements: [] })).toBeUndefined();
    expect(tabDataRows({ kind: 'sheet', elements: [] })).toBeUndefined();
  });

  const boardTab = {
    kind: 'board' as const,
    elements: [{ id: 'b', type: 'shape', shape: 'plan-board' }] as unknown as Element[],
  };

  it('is the board’s own CSV on a Board tab', () => {
    const rows = tabDataRows(boardTab)!;
    expect([rows.importLabel, rows.downloadLabel]).toEqual(['Import CSV…', 'Download CSV']);
    rows.onImport!();
    expect(board.onImportCsv).toHaveBeenCalledOnce();
    rows.onDownload();
    expect(board.onDownloadCsv).toHaveBeenCalledOnce();
  });

  it('offers no import to someone who may not add cards, and still the download', () => {
    boardPublished = { ...board, canImport: false };
    const rows = tabDataRows(boardTab)!;
    expect(rows.onImport).toBeUndefined();
    rows.onDownload();
    expect(board.onDownloadCsv).toHaveBeenCalledOnce();
    boardPublished = undefined;
    expect(tabDataRows(boardTab)!.onImport).toBeUndefined();
    expect(() => tabDataRows(boardTab)!.onDownload()).not.toThrow();
    boardPublished = board;
  });

  it('keeps the document’s dialogs on a Board tab without its board', () => {
    expect(tabDataRows({ kind: 'board', elements: [] })).toBeUndefined();
  });
});
