// What the editor's main bundle knows of a Sheet's cells for its cell comments (docs/specs/029-sheets/sheet.md "Cell
// comments"), without loading the sheet engine: each drawn Sheet registers how to name a cell key (its A1, or null
// once the cell is gone), and listens for the Comments panel asking it to bring a cell into view. A Sheet not drawn
// yet has no namer, and its cell threads read by the Sheet element's label alone. A drawn Sheet also gives its stored
// title, which names its threads as its toolbar names it.
import { useSyncExternalStore } from 'react';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

type Namer = (cell: string) => string | null;

const namers = new Map<string, { name: Namer; title: string | undefined }>();
const focusers = new Map<string, (cell: string) => void>();
// A cell asked for before its Sheet was drawn (an Inbox link landing as the tab loads), one a Sheet: taken when the
// Sheet registers its focuser within PENDING_FOCUS_MS, so a Sheet drawn much later never jumps to an old ask.
const pendingFocus = new Map<string, { cell: string; at: number }>();
export const PENDING_FOCUS_MS = 10_000;
const listeners = createListeners();
let version = 0;

function changed() {
  version++;
  listeners.notify();
}

// A drawn Sheet's namer, kept while it is drawn; a new layout registers a new one. Returns the unregister.
export function registerCellNamer(elementId: string, name: Namer, title?: string): () => void {
  namers.set(elementId, { name, title: title?.trim() || undefined });
  changed();
  return () => {
    if (namers.get(elementId)?.name !== name) return;
    namers.delete(elementId);
    changed();
  };
}

// The A1 of a cell key on a drawn Sheet; `undefined` when the Sheet is not drawn, null when the cell is gone.
export function cellRefOf(elementId: string, cell: string): string | null | undefined {
  const named = namers.get(elementId);
  return named ? named.name(cell) : undefined;
}

// A drawn Sheet's stored title, kept current as it is renamed; undefined for anything else.
export function useSheetTitle(elementId: string): string | undefined {
  useSyncExternalStore(
    listeners.subscribe,
    () => version,
    () => version,
  );
  return namers.get(elementId)?.title;
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
  const pending = pendingFocus.get(elementId);
  if (pending) {
    pendingFocus.delete(elementId);
    if (Date.now() - pending.at <= PENDING_FOCUS_MS) focus(pending.cell);
  }
  return () => {
    if (focusers.get(elementId) === focus) focusers.delete(elementId);
  };
}

// Selects `cell` on Sheet `elementId`, scrolling it into view; held until the Sheet is drawn when it is not yet.
export function focusSheetCell(elementId: string, cell: string): void {
  const focus = focusers.get(elementId);
  if (focus) focus(cell);
  else pendingFocus.set(elementId, { cell, at: Date.now() });
}
