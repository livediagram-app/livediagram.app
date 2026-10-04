// Bold, italic and underline in an outline (docs/specs/009-elements/mind-node.md "Edit Outline"):
// a node's marks (its effective bold / italic / underline, the only formatting an outline shows),
// written as Markdown emphasis (`**bold**`, `*italic*`, `<u>underline</u>`) and read back from it
// (also `__bold__`, `_italic_`), and applied back onto a node without touching its other
// formatting (colour, size, links). Pure.
import type { ShapeElement } from './index';
import {
  applyFormatToRange,
  hasRichFormatting,
  normalizeRuns,
  runsFromPlainText,
  runsPlainText,
  type TextRun,
} from './rich-text';

// The formatting an outline carries.
const MARK_KEYS = ['bold', 'italic', 'underline'] as const;
type MarkKey = (typeof MARK_KEYS)[number];
type Flags = Record<MarkKey, boolean>;
const NONE: Flags = { bold: false, italic: false, underline: false };

/** Each character's flags, as the runs set them (a missing flag: `base`'s). */
function charFlags(runs: TextRun[], base: Flags = NONE): Flags[] {
  const out: Flags[] = [];
  for (const run of runs) {
    const f: Flags = {
      bold: run.bold ?? base.bold,
      italic: run.italic ?? base.italic,
      underline: run.underline ?? base.underline,
    };
    for (let i = 0; i < run.text.length; i++) out.push(f);
  }
  return out;
}

/** Marks from text and its characters' flags: runs carrying only the flags that are on. */
function marksFrom(text: string, flags: Flags[]): TextRun[] {
  const runs: TextRun[] = [...text].map((ch, i) => {
    const run: TextRun = { text: ch };
    for (const k of MARK_KEYS) if (flags[i]?.[k]) run[k] = true;
    return run;
  });
  return normalizeRuns(runs);
}

/**
 * Where each character of a label's outline text (each line trimmed, blank lines dropped, joined
 * by line breaks: mindOutlineNodeText) came from in the label; -1 for a joining line break.
 */
function keptChars(label: string): number[] {
  const out: number[] = [];
  let pos = 0;
  for (const line of label.split('\n')) {
    const lead = line.length - line.trimStart().length;
    const kept = line.trim().length;
    if (kept) {
      if (out.length) out.push(-1);
      for (let i = 0; i < kept; i++) out.push(pos + lead + i);
    }
    pos += line.length + 1;
  }
  return out;
}

const nodeDefaults = (node: ShapeElement): Flags => ({
  bold: !!node.textBold,
  italic: !!node.textItalic,
  underline: !!node.textUnderline,
});

const nodeRuns = (node: ShapeElement) => node.richText ?? runsFromPlainText(node.label ?? '');

/** A node's marks, over its outline text: bold, italic and underline as the canvas shows them. */
export function mindNodeMarks(node: ShapeElement): TextRun[] {
  const runs = nodeRuns(node);
  const label = runsPlainText(runs);
  const flags = charFlags(runs, nodeDefaults(node));
  const kept = keptChars(label);
  const text = kept.map((i) => (i < 0 ? '\n' : label[i]!)).join('');
  return marksFrom(
    text,
    kept.map((i) => (i < 0 ? NONE : flags[i]!)),
  );
}

/** Whether two marks over the same text set the same characters bold, italic and underlined. */
export function sameMindMarks(a: TextRun[], b: TextRun[]): boolean {
  const fa = charFlags(a);
  const fb = charFlags(b);
  return fa.length === fb.length && fa.every((f, i) => MARK_KEYS.every((k) => f[k] === fb[i]![k]));
}

/**
 * `runs` (over `text`) restyled to `marks` (over the outline text `kept` maps into it): each
 * character's bold, italic and underline set to the outline's, written as a flag only where it
 * differs from the node's own style; every other attribute kept. Undefined when nothing is left
 * to say beyond plain text.
 */
function restyled(
  runs: TextRun[],
  kept: number[],
  marks: TextRun[],
  base: Flags,
): TextRun[] | undefined {
  const want = charFlags(marks);
  let out = runs;
  kept.forEach((at, i) => {
    if (at < 0 || !want[i]) return;
    const patch: Partial<Record<MarkKey, boolean | undefined>> = {};
    for (const k of MARK_KEYS) patch[k] = want[i]![k] === base[k] ? undefined : want[i]![k];
    out = applyFormatToRange(out, at, at + 1, patch);
  });
  out = normalizeRuns(out);
  return hasRichFormatting(out) ? out : undefined;
}

/** A node's rich text with its marks changed to `marks` (its outline text unchanged). */
export function restyleMindNode(node: ShapeElement, marks: TextRun[]): TextRun[] | undefined {
  const runs = nodeRuns(node);
  return restyled(runs, keptChars(runsPlainText(runs)), marks, nodeDefaults(node));
}

