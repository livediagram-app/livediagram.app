// Cell comments (docs/specs/029-sheets/sheet.md "Cell comments"): a Sheet element carries, beside its own
// `commentThread`, a thread per cell in `cellComments`, keyed by the cell's row and column ids (`rowId:colId`, as
// the sheet store names a cell), so a thread follows its cell through inserted, moved and sorted lines.
//
// Every reader and writer of threads goes through these helpers, so an element's own thread and its cells' threads
// are one set of threads to the comment deltas, the room ledger, author redaction and the thread listing.
//
// A LEAF module: type imports only.

import type { Element } from './index';
import type { CommentThread } from './comments';

// The most cell threads one Sheet carries.
export const CELL_THREADS_MAX = 1000;
// A cell key: a row id and a column id (@livediagram/sheets AXIS_ID_PATTERN each), repeated here so the document
// package never imports the engine.
export const CELL_KEY_PATTERN = /^[a-z0-9]{4,12}:[a-z0-9]{4,12}$/;

export type CellCommentThreads = Record<string, CommentThread>;

// One thread an element holds: its own (no cell) or a cell's.
export type ThreadEntry = { cell?: string; thread: CommentThread };

export function isCellKey(value: unknown): value is string {
  return typeof value === 'string' && CELL_KEY_PATTERN.test(value);
}

// Only a Sheet element takes cell threads.
export function takesCellThreads(el: Element): boolean {
  return el.type === 'shape' && el.shape === 'plan-sheet';
}

export function cellThreadsOf(el: Element): CellCommentThreads | undefined {
  return (el as { cellComments?: CellCommentThreads }).cellComments;
}

// The thread on the element (no cell) or on one of its cells.
export function threadAt(el: Element, cell?: string): CommentThread | undefined {
  if (cell === undefined) return (el as { commentThread?: CommentThread }).commentThread;
  const cells = cellThreadsOf(el);
  return cells && Object.prototype.hasOwnProperty.call(cells, cell) ? cells[cell] : undefined;
}

// The element with the thread at `cell` (or its own, no cell) set, or removed when `thread` is undefined. A cell
// thread on an element that takes none leaves the element as it is.
export function withThreadAt(
  el: Element,
  cell: string | undefined,
  thread: CommentThread | undefined,
): Element {
  if (cell === undefined) {
    const { commentThread: _drop, ...rest } = el as Element & { commentThread?: CommentThread };
    return (thread ? { ...rest, commentThread: thread } : rest) as Element;
  }
  if (!takesCellThreads(el)) return el;
  const { [cell]: _gone, ...others } = cellThreadsOf(el) ?? {};
  const cells: CellCommentThreads = thread ? { ...others, [cell]: thread } : others;
  const { cellComments: _old, ...rest } = el as Element & { cellComments?: CellCommentThreads };
  return (Object.keys(cells).length ? { ...rest, cellComments: cells } : rest) as Element;
}

// Every thread the element holds: its own first, then its cells' in key order.
export function elementThreads(el: Element): ThreadEntry[] {
  const own = (el as { commentThread?: CommentThread }).commentThread;
  const out: ThreadEntry[] = own ? [{ thread: own }] : [];
  const cells = cellThreadsOf(el);
  if (cells) for (const cell of Object.keys(cells).sort()) out.push({ cell, thread: cells[cell]! });
  return out;
}

// The element with every thread passed through `fn` (undefined drops the thread). The SAME element when `fn`
// changes nothing, so callers keep identity.
export function mapElementThreads(
  el: Element,
  fn: (thread: CommentThread, cell: string | undefined) => CommentThread | undefined,
): Element {
  let next = el;
  for (const { cell, thread } of elementThreads(el)) {
    const mapped = fn(thread, cell);
    if (mapped !== thread) next = withThreadAt(next, cell, mapped);
  }
  return next;
}

// The thread holding comment `commentId`, and its cell (none for the element's own), or null.
export function threadHolding(el: Element, commentId: string): ThreadEntry | null {
  for (const entry of elementThreads(el)) {
    if (entry.thread.comments?.some((c) => c.id === commentId)) return entry;
  }
  return null;
}
