// Mixed-direction text painted a line at a time (liveworkspace/docs/specs/011-workbench/label-editor.md
// "Right-to-left text over several lines"; each editor's docs/specs/008-canvas/canvas-performance.md "Typing in a
// long label stays light").
//
// A label's lines each read in the direction of their own first letter. `unicode-bidi: plaintext` says that for the
// whole text, at a cost that grows with the square of a line's length. Painted a line at a time, each line's runs sit
// inside an isolate of their own (`dir="auto"`, `unicode-bidi: isolate`) and the editor is one isolate too: the same
// ink, at the cost of an isolated run. Each newline is a run span of its own outside the lines, carrying the
// attributes of the run it came from, so the runs read back (rich-text-dom.ts `readRunsFromDom`) are exactly the runs
// painted and the offsets stay a walk over the text.

import type { TextRun } from '@liveworkspace/model-core/rich-text';
import { isRenderNewline } from './rich-text-dom';

/** Marks a line's isolate. It carries no run data, so read-back hands its runs the attributes they have. */
export const LINE_ATTR = 'data-rt-line';

/** One line of the text: its runs (no newline in them), then the newline that ends it, when one does. */
export type RunLine = { runs: TextRun[]; newline: TextRun | null };

/** The runs, line by line: each newline a run of its own with the attributes of the run it was in. */
export function runsByLine(runs: readonly TextRun[]): RunLine[] {
  const lines: RunLine[] = [];
  let current: TextRun[] = [];
  for (const run of runs) {
    const parts = run.text.split('\n');
    parts.forEach((part, i) => {
      if (i > 0) {
        lines.push({ runs: current, newline: { ...run, text: '\n' } });
        current = [];
      }
      if (part) current.push({ ...run, text: part });
    });
  }
  lines.push({ runs: current, newline: null });
  return lines;
}

/**
 * Paint `runs` into `editor` a line at a time: each line with text in its isolate, each newline outside them.
 * `spanFor` makes a run's span, as the flat paint does.
 */
export function paintRunLines(
  editor: HTMLElement,
  runs: readonly TextRun[],
  spanFor: (run: TextRun) => HTMLElement,
): void {
  // Appended one by one, never spread: a text can hold more runs than a call takes arguments.
  const nodes = document.createDocumentFragment();
  for (const line of runsByLine(runs)) {
    if (line.runs.length > 0) {
      const isolate = document.createElement('span');
      isolate.setAttribute(LINE_ATTR, '');
      isolate.dir = 'auto';
      isolate.style.unicodeBidi = 'isolate';
      for (const run of line.runs) isolate.appendChild(spanFor(run));
      nodes.appendChild(isolate);
    }
    if (line.newline) nodes.appendChild(spanFor(line.newline));
  }
  editor.replaceChildren(nodes);
}

function isLine(node: Node): node is HTMLElement {
  return node instanceof HTMLElement && node.hasAttribute(LINE_ATTR);
}

// How many newlines a run span holding only newlines holds; 0 for anything else.
function newlineSpanLength(node: Node): number {
  const text = node instanceof HTMLElement ? node.textContent : null;
  if (!text) return 0;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) !== 10) return 0;
  return text.length;
}

function newlinesIn(text: string): number {
  let count = 0;
  for (let at = text.indexOf('\n'); at >= 0; at = text.indexOf('\n', at + 1)) count++;
  return count;
}

/**
 * Whether `editor`, painted a line at a time, still keeps its lines apart for `text` (its plain text): line isolates
 * and newline spans with no two lines side by side and no bare text, and every newline of the text in a newline span
 * rather than inside a line. One pass over the editor's children; what a typed character inside a line never breaks.
 */
export function linesStillApart(editor: HTMLElement, text: string): boolean {
  let newlines = 0;
  let afterLine = false;
  for (const child of Array.from(editor.childNodes)) {
    if (isRenderNewline(child)) continue;
    if (isLine(child)) {
      if (afterLine) return false;
      afterLine = true;
      continue;
    }
    const length = newlineSpanLength(child);
    if (length === 0) return false;
    newlines += length;
    afterLine = false;
  }
  return newlines === newlinesIn(text);
}

/**
 * The direction the line holding the caret reads in, or null when the caret is in no line (an empty line, a caret
 * between the editor's children, or no selection in `editor`). The editor takes it on, so the caret at a line's end
 * draws at that line's own end, as when every line was a paragraph of its own.
 */
export function caretLineDirection(
  editor: HTMLElement,
  selection: Selection | null,
): 'ltr' | 'rtl' | null {
  const node = selection?.focusNode;
  const host = node instanceof Element ? node : node?.parentElement;
  const line = host?.closest<HTMLElement>(`[${LINE_ATTR}]`);
  if (!line || !editor.contains(line)) return null;
  return getComputedStyle(line).direction === 'rtl' ? 'rtl' : 'ltr';
}