/** The rich text of a node given new text: `text` with `marks`, against the node's own style. */
export function mindRichTextFor(
  node: ShapeElement,
  text: string,
  marks: TextRun[],
): TextRun[] | undefined {
  return restyled(
    runsFromPlainText(text),
    [...text].map((_, i) => i),
    marks,
    nodeDefaults(node),
  );
}

// --- Markdown emphasis -------------------------------------------------------------------------

// What emphasis writes over: a literal `*`, `` ` ``, `\` or `[`, and an `_` at a word's edge
// (where it could open or close), each escaped with a backslash; `<u>` / `</u>` likewise.
function escapeText(text: string): string {
  return text
    .replace(/[\\*`[]/g, (c) => `\\${c}`)
    .replace(/<(\/?u>)/g, '\\<$1')
    .replace(/_/g, (c, at: number, s: string) =>
      /\w/.test(s[at - 1] ?? '') && /\w/.test(s[at + 1] ?? '') ? c : `\\${c}`,
    );
}

/** One line's marks as Markdown: `**bold**`, `*italic*`, `<u>underline</u>`, literals escaped. */
export function mindMarksToMarkdown(marks: TextRun[]): string {
  return marks
    .map((run) => {
      const body = escapeText(run.text);
      const open = `${run.underline ? '<u>' : ''}${run.bold ? '**' : ''}${run.italic ? '*' : ''}`;
      if (!open || !run.text.trim()) return body;
      const close = `${run.italic ? '*' : ''}${run.bold ? '**' : ''}${run.underline ? '</u>' : ''}`;
      // Emphasis hugs its text: spaces at a run's edges sit outside the markers.
      const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(body)!;
      return `${lead}${open}${core}${close}${trail}`;
    })
    .join('');
}

type Token = { raw: string; literal: string | null; pair: number };

const TOKEN = /(\\[\\*_<`[]|`[^`]*`|!?\[[^\]]*\]\([^)]*\)|\*\*|__|<u>|<\/u>|\*|_)/;

const literalOf = (raw: string): string | null => {
  if (raw.startsWith('\\')) return raw.slice(1);
  if (raw.startsWith('`')) return raw.slice(1, -1);
  const link = /^!?\[([^\]]*)\]\(/.exec(raw);
  if (link) return link[1]!;
  return /^(\*\*|__|<u>|<\/u>|\*|_)$/.test(raw) ? null : raw;
};

const KIND: Record<string, MarkKey> = {
  '**': 'bold',
  __: 'bold',
  '*': 'italic',
  _: 'italic',
  '<u>': 'underline',
  '</u>': 'underline',
};

/**
 * One line of Markdown read into marks: bold, italic and underline from emphasis; code, links
 * (their text kept), escapes and a leading task box read as their text; a marker with no partner
 * read as itself.
 */
export function mindMarkdownToMarks(line: string): TextRun[] {
  const body = line.replace(/^\[[ xX]\]\s+/, '');
  const tokens: Token[] = body
    .split(TOKEN)
    .filter((raw) => raw !== '')
    .map((raw) => ({ raw, literal: literalOf(raw), pair: -1 }));
  const charBefore = (i: number) => {
    const t = tokens[i - 1];
    return t ? t.raw[t.raw.length - 1]! : ' ';
  };
  const charAfter = (i: number) => tokens[i + 1]?.raw[0] ?? ' ';
  const open: number[] = [];
  tokens.forEach((t, i) => {
    if (t.literal !== null) return;
    const before = charBefore(i);
    const after = charAfter(i);
    const underscore = t.raw.startsWith('_');
    const canOpen = underscore ? !/\w/.test(before) && !/\s/.test(after) : !/\s/.test(after);
    const canClose = underscore ? !/\w/.test(after) && !/\s/.test(before) : !/\s/.test(before);
    const closes = t.raw === '</u>' ? '<u>' : t.raw === '<u>' ? null : t.raw;
    const at = closes && canClose ? open.findLastIndex((j) => tokens[j]!.raw === closes) : -1;
    if (at >= 0) {
      const j = open[at]!;
      tokens[j]!.pair = i;
      t.pair = j;
      open.splice(at);
    } else if (t.raw !== '</u>' && canOpen) open.push(i);
  });
  const on: Record<MarkKey, number> = { bold: 0, italic: 0, underline: 0 };
  const runs: TextRun[] = [];
  tokens.forEach((t, i) => {
    if (t.literal === null && t.pair >= 0) {
      on[KIND[t.raw]!] += t.pair > i ? 1 : -1;
      return;
    }
    const run: TextRun = { text: t.literal ?? t.raw };
    for (const k of MARK_KEYS) if (on[k] > 0) run[k] = true;
    runs.push(run);
  });
  return normalizeRuns(runs);
}

/** Marks split at their line breaks: one list of runs per line. */
export function mindMarksLines(marks: TextRun[]): TextRun[][] {
  const lines: TextRun[][] = [[]];
  for (const run of marks) {
    run.text.split('\n').forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1]!.push({ ...run, text: part });
    });
  }
  return lines;
}
