// What the editor's main bundle knows of a Sheet's cells for its cell comments (docs/specs/029-sheets/sheet.md "Cell
// comments"), without loading the sheet engine: each drawn Sheet registers how to name a cell key (its A1, or null
// once the cell is gone), and listens for the Comments panel asking it to bring a cell into view. A Sheet not drawn
// yet has no namer, and its cell threads read by the Sheet's title alone.
import { useSyncExternalStore } from 'react';
import { createListeners } from '@/lib/listeners';

type Namer = (cell: string) => string | null;

const namers = new Map<string, Namer>();
const focusers = new Map<string, (cell: string) => void>();
const listeners = createListeners();
let version = 0;

function changed() {
  version++;
  listeners.notify();
}

// A drawn Sheet's namer, kept while it is drawn; a new layout registers a new one. Returns the unregister.
export function registerCellNamer(elementId: string, name: Namer): () => void {
  namers.set(elementId, name);
  changed();
  return () => {
    if (namers.get(elementId) !== name) return;
    namers.delete(elementId);
    changed();
  };
}

// The A1 of a cell key on a drawn Sheet; `undefined` when the Sheet is not drawn, null when the cell is gone.
export function cellRefOf(elementId: string, cell: string): string | null | undefined {
  const name = namers.get(elementId);
  return name ? name(cell) : undefined;
}

// The A1 of a cell key, kept current as Sheets are drawn and their layouts move.
export function useCellRef(elementId: string, cell: string | undefined): string | null | undefined {
  useSyncExternalStore(
    listeners.subscribe,
    () => version,
    () => version,
  );
  return cell === undefined ? undefined : cellRefOf(elementId, cell);
}

// A drawn Sheet takes requests to select one of its cells (the Comments panel going to a cell's thread).
export function registerCellFocuser(elementId: string, focus: (cell: string) => void): () => void {
  focusers.set(elementId, focus);
  return () => {
    if (focusers.get(elementId) === focus) focusers.delete(elementId);
  };
}

// Selects `cell` on Sheet `elementId`, scrolling it into view; nothing when the Sheet is not drawn.
export function focusSheetCell(elementId: string, cell: string): void {
  focusers.get(elementId)?.(cell);
}
