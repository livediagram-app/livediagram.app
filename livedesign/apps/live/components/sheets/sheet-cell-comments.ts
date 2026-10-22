// Cell comments on the grid (docs/specs/029-sheets/sheet.md "Cell comments"): which cells show a marker, where,
// and what the hover preview says. Pure; the markers are worked out once per change to the threads or the layout
// (a WeakMap on both), so a scroll frame or a hover reads a ready list.
import type { CellCommentThreads, Comment } from '@livedesign/document';
import { cellKey, layoutIndex, type SheetLayout } from '@livedesign/sheets';

// The comment colour: a marker's triangle (Tailwind amber-500).
export const CELL_COMMENT_COLOUR = '#f59e0b';
// A marker's side, in px at 100% zoom.
export const CELL_MARKER_PX = 8;
// How long the pointer rests on a commented cell before its preview shows.
export const CELL_PREVIEW_DELAY_MS = 400;
// The most characters of the first comment the preview shows.
export const CELL_PREVIEW_CHARS = 140;

export type CellMarker = { cell: string; r: number; c: number; count: number; first: Comment };

const MARKERS = new WeakMap<CellCommentThreads, { layout: SheetLayout; markers: CellMarker[] }>();

// The open threads of cells still on the sheet, with their positions: a resolved thread, or one whose row or
// column was deleted, draws nothing.
export function cellMarkers(
  threads: CellCommentThreads | undefined,
  layout: SheetLayout,
): CellMarker[] {
  if (!threads) return [];
  const hit = MARKERS.get(threads);
  if (hit && hit.layout === layout) return hit.markers;
  const ix = layoutIndex(layout);
  const markers: CellMarker[] = [];
  for (const [cell, thread] of Object.entries(threads)) {
    if (thread.resolved || thread.comments.length === 0) continue;
    const i = cell.indexOf(':');
    const r = ix.rowPos.get(cell.slice(0, i));
    const c = ix.colPos.get(cell.slice(i + 1));
    if (r === undefined || c === undefined) continue;
    markers.push({ cell, r, c, count: thread.comments.length, first: thread.comments[0]! });
  }
  MARKERS.set(threads, { layout, markers });
  return markers;
}

// The cell key at a position, or null off the grid.
export function cellKeyAt(layout: SheetLayout, r: number, c: number): string | null {
  const row = layout.rows[r];
  const col = layout.cols[c];
  return row && col ? cellKey(row, col) : null;
}

// What a marker's preview says: the first comment's author and words, and how many more follow.
export function cellPreview(marker: Pick<CellMarker, 'count' | 'first'>): {
  author: string;
  text: string;
  more: string | null;
} {
  const words = marker.first.text.trim();
  const text =
    words.length > CELL_PREVIEW_CHARS ? `${words.slice(0, CELL_PREVIEW_CHARS - 1)}…` : words;
  const rest = marker.count - 1;
  return {
    author: marker.first.authorName,
    text,
    more: rest > 0 ? `${rest} more` : null,
  };
}

// Ctrl + Alt + M (⌘ ⌥ M on Apple devices): open the active cell's thread, as Google Sheets does. Read by the key's
// code, since Alt changes the character it types on a Mac.
export function isCommentShortcut(e: {
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}): boolean {
  return e.code === 'KeyM' && e.altKey && (e.ctrlKey || e.metaKey) && !e.shiftKey;
}
