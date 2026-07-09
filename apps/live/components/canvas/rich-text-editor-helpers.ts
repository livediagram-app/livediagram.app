// Pure helpers for the rich-text editor: applying a CSSProperties object
// onto a live DOM style, finding the word range at a caret position, and
// computing the toolbar's active format from the selection. Split out of
// RichTextEditor.
import {
  runsPlainText,
  type BoxedElement,
  type RunBoolKey,
  type TextRun,
} from '@livediagram/diagram';
import {} from '@/components/canvas/label-style';
import {} from '@/components/canvas/rich-text-dom';
import { type ActiveFormat } from '@/components/canvas/RichTextToolbar';

export function applyCss(target: CSSStyleDeclaration, props: React.CSSProperties): void {
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    (target as unknown as Record<string, string>)[k] = typeof v === 'number' ? String(v) : v;
  }
}

// Expand a collapsed caret to the word it sits in (or just left of), so a
// toolbar click with no selection formats the surrounding word. Returns
// null when there's no word to act on (whitespace / empty).
function wordRangeAt(text: string, pos: number): { start: number; end: number } | null {
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

export const BOOL_DEFAULT: Record<RunBoolKey, (el: BoxedElement) => boolean> = {
  bold: (el) => !!el.textBold,
  italic: (el) => !!el.textItalic,
  underline: (el) => !!el.textUnderline,
  strikethrough: (el) => !!el.textStrikethrough,
};

// The slice of runs covering [start, end) as effective attrs, used to
// decide toolbar active-state. Walks runs accumulating offsets.
export function computeActiveFormat(
  runs: TextRun[],
  range: { start: number; end: number } | null,
  el: BoxedElement,
): ActiveFormat {
  const empty: ActiveFormat = {
    bold: BOOL_DEFAULT.bold(el),
    italic: BOOL_DEFAULT.italic(el),
    underline: BOOL_DEFAULT.underline(el),
    strikethrough: BOOL_DEFAULT.strikethrough(el),
    color: el.textColor ?? null,
  };
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
  const allBool = (key: RunBoolKey) =>
    covered.every((r) => (r[key] ?? BOOL_DEFAULT[key](el)) === true);
  const uniform = <T>(pick: (r: TextRun) => T | undefined, fallback: T | null): T | null => {
    const vals = covered.map((r) => pick(r) ?? fallback);
    return vals.every((v) => v === vals[0]) ? (vals[0] as T | null) : null;
  };
  return {
    bold: allBool('bold'),
    italic: allBool('italic'),
    underline: allBool('underline'),
    strikethrough: allBool('strikethrough'),
    color: uniform((r) => r.color, el.textColor ?? null),
  };
}
