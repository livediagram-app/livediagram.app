// The Edit Outline row editor's model (docs/specs/009-elements/mind-node.md "Edit Outline"): the
// map as a flat list of rows, one per node, each with a level (0 the root, the first row) and its
// text as marks (bold / italic / underline runs). Structure is the rows' levels, never typed
// spaces, so it cannot be misaligned. Every edit is pure: rows in, rows and where the caret goes
// out, with each level kept at most one below the row above. Text crosses to and from the
// Markdown view and the save through the document package's outline reader and writer.
import {
  mindOutlineEntryText,
  normalizeRuns,
  parseMindOutline,
  runsPlainText,
  type MindOutlineNode,
  type TextRun,
} from '@livediagram/document';

export type OutlineRow = { id: string; level: number; marks: TextRun[] };
// Where the caret goes after an edit: a row and a character offset in its text.
export type OutlineCaret = { id: string; offset: number };
export type OutlineRowsEdit = { rows: OutlineRow[]; caret: OutlineCaret };

let seq = 0;
const newRowId = () => `row${++seq}`;

export const rowText = (row: OutlineRow) => runsPlainText(row.marks);

/** An outline's text read into rows (an empty root row when it has none). */
export function rowsFromText(text: string): OutlineRow[] {
  const root = parseMindOutline(text);
  if (!root) return [{ id: newRowId(), level: 0, marks: [] }];
  const rows: OutlineRow[] = [];
  const walk = (node: MindOutlineNode, level: number) => {
    rows.push({ id: newRowId(), level, marks: node.marks });
    for (const kid of node.children) walk(kid, level + 1);
  };
  walk(root, 0);
  return rows;
}

/** Rows written as outline text, the form the Markdown view shows and Save reads. */
export const textFromRows = (rows: OutlineRow[]) =>
  rows.map((r) => mindOutlineEntryText(r.level, r.marks)).join('\n');

/** Every level at most one below the row above, the root alone at level 0. */
function settled(rows: OutlineRow[]): OutlineRow[] {
  const out: OutlineRow[] = [];
  rows.forEach((row, i) => {
    const level = i === 0 ? 0 : Math.max(1, Math.min(row.level, out[i - 1]!.level + 1));
    out.push(level === row.level ? row : { ...row, level });
  });
  return out;
}

/** The last row of row `i`'s branch: it and the rows after it that sit deeper. */
function branchEnd(rows: OutlineRow[], i: number): number {
  let j = i;
  while (j + 1 < rows.length && rows[j + 1]!.level > rows[i]!.level) j++;
  return j;
}

const sliceMarks = (marks: TextRun[], from: number, to = Infinity): TextRun[] => {
  const out: TextRun[] = [];
  let pos = 0;
  for (const run of marks) {
    const s = Math.max(from, pos);
    const e = Math.min(to, pos + run.text.length);
    if (e > s) out.push({ ...run, text: run.text.slice(s - pos, e - pos) });
    pos += run.text.length;
  }
  return normalizeRuns(out);
};

const shiftBranch = (rows: OutlineRow[], i: number, by: number) => {
  const end = branchEnd(rows, i);
  return rows.map((r, k) => (k >= i && k <= end ? { ...r, level: r.level + by } : r));
};

/** Tab: row `i` and its branch one level in, under the row above. */
export function indentRow(rows: OutlineRow[], i: number): OutlineRow[] | null {
  if (i <= 0 || rows[i]!.level > rows[i - 1]!.level) return null;
  return shiftBranch(rows, i, 1);
}

/** Shift+Tab: row `i` and its branch one level out; never past the first level. */
export function outdentRow(rows: OutlineRow[], i: number): OutlineRow[] | null {
  if (i <= 0 || rows[i]!.level <= 1) return null;
  return settled(shiftBranch(rows, i, -1));
}

