'use client';

// A Board or Sheet tab's Import and Download CSV in its tab menu (docs/specs/026-plan/plan-tabs.md "Board tab and Sheet
// tab"): only what fits the tab's one element. A Sheet tab imports and downloads CSV through its Sheet's own actions
// (Sheet Settings' registry), a Board tab through its board's (board-csv-registry.ts); any other tab keeps the
// document's Import dialog. Export opens the Export dialog on every tab, with the formats that suit its kind.
import type { Tab } from '@livediagram/document';
import { downloadSheetCsv } from '@/components/sheets/sheet-csv';
import { sheetSettingsEntryOf } from '@/components/sheets/sheet-settings-registry';
import { boardCsvEntryOf } from '@/components/plan/board-csv-registry';

export type TabDataRows = {
  importLabel: string;
  // The row after Export: the element's own data as a file.
  downloadLabel: string;
  // Absent: this person may not import into it.
  onImport?: () => void;
  onDownload: () => void;
};

export function tabDataRows(tab: Pick<Tab, 'kind' | 'elements'>): TabDataRows | undefined {
  if (tab.kind === 'board') return boardDataRows(tab);
  if (tab.kind !== 'sheet') return undefined;
  const sheet = tab.elements.find((el) => el.type === 'shape' && el.shape === 'plan-sheet');
  if (!sheet) return undefined;
  // Read at the press: the Sheet publishes its controller as it renders.
  const entry = () => sheetSettingsEntryOf(sheet.id);
  const now = entry();
  return {
    importLabel: 'Import CSV…',
    downloadLabel: 'Download CSV',
    ...(now?.controller.canShape ? { onImport: () => entry()?.onImportCsv() } : {}),
    onDownload: () => {
      const e = entry();
      if (e) downloadSheetCsv(e.controller.workbook, e.controller.sheet);
    },
  };
}

function boardDataRows(tab: Pick<Tab, 'elements'>): TabDataRows | undefined {
  const board = tab.elements.find((el) => el.type === 'shape' && el.shape === 'plan-board');
  if (!board) return undefined;
  // Read at the press as well: the board publishes its actions as it renders.
  const entry = () => boardCsvEntryOf(board.id);
  return {
    importLabel: 'Import CSV…',
    downloadLabel: 'Download CSV',
    ...(entry()?.canImport ? { onImport: () => entry()?.onImportCsv() } : {}),
    onDownload: () => entry()?.onDownloadCsv(),
  };
}
