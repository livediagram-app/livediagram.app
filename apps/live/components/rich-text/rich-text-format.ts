// Pure helpers shared by every runs-backed editor (element labels, docs/specs/008-canvas/canvas-and-palette.md;
// element notes, docs/specs/009-elements/rich-text-notes.md): applying a CSSProperties object onto a live DOM
// style, expanding a caret to the word around it, and computing a toolbar's
// active format from the current selection.
//
// Deliberately free of `BoxedElement`: a run's unset attribute inherits a
// BASE, and who supplies that base differs per host (a label inherits the
// element's whole-element text fields, a note inherits fixed body defaults).
// Callers pass a `RunDefaults` instead, so one implementation serves both.

import {
  runsPlainText,
  type RunBoolKey,
  type RunHeading,
  type TextRun,
} from '@liveplanner/document';

// The base an unset run delta falls back to.
export type RunDefaults = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  color: string | null;
};

// Runs carry no formatting of their own until the user applies some, so an
// editor with no whole-element base (the note editor) starts from all-off.
export const PLAIN_RUN_DEFAULTS: RunDefaults = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  color: null,
};

// The resolved formatting of the current selection: each boolean is true
// when EVERY character in the selection is effectively-on; color / heading /
// link are the uniform value across the selection, or null when mixed.
export type ActiveFormat = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  color: string | null;
  heading: RunHeading | null;
  link: string | null;
};

// Whether two toolbar states show the same thing (every field is a primitive).
export function sameActiveFormat(a: ActiveFormat, b: ActiveFormat): boolean {
  return (
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.strikethrough === b.strikethrough &&
    a.color === b.color &&
    a.heading === b.heading &&
    a.link === b.link
  );
}

export function applyCss(target: CSSStyleDeclaration, props: React.CSSProperties): void {
  const declared: [string, unknown][] = Object.entries(props);
  for (const [k, v] of declared) {
    if (typeof v !== 'string' && typeof v !== 'number') continue;
    (target as unknown as Record<string, string>)[k] = String(v);
  }
}

/**
 * Expand a collapsed caret to the word it sits in (or just left of), so a
 * toolbar click with no selection formats the surrounding word. Returns
 * null when there's no word to act on (whitespace / empty).
 */
export function wordRangeAt(text: string, pos: number): { start: number; end: number } | null {
  const n = text.length;
  if (n === 0) return null;
  const ws = (i: number) => i < 0 || i >= n || /\s/.test(text[i]!);
  let i = Math.max(0, Math.min(pos, n));
  if (ws(i)) i -= 1; // caret at end of / after a word -> use the char to the left
  if (i < 0 || ws(i)) return null;
  let start = i;
  let end = i + 1;
  while (start > 0 && !ws(start - 1)) start--;
  while (end < n && !ws(end)) end++;
  return { start, end };
}

// The slice of runs covering [start, end) as effective attrs, used to
// decide toolbar active-state. Walks runs accumulating offsets.
export function computeActiveFormat(
  runs: TextRun[],
  range: { start: number; end: number } | null,
  defaults: RunDefaults,
): ActiveFormat {
  const empty: ActiveFormat = { ...defaults, heading: null, link: null };
  if (!range) return empty;
  let { start, end } = range;
  if (start === end) {
    // Reflect the run just left of the caret so the toolbar reads sensibly.
    const w = wordRangeAt(runsPlainText(runs), start);
    if (!w) return empty;
    start = w.start;
    end = w.end;
  }
  const covered: TextRun[] = [];
  let pos = 0;
  for (const run of runs) {
    const runEnd = pos + run.text.length;
    if (pos < end && runEnd > start) covered.push(run);
    pos = runEnd;
  }
  if (covered.length === 0) return empty;
  const allBool = (key: RunBoolKey) => covered.every((r) => (r[key] ?? defaults[key]) === true);
  const uniform = <T>(pick: (r: TextRun) => T | undefined, fallback: T | null): T | null => {
    const vals = covered.map((r) => pick(r) ?? fallback);
    return vals.every((v) => v === vals[0]) ? (vals[0] as T | null) : null;
  };
  return {
    bold: allBool('bold'),
    italic: allBool('italic'),
    underline: allBool('underline'),
    strikethrough: allBool('strikethrough'),
    color: uniform((r) => r.color, defaults.color),
    heading: uniform((r) => r.heading, null),
    link: uniform((r) => r.link, null),
  };
}

// The run toggle a Cmd/Ctrl+B, I or U press means, or null. Every runs-backed editor routes these to the SAME
// run-based toggle as its toolbar buttons: left to the browser, contentEditable runs its native
// execCommand('bold'…), which wraps the DOM in <b>/<i>/<u> tags the run model never sees, so the formatting
// vanished on commit. The caller preventDefaults a hit so the native command never fires.
const FORMAT_SHORTCUTS: Readonly<Record<string, RunBoolKey>> = {
  b: 'bold',
  i: 'italic',
  u: 'underline',
};
export function formatShortcut(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}): RunBoolKey | null {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return null;
  return FORMAT_SHORTCUTS[e.key.toLowerCase()] ?? null;
}
