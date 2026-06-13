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

export type TextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  size?: RunSize;
  color?: string; // hex
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
}>;

// The six attribute keys, used to compare/copy run formatting without
// touching `text`.
const ATTR_KEYS = ['bold', 'italic', 'underline', 'strikethrough', 'size', 'color'] as const;

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
export function setRunsPlainText(runs: TextRun[], newText: string): TextRun[] {
  const oldText = runsPlainText(runs);
  if (oldText === newText) return normalizeRuns(runs);
  if (newText === '') return [];

  // Common prefix length.
  let p = 0;
  const max = Math.min(oldText.length, newText.length);
  while (p < max && oldText[p] === newText[p]) p++;
  // Common suffix length (not overlapping the prefix).
  let sfx = 0;
  while (sfx < max - p && oldText[oldText.length - 1 - sfx] === newText[newText.length - 1 - sfx]) {
    sfx++;
  }

  const middle = newText.slice(p, newText.length - sfx);
  // Attributes the inserted middle inherits: the run covering offset `p`
  // (the character just before the edit point), falling back to the run
  // at `p` itself for a pure insertion at a boundary.
  const inheritFrom = runAtOffset(runs, p > 0 ? p - 1 : 0);

  // Keep the prefix [0, p), insert the middle, keep the old suffix.
  const head = sliceRuns(runs, 0, p);
  const tail = sliceRuns(runs, oldText.length - sfx, oldText.length);
  const mid: TextRun[] = middle === '' ? [] : [{ text: middle, ...attrsOf(inheritFrom) }];
  return normalizeRuns([...head, ...mid, ...tail]);
}

// The run that contains character `offset` (clamped). Empty runs → a
// blank run so callers always get attrs to inherit.
function runAtOffset(runs: TextRun[], offset: number): TextRun {
  let pos = 0;
  for (const run of runs) {
    const end = pos + run.text.length;
    if (offset < end) return run;
    pos = end;
  }
  return runs[runs.length - 1] ?? { text: '' };
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