/**
 * Enter at `offset` in row `i` (a selection up to `end` is dropped first, as typing over it
 * would): a new row after it carrying the text after the caret, at the same level (the root's: its first child; a row with children, ended at its end: its first
 * child). An empty row below the first level steps out a level instead.
 */
export function splitRow(
  rows: OutlineRow[],
  i: number,
  offset: number,
  end = offset,
): OutlineRowsEdit {
  const row = rows[i]!;
  const text = rowText(row);
  if (i > 0 && text === '' && row.level > 1)
    return { rows: outdentRow(rows, i)!, caret: { id: row.id, offset: 0 } };
  const hasKids = branchEnd(rows, i) > i;
  const level = i === 0 || (hasKids && end >= text.length) ? row.level + 1 : row.level;
  const fresh: OutlineRow = { id: newRowId(), level, marks: sliceMarks(row.marks, end) };
  const next = [...rows];
  next.splice(i, 1, { ...row, marks: sliceMarks(row.marks, 0, offset) }, fresh);
  return { rows: next, caret: { id: fresh.id, offset: 0 } };
}

/**
 * Backspace at the start of row `i`: its text (if any) joins onto the end of the row above and the
 * row goes, its children moving under the row above. Never the root.
 */
export function joinUp(rows: OutlineRow[], i: number): OutlineRowsEdit | null {
  if (i <= 0) return null;
  const above = rows[i - 1]!;
  const at = rowText(above).length;
  const next = [...rows];
  next.splice(i - 1, 2, { ...above, marks: normalizeRuns([...above.marks, ...rows[i]!.marks]) });
  // Its children now sit under the row above.
  return { rows: settled(next), caret: { id: above.id, offset: at } };
}

/** Delete at the end of row `i`: the next row joins onto it. */
export function joinDown(rows: OutlineRow[], i: number): OutlineRowsEdit | null {
  if (i + 1 >= rows.length) return null;
  return joinUp(rows, i + 1);
}

/** Alt+↑ / Alt+↓: row `i`'s branch past its neighbouring branch at the same level. */
export function moveRow(rows: OutlineRow[], i: number, up: boolean): OutlineRow[] | null {
  if (i <= 0) return null;
  const level = rows[i]!.level;
  const end = branchEnd(rows, i);
  let a: [number, number];
  let b: [number, number];
  if (up) {
    let k = i - 1;
    while (k > 0 && rows[k]!.level > level) k--;
    if (k <= 0 || rows[k]!.level !== level) return null;
    a = [k, i - 1];
    b = [i, end];
  } else {
    const k = end + 1;
    if (k >= rows.length || rows[k]!.level !== level) return null;
    a = [i, end];
    b = [k, branchEnd(rows, k)];
  }
  return [
    ...rows.slice(0, a[0]),
    ...rows.slice(b[0], b[1] + 1),
    ...rows.slice(a[0], a[1] + 1),
    ...rows.slice(b[1] + 1),
  ];
}

/**
 * Several pasted lines read as an outline, as rows from row `i` on: nested from its level (the
 * root's children from the root), the first in row `i`'s place when it is empty. Null for text
 * that is no more than one line (the paste is then ordinary typing).
 */
export function pasteRows(rows: OutlineRow[], i: number, text: string): OutlineRowsEdit | null {
  if (!text.includes('\n')) return null;
  // A stand-in heading root, so every pasted line reads as a node below it (a plain root would
  // read a plain first line as more of its own text).
  const read = rowsFromText(`# .\n${text}`).slice(1);
  if (read.length === 0) return null;
  const row = rows[i]!;
  const replace = i > 0 && rowText(row) === '';
  const base = i === 0 ? 0 : row.level - 1;
  const pasted = read.map((r) => ({ ...r, level: r.level + base }));
  const at = replace ? i : branchEnd(rows, i) + 1;
  const next = [...rows];
  next.splice(at, replace ? 1 : 0, ...pasted);
  const last = pasted[pasted.length - 1]!;
  return { rows: settled(next), caret: { id: last.id, offset: rowText(last).length } };
}
