'use client';

// The Import dialog's Into This Tab row for a tab (docs/specs/026-plan/plan-tabs.md "The Import dialog"): what the tab
// itself takes. A Board tab takes a CSV through its board's own import (board-csv-registry.ts), a Sheet tab through its
// Sheet's (Sheet Settings' registry); any other tab a liveplanner tab's JSON, which replaces it. Read when the dialog
// or the tab menu draws, and the board's and Sheet's actions again at the press.
import type { Tab } from '@liveplanner/project';
import { sheetSettingsEntryOf } from '@/components/sheets/sheet-settings-registry';
import { boardCsvEntryOf } from '@/components/plan/board-csv-registry';

// Why the row is dimmed, said under it.
export const INTO_TAB_LOCKED = 'This tab is locked. Unlock it to import into it.';
export const INTO_BOARD_BLOCKED = 'Only someone who may add cards can import here.';
export const INTO_SHEET_BLOCKED = 'Only someone who may change this sheet can import here.';

export type IntoTab =
  | { kind: 'json'; blocked?: string }
  | {
      kind: 'csv';
      target: 'board' | 'sheet';
      blocked?: string;
      // The tab's own picker and import.
      onPick: () => void;
      // A file already in hand (dropped on the dialog), read as a picked one.
      onFile: (file: File) => void;
    };

type TabLike = Pick<Tab, 'kind' | 'elements'> & { locked?: boolean };

const elementOf = (tab: TabLike, shape: string) =>
  tab.elements.find((el) => el.type === 'shape' && el.shape === shape);

export function intoTabOf(tab: TabLike): IntoTab {
  const locked = tab.locked === true;
  const board = tab.kind === 'board' ? elementOf(tab, 'plan-board') : undefined;
  if (board) {
    const entry = () => boardCsvEntryOf(board.id);
    const blocked = locked ? INTO_TAB_LOCKED : entry()?.canImport ? undefined : INTO_BOARD_BLOCKED;
    return {
      kind: 'csv',
      target: 'board',
      ...(blocked ? { blocked } : {}),
      onPick: () => entry()?.onImportCsv(),
      onFile: (file) => entry()?.onImportCsvFile(file),
    };
  }
  const sheet = tab.kind === 'sheet' ? elementOf(tab, 'plan-sheet') : undefined;
  if (sheet) {
    const entry = () => sheetSettingsEntryOf(sheet.id);
    const blocked = locked
      ? INTO_TAB_LOCKED
      : entry()?.controller.canShape
        ? undefined
        : INTO_SHEET_BLOCKED;
    return {
      kind: 'csv',
      target: 'sheet',
      ...(blocked ? { blocked } : {}),
      onPick: () => entry()?.onImportCsv(),
      onFile: (file) => entry()?.onImportCsvFile(file),
    };
  }
  return locked ? { kind: 'json', blocked: INTO_TAB_LOCKED } : { kind: 'json' };
}
