// Per-range label formatting — the "rich text" model (spec/09).
//
// A label that carries per-range formatting stores its text as an array
// of RUNS instead of a single string. Each run is a contiguous slice of
// the text plus the formatting that DIFFERS from the whole-element base:
// an unset run attribute INHERITS the element's field (`run.bold ??
// el.textBold`, `run.color ?? el.textColor`, `run.size ?? el.textSize`).
// So runs are deltas — the existing whole-element controls keep working
// as the base layer untouched, and a run only carries the attributes the
// user actually changed for that slice.
//
// `element.label` stays the plain-text mirror, always equal to
// `runsPlainText(richText)`, so search / auto-rename / markdown export /
// every legacy reader works with zero changes. When `richText` is absent
// (or a single override-free run) the element renders exactly as before.
//
// These helpers are the single source of truth for both the canvas
// renderer and the contentEditable editor; they are pure (no DOM, no
// element references — the element default is passed in by the caller
// where the EFFECTIVE value matters, see `toggleFormatInRange`).

// Per-run size is the fixed scale only — 'scale' (whole-element auto-fit)
// has no per-run meaning, see spec/09.
export type RunSize = 'sm' | 'md' | 'lg';

export type RunBoolKey = 'bold' | 'italic' | 'underline' | 'strikethrough';

// Line-level emphasis (spec/92). Like the list markers below, it rides the
// FLAT run model rather than introducing block nodes: the attribute is
// written across every character of the lines the selection touches, which
// keeps `runsPlainText(runs).length` the single offset space every
// caller — renderer, contentEditable bridge, selection maths — walks.
// Three levels (spec/102). Level 3 arrived with the toolbar's block-type
// picker, where "Heading 1 / 2 / 3 / Paragraph" is the vocabulary people
// already expect from a word processor; two levels made the third option
// conspicuously missing.
export type RunHeading = 1 | 2 | 3;

export type TextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  size?: RunSize;
  color?: string; // hex
  // Hyperlink over this slice (spec/92). Stored as the address the user
  // entered, already passed through the app's `normaliseUrl` guard
  // (http / https / mailto only); renderers re-check before following.
  link?: string;
  heading?: RunHeading;
};

// The attributes to write over a range. A key present with `undefined`
// CLEARS that delta (the run re-inherits the element default); a key
// present with a value SETS it.
export type RunPatch = Partial<{
  bold: boolean | undefined;
  italic: boolean | undefined;
  underline: boolean | undefined;
  strikethrough: boolean | undefined;
  size: RunSize | undefined;
  color: string | undefined;
  link: string | undefined;
  heading: RunHeading | undefined;
}>;

// The attribute keys, used to compare/copy run formatting without touching
// `text`. Every new attribute must land here or split / merge / patch will
// silently drop it.
const ATTR_KEYS = [
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'size',
  'color',
  'link',
  'heading',
] as const;

/** Concatenated plain text of the runs. `element.label` is kept === this. */
export function runsPlainText(runs: TextRun[]): string {
  let out = '';
  for (const r of runs) out += r.text;
  return out;
}

/** Seed runs from a plain string — the starting point for a legacy label. */
export function runsFromPlainText(text: string): TextRun[] {
  return text === '' ? [] : [{ text }];
}

