// DOM <-> runs glue for the rich-text editor (spec/09). Kept separate from
// the React component so the offset mapping is small, framework-free, and
// easy to reason about. The pure runs algebra lives in @livediagram/diagram
// (rich-text.ts); this module only bridges it to a live contentEditable.
//
// Invariant the whole design rests on: the editor renders runs as a flat
// list of sibling <span>s and inserts newlines as literal '\n' text (never
// <br>/<div>), so `runsPlainText(runs).length === editorEl.textContent.length`
// and a single string-length walk converts between DOM points and character
// offsets in both directions.

import { normalizeRuns, type RunSize, type TextRun } from '@livediagram/diagram';

// data-* attribute names carried on each rendered span. Render
// (`dataAttrsForRun`) and read-back (`readRunsFromDom`) must agree, so they
// share these constants. The values are the RUN's own deltas (not the
// effective appearance) — newly typed characters land inside a span and so
// inherit exactly the deltas read back here.
const DATA = {
  bold: 'data-rt-bold',
  italic: 'data-rt-italic',
  underline: 'data-rt-underline',
  strikethrough: 'data-rt-strike',
  size: 'data-rt-size',
  color: 'data-rt-color',
} as const;

// Marks the render-only trailing <br>. A '\n' at the very end of the content
// isn't drawn as an empty last line under white-space: pre-wrap (so a single
// Enter at the end looked like nothing happened until you pressed it twice);
// a trailing <br> forces that line to show. It carries no logical text, so
// read-back skips it and the offset walk never sees it (it has no text).
const RENDER_NEWLINE_ATTR = 'data-rt-render-nl';

// Add or remove the render-only trailing <br> so it's present exactly when
// the editor's text ends in a newline. Caret-safe: the sentinel always sits
// at the very end (after any caret), so adding/removing it never moves the
// selection. Call after any edit that may change the trailing character.
export function reconcileTrailingNewline(editorEl: HTMLElement): void {
  const last = editorEl.lastChild;
  const isSentinel =
    last instanceof HTMLElement && last.tagName === 'BR' && last.hasAttribute(RENDER_NEWLINE_ATTR);
  const endsWithNewline = (editorEl.textContent ?? '').endsWith('\n');
  if (endsWithNewline && !isSentinel) {
    const br = document.createElement('br');
    br.setAttribute(RENDER_NEWLINE_ATTR, '');
    editorEl.appendChild(br);
  } else if (!endsWithNewline && isSentinel) {
    editorEl.removeChild(last);
  }
}

/** React props (data-* attrs) describing a run's deltas, for the editor to spread onto its span. */
export function dataAttrsForRun(run: TextRun): Record<string, string> {
  const out: Record<string, string> = {};
  if (run.bold !== undefined) out[DATA.bold] = String(run.bold);
  if (run.italic !== undefined) out[DATA.italic] = String(run.italic);
  if (run.underline !== undefined) out[DATA.underline] = String(run.underline);
  if (run.strikethrough !== undefined) out[DATA.strikethrough] = String(run.strikethrough);
  if (run.size !== undefined) out[DATA.size] = run.size;
  if (run.color !== undefined) out[DATA.color] = run.color;
  return out;
}

// Parse a span's data-* attrs back into a run's deltas. A "true"/"false"
// string is the explicit boolean delta; absent means inherit (undefined).
function attrsFromElement(el: HTMLElement): Omit<TextRun, 'text'> {
  const out: Omit<TextRun, 'text'> = {};
  const bool = (name: string): boolean | undefined => {
    const v = el.getAttribute(name);
    return v === null ? undefined : v === 'true';
  };
  const b = bool(DATA.bold);
  const i = bool(DATA.italic);
  const u = bool(DATA.underline);
  const s = bool(DATA.strikethrough);
  if (b !== undefined) out.bold = b;
  if (i !== undefined) out.italic = i;
  if (u !== undefined) out.underline = u;
  if (s !== undefined) out.strikethrough = s;
  const size = el.getAttribute(DATA.size);
  if (size === 'sm' || size === 'md' || size === 'lg') out.size = size as RunSize;
  const color = el.getAttribute(DATA.color);
  if (color) out.color = color;
  return out;
}

// Does this element carry any of our run data-* attributes?
function hasRunData(el: HTMLElement): boolean {
  return Object.values(DATA).some((name) => el.hasAttribute(name));
}

