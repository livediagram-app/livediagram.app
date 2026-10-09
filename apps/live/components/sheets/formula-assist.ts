// Help while writing a formula (docs/specs/029-sheets/sheet.md "Writing formulas"): where each reference sits in
// the draft and its colour, whether the caret is where a clicked cell would go, putting a reference there, F4's
// absolute cycle, the function names matching the word being typed, and the argument the caret is in. Pure: the
// editor and the formula bar share it.
import { FUNCTION_NAMES, FUNCTION_DOCS, parseA1, tokenize, type Token } from '@livediagram/sheets';

export const REF_COLOURS = [
  '#2563eb',
  '#dc2626',
  '#7c3aed',
  '#059669',
  '#d97706',
  '#db2777',
  '#0891b2',
  '#65a30d',
];

export type RefSpan = { start: number; end: number; text: string; sheet?: string; colour: string };

const CELL = /^\$?[A-Za-z]{1,4}\$?[0-9]{1,7}$/;
const COL = /^\$?[A-Za-z]{1,4}$/;

function isRefPart(t: Token | undefined): boolean {
  return (
    !!t &&
    ((t.k === 'ident' && (CELL.test(t.v) || COL.test(t.v))) || (t.k === 'num' && /^\d+$/.test(t.v)))
  );
}

// The references in a draft (`=...`), in order, each coloured by its first appearance's text.
export function refSpans(draft: string): RefSpan[] {
  if (!draft.startsWith('=')) return [];
  const toks = tokenize(draft.slice(1), 1).filter((t) => t.k !== 'ws');
  const out: RefSpan[] = [];
  const colourOf = new Map<string, string>();
  for (let i = 0; i < toks.length; i++) {
    let t = toks[i]!;
    let sheet: string | undefined;
    const start = t.start;
    if (t.k === 'sheet') {
      sheet = t.v;
      t = toks[++i]!;
      if (!t) break;
    }
    const next = toks[i + 1];
    if (t.k === 'ident' && next?.k === 'lparen') continue;
    const isCell = t.k === 'ident' && CELL.test(t.v);
    const ranged = next?.k === 'op' && next.v === ':' && isRefPart(toks[i + 2]);
    if (!isCell && !(isRefPart(t) && ranged)) continue;
    let end = t.end;
    if (ranged) {
      end = toks[i + 2]!.end;
      i += 2;
    }
    const text = draft.slice(start, end);
    const key = text.toUpperCase().replace(/\$/g, '');
    if (!colourOf.has(key)) colourOf.set(key, REF_COLOURS[colourOf.size % REF_COLOURS.length]!);
    out.push({
      start,
      end,
      text,
      ...(sheet !== undefined ? { sheet } : {}),
      colour: colourOf.get(key)!,
    });
  }
  return out;
}

// A reference's cells on its own sheet, as positions; null when it is not a cell or cell range (whole columns or
// rows are outlined by the caller from the grid's size) or names another sheet.
export function spanRange(
  span: RefSpan,
): { r1: number; c1: number; r2: number; c2: number } | null {
  if (span.sheet !== undefined) return null;
  const [a, b] = span.text.split(':');
  const p = parseA1(a!);
  const q = b !== undefined ? parseA1(b) : p;
  if (!p || !q) return null;
  return {
    r1: Math.min(p.r, q.r),
    c1: Math.min(p.c, q.c),
    r2: Math.max(p.r, q.r),
    c2: Math.max(p.c, q.c),
  };
}

// Whether a click on a cell, at this caret, puts a reference in (rather than ending the edit): right after `=`,
// an operator, `(`, `,` or `;`, or replacing a reference the caret is just after (pointing again).
export function referenceSlot(draft: string, caret: number): { start: number; end: number } | null {
  if (!draft.startsWith('=') || caret < 1) return null;
  const spans = refSpans(draft);
  const onRef = spans.find((s) => s.end === caret);
  if (onRef) return { start: onRef.start, end: onRef.end };
  const before = draft.slice(0, caret).replace(/\s+$/, '');
  const last = before[before.length - 1];
  if (before.length === 1 || (last && '=+-*/^&<>(,;:'.includes(last))) {
    // Only when nothing but spaces is between the caret and what follows (no half-typed word).
    const after = draft.slice(caret);
    if (/^\s*([)+\-*/^&,;<>=]|$)/.test(after)) return { start: caret, end: caret };
  }
  return null;
}

