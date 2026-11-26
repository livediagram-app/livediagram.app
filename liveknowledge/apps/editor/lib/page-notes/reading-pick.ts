// The words a reader picked in a page's writing, as the reading selection bar and its keys read them
// (docs/specs/030-knowledgebase/page-comments.md "Comments on the writing"): only in the writing while it is read
// (its view is not editable), never in the Title or a table's cell, where a note takes no mark. Pure but for the DOM
// it is handed.

/** Where the words picked may take a note: their writing and their boxes; null when they may not. */
export type ReadingPick = { writing: HTMLElement; first: DOMRect; last: DOMRect; whole: DOMRect };

// The writing's view while read: ProseMirror's own root, which marks itself read only (article-view-mount.ts).
const READ_WRITING = '.article-flow[data-readonly]';
// Where no note goes: the Title (the writing's h1), a table's cell.
const NO_NOTE = 'h1, table';

const elementOf = (node: Node): Element | null =>
  node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;

/** The writing being read that holds the whole of `range`, or null. */
export function readWritingOf(range: Range): HTMLElement | null {
  const start = elementOf(range.startContainer)?.closest<HTMLElement>(READ_WRITING) ?? null;
  if (!start) return null;
  const end = elementOf(range.endContainer)?.closest<HTMLElement>(READ_WRITING) ?? null;
  return end === start ? start : null;
}

/** Whether the words start or end where a note takes no mark. */
export function inNoNoteSpot(range: Range): boolean {
  return [range.startContainer, range.endContainer].some((n) => !!elementOf(n)?.closest(NO_NOTE));
}

/** The words picked now in a writing being read, where a note may go; null otherwise. */
export function readingPick(selection: Selection | null): ReadingPick | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!selection.toString().trim()) return null;
  const writing = readWritingOf(range);
  if (!writing || inNoNoteSpot(range)) return null;
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
  const first = rects[0];
  const last = rects[rects.length - 1];
  if (!first || !last) return null;
  return { writing, first, last, whole: range.getBoundingClientRect() };
}

/** The bar's size, px: two labelled buttons on the toolbar card. */
export const NOTE_BAR_SIZE = { width: 232, height: 44 } as const;
/** Its gap from the words, and from the screen's edge. */
export const NOTE_BAR_GAP = 8;

/** Where the bar's corner goes: above the words' first line, centred on them, or under their last line when there is
 *  no room above; kept on the screen. */
export function noteBarSpot(
  pick: Pick<ReadingPick, 'first' | 'last' | 'whole'>,
  screen: { width: number; height: number },
  size: { width: number; height: number } = NOTE_BAR_SIZE,
): { x: number; y: number; below: boolean } {
  const centre = pick.whole.left + pick.whole.width / 2;
  const x = Math.round(
    Math.min(
      Math.max(NOTE_BAR_GAP, centre - size.width / 2),
      Math.max(NOTE_BAR_GAP, screen.width - size.width - NOTE_BAR_GAP),
    ),
  );
  const above = pick.first.top - NOTE_BAR_GAP - size.height;
  if (above >= NOTE_BAR_GAP) return { x, y: Math.round(above), below: false };
  const under = Math.min(
    pick.last.bottom + NOTE_BAR_GAP,
    screen.height - size.height - NOTE_BAR_GAP,
  );
  return { x, y: Math.round(under), below: true };
}

/** The note a key asks for while words are picked: ⌘⌥M (Ctrl+Alt+M) a comment, ⌘⌥A (Ctrl+Alt+A) an action. By the
 *  key's place, since Option changes the letter a Mac types. */
export function noteKeyOf(
  e: Pick<KeyboardEvent, 'code' | 'altKey' | 'metaKey' | 'ctrlKey' | 'shiftKey'>,
  apple: boolean,
): 'comment' | 'action' | null {
  if (!e.altKey || e.shiftKey || (apple ? !e.metaKey || e.ctrlKey : !e.ctrlKey || e.metaKey))
    return null;
  if (e.code === 'KeyM') return 'comment';
  if (e.code === 'KeyA') return 'action';
  return null;
}