/**
 * Read the editor's current DOM back into a normalized runs array. Walks
 * the tree depth-first: our spans contribute their data-* deltas to their
 * subtree (so typed characters inherit the span they landed in); a <br>
 * (which a browser may still inject despite our newline handling)
 * contributes a literal '\n'; bare text nodes and foreign wrappers
 * contribute plain (inherited) text. This is robust to nesting so a line
 * break never silently collapses on commit.
 */
export function readRunsFromDom(editorEl: HTMLElement): TextRun[] {
  const runs: TextRun[] = [];
  const visit = (node: Node, attrs: Omit<TextRun, 'text'>) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent ?? '';
        if (text) runs.push({ text, ...attrs });
      } else if (child instanceof HTMLElement) {
        if (child.tagName === 'BR') {
          // A render-only sentinel (RENDER_NEWLINE_ATTR) makes a trailing
          // newline show its empty last line under white-space: pre-wrap; it
          // is NOT part of the logical text, so skip it on read-back.
          if (child.hasAttribute(RENDER_NEWLINE_ATTR)) continue;
          runs.push({ text: '\n' });
          continue;
        }
        visit(child, hasRunData(child) ? attrsFromElement(child) : attrs);
      }
    }
  };
  visit(editorEl, {});
  return normalizeRuns(runs);
}

/**
 * Convert the live selection to character offsets into the editor's plain
 * text. Returns null when there's no selection or it isn't fully inside the
 * editor. Reads `range.start/end` (always document-ordered) so a
 * right-to-left drag still yields start <= end.
 */
export function domSelectionToOffsets(
  editorEl: HTMLElement,
): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!editorEl.contains(range.startContainer) || !editorEl.contains(range.endContainer)) {
    return null;
  }
  const offsetOf = (container: Node, off: number): number => {
    const pre = document.createRange();
    pre.selectNodeContents(editorEl);
    pre.setEnd(container, off);
    return pre.toString().length;
  };
  return {
    start: offsetOf(range.startContainer, range.startOffset),
    end: offsetOf(range.endContainer, range.endOffset),
  };
}

/**
 * Inverse of `domSelectionToOffsets`: build a Range spanning the character
 * offsets [start, end) across the freshly-rendered spans, used to restore
 * the selection after React re-renders the runs. Offsets are clamped so a
 * runs-shrink between read and restore can't throw.
 */
export function offsetsToDomRange(editorEl: HTMLElement, start: number, end: number): Range {
  const range = document.createRange();
  const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT);
  let acc = 0;
  let startNode: Node | null = null;
  let startOff = 0;
  let endNode: Node | null = null;
  let endOff = 0;
  let last: Node | null = null;
  let node = walker.nextNode();
  while (node) {
    const len = node.textContent?.length ?? 0;
    last = node;
    if (startNode === null && acc + len >= start) {
      startNode = node;
      startOff = start - acc;
    }
    if (acc + len >= end) {
      endNode = node;
      endOff = end - acc;
      break;
    }
    acc += len;
    node = walker.nextNode();
  }
  // No text nodes at all (empty editor): collapse inside the element.
  if (!last) {
    range.selectNodeContents(editorEl);
    range.collapse(true);
    return range;
  }
  // Offsets ran past the content (runs shrank): clamp to the last node.
  if (startNode === null) {
    startNode = last;
    startOff = last.textContent?.length ?? 0;
  }
  if (endNode === null) {
    endNode = last;
    endOff = last.textContent?.length ?? 0;
  }
  const clamp = (n: Node, o: number) => Math.max(0, Math.min(o, n.textContent?.length ?? 0));
  range.setStart(startNode, clamp(startNode, startOff));
  range.setEnd(endNode, clamp(endNode, endOff));
  return range;
}

/**
 * Insert plain text at the caret as a real text node (splitting the current
 * text node in place), instead of `execCommand('insertText')` which inserts
 * a <br>/<div> for newlines that `textContent` then drops on read-back. Used
 * for Enter ('\n') and paste so newlines survive as literal characters and
 * the plain-text-length invariant holds. Programmatic, so the caller must
 * re-sync runs afterwards (no input event fires).
 */
export function insertTextAtCaret(text: string): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  // Caret just after the inserted text.
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Replace the live selection with the given range (focus must already be in the editor). */
export function selectRange(range: Range): void {
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}