export function insertReference(draft: string, slot: { start: number; end: number }, ref: string) {
  const next = draft.slice(0, slot.start) + ref + draft.slice(slot.end);
  return {
    draft: next,
    caret: slot.start + ref.length,
    slot: { start: slot.start, end: slot.start + ref.length },
  };
}

// F4: A1 → $A$1 → A$1 → $A1 → A1, on the reference the caret is in or just after.
export function cycleAbsolute(
  draft: string,
  caret: number,
): { draft: string; caret: number } | null {
  const span = refSpans(draft).find((s) => caret >= s.start && caret <= s.end);
  if (!span || span.sheet !== undefined) return null;
  const parts = span.text.split(':').map((part) => {
    const m = /^(\$?)([A-Za-z]{1,4})(\$?)(\d+)$/.exec(part);
    if (!m) return part;
    const state = (m[1] ? 2 : 0) + (m[3] ? 1 : 0); // 0 A1, 3 $A$1, 1 A$1, 2 $A1
    const next = { 0: 3, 3: 1, 1: 2, 2: 0 }[state as 0 | 1 | 2 | 3]!;
    return `${next & 2 ? '$' : ''}${m[2]}${next & 1 ? '$' : ''}${m[4]}`;
  });
  const text = parts.join(':');
  return {
    draft: draft.slice(0, span.start) + text + draft.slice(span.end),
    caret: span.start + text.length,
  };
}

// The function names the word before the caret starts (case ignored), when it is a function position; then the
// sheet's named ranges it starts (sheet.md "Named ranges"), listed in `ranges` too, as given.
export function functionMatches(
  draft: string,
  caret: number,
  limit = 8,
  rangeNames: readonly string[] = [],
): { word: string; start: number; names: string[]; ranges: ReadonlySet<string> } | null {
  if (!draft.startsWith('=')) return null;
  const before = draft.slice(0, caret);
  // A word: a function's name, or a named range's (which may start with or hold `_`).
  const m = /(^|[^A-Za-z0-9_.$"'!])([A-Za-z_][A-Za-z0-9_.]*)$/.exec(before);
  if (!m || draft[caret] === '(') return null;
  // Inside a string, nothing.
  if ((before.match(/"/g)?.length ?? 0) % 2 === 1) return null;
  const word = m[2]!.toUpperCase();
  if (CELL.test(word)) return null;
  // A named range typed in full is done, even one that is also a function's name (Rate, RATE): Enter commits.
  if (rangeNames.some((n) => n.toUpperCase() === word)) return null;
  const fns = FUNCTION_NAMES.filter((n) => n.startsWith(word));
  const ranges = rangeNames.filter((n) => n.toUpperCase().startsWith(word));
  const names = [...fns, ...ranges].slice(0, limit);
  return names.length
    ? { word, start: caret - m[2]!.length, names, ranges: new Set(ranges) }
    : null;
}

// A pick from the list: a function opens its brackets; a named range is its name alone.
export function acceptFunction(
  draft: string,
  match: { start: number; ranges?: ReadonlySet<string> },
  caret: number,
  name: string,
) {
  const open = match.ranges?.has(name) ? '' : '(';
  const next = `${draft.slice(0, match.start)}${name}${open}${draft.slice(caret)}`;
  return { draft: next, caret: match.start + name.length + open.length };
}

// The function call the caret is inside and which argument (0-based), for the hint card.
export function argumentAt(draft: string, caret: number): { name: string; index: number } | null {
  if (!draft.startsWith('=')) return null;
  const stack: { name: string | null; commas: number }[] = [];
  let inString = false;
  for (let i = 1; i < caret; i++) {
    const ch = draft[i]!;
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === '(') {
      const m = /([A-Za-z][A-Za-z0-9.]*)$/.exec(draft.slice(0, i));
      stack.push({ name: m ? m[1]!.toUpperCase() : null, commas: 0 });
    } else if (ch === ')') stack.pop();
    else if (ch === ',' && stack.length) stack[stack.length - 1]!.commas++;
  }
  for (let k = stack.length - 1; k >= 0; k--) {
    const s = stack[k]!;
    if (s.name && Object.prototype.hasOwnProperty.call(FUNCTION_DOCS, s.name))
      return { name: s.name, index: s.commas };
  }
  return null;
}

// Which documented argument an index falls on (repeating ones, "value2, …", absorb the rest).
export function argumentSlot(name: string, index: number): number {
  const args = FUNCTION_DOCS[name]?.args ?? [];
  if (index < args.length) return index;
  const rep = args.findIndex((a) => a.includes('…'));
  return rep >= 0 ? rep : args.length - 1;
}