// Do two runs carry identical formatting (ignoring text)? Treats an
// absent attr and an explicit `undefined` as equal.
function sameAttrs(a: TextRun, b: TextRun): boolean {
  for (const k of ATTR_KEYS) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

// Copy only the formatting attributes of a run (no text). Undefined
// attrs are simply absent.
function attrsOf(run: TextRun): Omit<TextRun, 'text'> {
  const out: Omit<TextRun, 'text'> = {};
  for (const k of ATTR_KEYS) {
    const v = run[k];
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

/**
 * Canonical form: drop empty-text runs and merge adjacent runs whose
 * formatting is identical. Idempotent. Keeps the stored model minimal so
 * "single override-free run" detection stays cheap.
 */
export function normalizeRuns(runs: TextRun[]): TextRun[] {
  const out: TextRun[] = [];
  for (const run of runs) {
    if (run.text === '') continue;
    const last = out[out.length - 1];
    if (last && sameAttrs(last, run)) {
      last.text += run.text;
    } else {
      out.push({ text: run.text, ...attrsOf(run) });
    }
  }
  return out;
}

// Split runs so that there is a run boundary at character offset
// `offset` (0..len). Returns a fresh array; never mutates the input.
function splitAt(runs: TextRun[], offset: number): TextRun[] {
  const out: TextRun[] = [];
  let pos = 0;
  for (const run of runs) {
    const end = pos + run.text.length;
    if (offset > pos && offset < end) {
      const cut = offset - pos;
      out.push({ text: run.text.slice(0, cut), ...attrsOf(run) });
      out.push({ text: run.text.slice(cut), ...attrsOf(run) });
    } else {
      out.push(run);
    }
    pos = end;
  }
  return out;
}

// Apply a patch to a single run's attributes (set when the patch value is
// defined, delete when it's `undefined`). Returns a new run.
function patchRun(run: TextRun, patch: RunPatch): TextRun {
  const next: TextRun = { text: run.text, ...attrsOf(run) };
  for (const k of ATTR_KEYS) {
    if (k in patch) {
      const v = (patch as Record<string, unknown>)[k];
      if (v === undefined) delete (next as Record<string, unknown>)[k];
      else (next as Record<string, unknown>)[k] = v;
    }
  }
  return next;
}

/**
 * Set/clear formatting on the character range [start, end) of the runs'
 * plain text. Offsets are clamped to [0, len]; an empty range returns the
 * input normalized. A patch value of `undefined` clears that delta so the
 * run re-inherits the element default.
 */
export function applyFormatToRange(
  runs: TextRun[],
  start: number,
  end: number,
  patch: RunPatch,
): TextRun[] {
  const len = runsPlainText(runs).length;
  const s = Math.max(0, Math.min(start, len));
  const e = Math.max(0, Math.min(end, len));
  if (s >= e) return normalizeRuns(runs);
  // Ensure boundaries at both ends, then patch every run fully inside.
  const split = splitAt(splitAt(runs, s), e);
  const out: TextRun[] = [];
  let pos = 0;
  for (const run of split) {
    const runEnd = pos + run.text.length;
    out.push(pos >= s && runEnd <= e ? patchRun(run, patch) : run);
    pos = runEnd;
  }
  return normalizeRuns(out);
}

// The effective on/off of a boolean attr for a run, given the element
// default the run inherits when its own flag is unset.
function effectiveBool(run: TextRun, key: RunBoolKey, elementDefault: boolean): boolean {
  return run[key] ?? elementDefault;
}

/**
 * Toggle a boolean attribute (bold/italic/underline/strikethrough) over
 * [start, end). Operates on the EFFECTIVE value: if every character in the
 * range is already effectively-on, the range is turned OFF, otherwise ON.
 * `elementDefault` is the whole-element field the unset runs inherit
 * (e.g. `element.textBold`) — the caller MUST pass it so "off" is computed
 * against the right base. Writes an explicit boolean delta.
 */
export function toggleFormatInRange(
  runs: TextRun[],
  start: number,
  end: number,
  key: RunBoolKey,
  elementDefault: boolean,
): TextRun[] {
  const len = runsPlainText(runs).length;
  const s = Math.max(0, Math.min(start, len));
  const e = Math.max(0, Math.min(end, len));
  if (s >= e) return normalizeRuns(runs);
  // Is every covered character effectively-on already?
  let allOn = true;
  let pos = 0;
  for (const run of runs) {
    const runEnd = pos + run.text.length;
    const overlaps = pos < e && runEnd > s;
    if (overlaps && !effectiveBool(run, key, elementDefault)) {
      allOn = false;
      break;
    }
    pos = runEnd;
  }
  return applyFormatToRange(runs, s, e, { [key]: !allOn });
}

/**
 * Reconcile an edited plain string back onto runs, preserving formatting
 * around the edit. Diffs the common prefix + suffix between the runs' old
 * text and `newText`; the changed middle is inserted as text that inherits
 * the attributes of the run at the insertion point (typing inside a bold
 * word stays bold). Used by the textarea fallback + tests; the
 * contentEditable editor reads runs from the DOM directly instead.
 */
// --- Lists (line-prefix markers) -------------------------------------------
//
// A list is rendered as literal line-prefix TEXT ("• " for bullets, "1. " for
// numbered) rather than a block-level model — it rides the existing runs /
// label / export paths with zero new fields. `applyListStyle` is a one-shot
// transform that prepends a marker to every non-empty line (renumbering as it
// goes) while preserving each character's run formatting; the marker itself is
// an unformatted run. Re-applying first strips any existing markers, so
// switching styles or renumbering after an edit stays clean.

export type ListStyle = 'bullet' | 'numbered' | 'none';

const BULLET_PREFIX = '• ';
// A leading list marker on a line: a bullet "• " or a number "12. ".
const LINE_PREFIX_RE = /^(?:• |\d+\. )/;

type RunChar = { ch: string; attrs: Omit<TextRun, 'text'> };

function toChars(runs: TextRun[]): RunChar[] {
  const out: RunChar[] = [];
  for (const run of runs) {
    const attrs = attrsOf(run);
    for (const ch of run.text) out.push({ ch, attrs });
  }
  return out;
}

function fromChars(chars: RunChar[]): TextRun[] {
  return normalizeRuns(chars.map((c) => ({ text: c.ch, ...c.attrs })));
}

// Apply `fn` to each line's characters (split on '\n', which is re-inserted
// between lines as a plain run), preserving every other character's run attrs.
function mapLines(
  runs: TextRun[],
  fn: (lineChars: RunChar[], index: number) => RunChar[],
): TextRun[] {
  const lines: RunChar[][] = [[]];
  for (const c of toChars(runs)) {
    if (c.ch === '\n') lines.push([]);
    else lines[lines.length - 1]!.push(c);
  }
  const out: RunChar[] = [];
  lines.forEach((lineChars, i) => {
    if (i > 0) out.push({ ch: '\n', attrs: {} });
    out.push(...fn(lineChars, i));
  });
  return fromChars(out);
}

// Strip a leading marker from one line's chars.
function stripLine(lineChars: RunChar[]): RunChar[] {
  const m = lineChars
    .map((c) => c.ch)
    .join('')
    .match(LINE_PREFIX_RE);
  return m ? lineChars.slice(m[0].length) : lineChars;
}

// The set of line indices a character range touches (caret included on its
// own line). null = "every line" (no range given).
function linesInRange(runs: TextRun[], range?: { start: number; end: number }): Set<number> | null {
  if (!range) return null;
  const text = runsPlainText(runs);
  const s = Math.min(range.start, range.end);
  const e = Math.max(range.start, range.end);
  const set = new Set<number>();
  let lineStart = 0;
  let idx = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === '\n') {
      if (lineStart <= e && i >= s) set.add(idx);
      idx++;
      lineStart = i + 1;
    }
  }
  return set;
}

/** Strip a leading bullet / number marker from every line, keeping formatting. */
export function stripListPrefixes(runs: TextRun[]): TextRun[] {
  return mapLines(runs, (lineChars) => stripLine(lineChars));
}

/**
 * Turn the text into a bulleted / numbered list (or strip markers for
 * 'none'). Prepends a marker to every non-empty line, renumbering 'numbered'
 * sequentially; existing markers are stripped first so the result is clean.
 * When `range` is given, only the lines it touches are affected (the rest
 * keep their current markers); numbering restarts within the affected lines.
 */
export function applyListStyle(
  runs: TextRun[],
  style: ListStyle,
  range?: { start: number; end: number },
): TextRun[] {
  const sel = linesInRange(runs, range);
  const inSel = (i: number) => sel === null || sel.has(i);
  const base = mapLines(runs, (lineChars, i) => (inSel(i) ? stripLine(lineChars) : lineChars));
  if (style === 'none') return base;
  let n = 0;
  return mapLines(base, (lineChars, i) => {
    if (!inSel(i) || lineChars.length === 0) return lineChars;
    const prefix = style === 'bullet' ? BULLET_PREFIX : `${++n}. `;
    const prefixChars: RunChar[] = [...prefix].map((ch) => ({ ch, attrs: {} }));
    return [...prefixChars, ...lineChars];
  });
}

/**
 * Drop leading + trailing whitespace, keeping every surviving character's
 * formatting. The runs-level equivalent of `String.trim()`, used where a
 * stored plain-text mirror is trimmed (`element.note`, spec/92) and the runs
 * beside it must stay exactly equal to it.
 */
export function trimRuns(runs: TextRun[]): TextRun[] {
  const text = runsPlainText(runs);
  const start = text.length - text.trimStart().length;
  const end = text.trimEnd().length;
  if (start >= end) return [];
  return normalizeRuns(sliceRuns(runs, start, end));
}

// --- Headings (line-level attribute) ---------------------------------------

/**
 * Grow a character range out to whole-line boundaries — from the start of the
 * line containing `start` to the end of the line containing `end`. A collapsed
 * range yields the single line the caret sits on. Used by the line-level
 * commands (headings, and the note editor's caret-scoped list apply) so
 * "make this a heading" never splits a line in half.
 */
export function expandRangeToLines(
  text: string,
  range: { start: number; end: number },
): { start: number; end: number } {
  const len = text.length;
  const s = Math.max(0, Math.min(Math.min(range.start, range.end), len));
  const e = Math.max(0, Math.min(Math.max(range.start, range.end), len));
  const lineStart = text.lastIndexOf('\n', s - 1) + 1;
  const nextBreak = text.indexOf('\n', e);
  return { start: lineStart, end: nextBreak === -1 ? len : nextBreak };
}

/**
 * Set (or clear, with `null`) the heading level across every line the range
 * touches. Without a range the whole text is treated as one target. Returns
 * normalized runs; clearing re-inherits the base body style.
 */
export function applyHeadingToLines(
  runs: TextRun[],
  level: RunHeading | null,
  range?: { start: number; end: number },
): TextRun[] {
  const text = runsPlainText(runs);
  const target = expandRangeToLines(text, range ?? { start: 0, end: text.length });
  if (target.start >= target.end) return normalizeRuns(runs);
  return applyFormatToRange(runs, target.start, target.end, { heading: level ?? undefined });
}

// The runs (split at boundaries) covering [start, end), with attrs kept.
function sliceRuns(runs: TextRun[], start: number, end: number): TextRun[] {
  if (start >= end) return [];
  const split = splitAt(splitAt(runs, start), end);
  const out: TextRun[] = [];
  let pos = 0;
  for (const run of split) {
    const runEnd = pos + run.text.length;
    if (pos >= start && runEnd <= end) out.push(run);
    pos = runEnd;
  }
  return out;
}

/**
 * Whether `richText` carries formatting worth a rich render. Absent,
 * empty, or a single run with no attribute overrides → false (the legacy
 * whole-element render path applies).
 */
export function hasRichFormatting(runs: TextRun[] | undefined): boolean {
  if (!runs || runs.length === 0) return false;
  if (runs.length === 1) {
    const only = runs[0];
    return !!only && ATTR_KEYS.some((k) => only[k] !== undefined);
  }
  return true;
}
