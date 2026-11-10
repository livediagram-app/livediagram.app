// The sheet store's shapes (sheet-store-client.ts): how a write is made, what the store is given, and what it keeps
// per sheet.
import type { Sheet, SheetLayout, SheetPerson, SheetWrite } from '@liveplanner/sheets';
import type { ItemUndoStep } from '@/hooks/plan/item-undo-journal';
import type {
  createSheet,
  deleteSheet,
  fetchSheets,
  writeSheet,
  SheetsScope,
} from '@/lib/api/sheets';
import type { SheetQueueDeps } from './sheet-store-queue';

// How a write is made: `undoable` false for an undo or redo itself (`undo` true then); `alongside`, a change outside
// the sheet made with it (Clear Sheet taking the Sheet's charts), undone and redone with it as one step.
// `unchecked`: written as it is, past the validation rules (an import, a card table's sync, a template's start;
// data-validation.md "Where values are checked").
export type WriteOpts = {
  undoable?: boolean;
  undo?: boolean;
  unchecked?: boolean;
  alongside?: ItemUndoStep;
};

export type SheetStoreDeps = {
  scope: SheetsScope;
  self: () => SheetPerson | null;
  locale: string;
  pushUndo: (step: ItemUndoStep) => void;
  toast: (message: string) => void;
  // Injected in tests.
  api?: {
    fetchSheets: typeof fetchSheets;
    createSheet: typeof createSheet;
    writeSheet: typeof writeSheet;
    deleteSheet: typeof deleteSheet;
  };
  // The wait before a write is sent again; injected in tests.
  wait?: (ms: number) => Promise<void>;
  // The plan's queue of waiting changes and what of this session's may wait in it (docs/specs/007-editor/
  // offline-changes.md); absent, nothing is kept past the tab, as for an Offline Mode project.
} & SheetQueueDeps;

// `seq`: when it was made, which orders it in the queue of waiting changes.
export type Pending = { wid: string; write: SheetWrite; seq: number };
// One sheet's part of an undo step; a deletion's also keeps the layout it was made on and what it did, to be undone
// against the sheet as it is at the undo.
export type Inverse = {
  sheetId: string;
  write: SheetWrite;
  before?: SheetLayout;
  applied?: SheetWrite;
};
export type Entry = { confirmed: Sheet; pending: Pending[]; view: Sheet };
export type TabStatus = 'loading' | 'ready' | 'error';
