// A table row at a page's foot above its notes (docs/specs/007-editor/article-pages.md "Footnotes"): the notes'
// top is the page's foot for a table. A row never breaks inside on its own (break-inside: avoid), so one that would
// run under the notes moves to the next page whole, with its table's header row; one that already starts its page
// splits there, each of its cells ending above the notes at its own line, the rest of every cell going on together.
import type { Node as PMNode } from 'prosemirror-model';
import type { FootBreak } from './article-footnotes';
import { articleSchema } from './article-schema';

const S = articleSchema;

/** A place's line as laid out: its page (column), top and foot (layout px from the writing's top). */
export type RowLine = { col: number; top: number; bottom: number };

export type RowReader = {
  // The line a place in the writing is on.
  lineAt: (pos: number) => RowLine;
  // The last line of the writing before `pos`, or null when nothing is before it.
  lineBefore: (pos: number) => RowLine | null;
};

const past = (l: RowLine, page: number, limit: number) =>
  l.col > page || (l.col === page && l.bottom > limit);

// The later of two lines, in the writing's order of pages.
const lower = (a: RowLine, b: RowLine) =>
  b.col > a.col || (b.col === a.col && b.bottom > a.bottom) ? b : a;

/** The table holding `pos`, or the one just before the block holding it (a search over the writing can land just
 *  past a row whose short last cell ends above the limit). Its position, or null. */
export function tableNear(doc: PMNode, pos: number): number | null {
  const $p = doc.resolve(pos);
  for (let d = $p.depth; d > 0; d--) if ($p.node(d).type === S.nodes.table) return $p.before(d);
  const start = $p.depth === 0 ? pos : $p.before(1);
  const prev = doc.resolve(start).nodeBefore;
  return prev?.type === S.nodes.table ? start - prev.nodeSize : null;
}

// Each cell of the row at `rowPos`: where its text starts and ends.
export function cellsOf(row: PMNode, rowPos: number): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  row.forEach((cell, offset) => {
    const start = rowPos + 1 + offset + 1;
    out.push({ start, end: start + cell.content.size });
  });
  return out;
}

/** A row's foot: the lowest of its cells' last lines. O(cells) reads. */
export function rowFoot(read: RowReader, row: PMNode, rowPos: number): RowLine {
  return cellsOf(row, rowPos)
    .map((c) => read.lineAt(c.end))
    .reduce((a, b) => lower(a, b));
}

/** Whether a table's first row is its header row (every cell a header cell). */
export const hasHeader = (table: PMNode): boolean => {
  const first = table.firstChild;
  if (!first || first.childCount === 0) return false;
  let all = true;
  first.forEach((c) => {
    if (c.type !== S.nodes.table_header) all = false;
  });
  return all;
};

/** Where a row moving to the next page whole breaks: before the table at its first row, and at its second under a
 *  header row (so the header row is never left alone above the notes); otherwise before the row. */
export function wholeRowAt(table: PMNode, tablePos: number, index: number): number {
  if (index === 0 || (index === 1 && hasHeader(table))) return tablePos;
  let pos = tablePos + 1;
  for (let i = 0; i < index; i++) pos += table.child(i).nodeSize;
  return pos;
}

// The first place in [from, to] whose line is past the limit, by a binary search (a cell's lines are in order).
function firstPastIn(read: RowReader, from: number, to: number, page: number, limit: number) {
  let lo = from;
  let hi = to;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (past(read.lineAt(mid), page, limit)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** A row that starts its page, split above the notes: a break in every cell that runs past `limit`, at its first
 *  place past it. Null when no cut is new (every cell already goes on at its break), so a page whose notes shrank
 *  can take the break back; undefined when no cell has a line above the limit to keep. O(cells x log cell). */
export function splitRow(
  read: RowReader,
  row: PMNode,
  rowPos: number,
  page: number,
  limit: number,
): FootBreak | null | undefined {
  const cuts: { at: number; start: number }[] = [];
  let fresh = false;
  for (const c of cellsOf(row, rowPos)) {
    if (!past(read.lineAt(c.end), page, limit)) continue;
    const at = firstPastIn(read, c.start, c.end, page, limit);
    cuts.push({ at, start: c.start });
    if (read.lineAt(at).col === page) fresh = true;
  }
  const lead = cuts.find((c) => c.at > c.start);
  if (!lead) return undefined;
  if (!fresh) return null;
  const also = cuts.filter((c) => c !== lead).map((c) => c.at);
  return { page, pos: lead.at, block: false, ...(also.length ? { also } : {}) };
}

/**
 * The break that ends page `page` above its notes when its text runs past `limit` at or just after a table (`cut`,
 * the first place past it): the table's first row past the limit moves whole, or splits when it starts its page.
 * Undefined when the cut is after a table none of whose rows runs past the limit (the cut is the writing's own);
 * null when there is nothing to cut (the row's split or move is already drawn, or the cut is inside a table that
 * ends above the limit). O(log rows x cells + cells x log cell) reads.
 */
export function tableCut(
  doc: PMNode,
  read: RowReader,
  page: number,
  limit: number,
  cut: number,
): FootBreak | null | undefined {
  const tablePos = tableNear(doc, cut);
  if (tablePos === null) return undefined;
  const table = doc.nodeAt(tablePos)!;
  const rowPos: number[] = [];
  let pos = tablePos + 1;
  table.forEach((row) => {
    rowPos.push(pos);
    pos += row.nodeSize;
  });
  // The first row whose foot is past the limit: rows stack, so their feet are in order.
  let lo = 0;
  let hi = rowPos.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (past(rowFoot(read, table.child(mid), rowPos[mid]!), page, limit)) hi = mid;
    else lo = mid + 1;
  }
  // No row past the limit: a cut after the table is the writing's own. One inside it is a place between its rows,
  // read as the first line after the table: the page ends there, before the block after the table, while that is on
  // the page (otherwise nothing is to cut).
  const after = tablePos + table.nodeSize;
  if (lo === rowPos.length) {
    if (cut <= tablePos || cut >= after) return undefined;
    return after < doc.content.size && read.lineAt(after).col === page
      ? { page, pos: after, block: true }
      : null;
  }
  const whole = wholeRowAt(table, tablePos, lo);
  const before = read.lineBefore(whole);
  // A row lower on its page moves whole; one that starts its page (only the repeated header row above it) splits.
  // Already on the next page (the break as drawn, or the row's own move): nothing to cut, so the page can take a
  // break back once the row fits.
  if (before && before.col === page)
    return read.lineAt(whole).col > page ? null : { page, pos: whole, block: true };
  // A row with no line to keep on the page (a page shorter than its first line) is left to the writing's own cut.
  return splitRow(read, table.child(lo), rowPos[lo]!, page, limit);
}

/** Where a split row's part on page `page` ends: the lowest line its cells keep there (a cell cut at one of `cuts`,
 *  the line before the cut; one not cut, its last line when that is on the page). Layout px, or null when no cell
 *  keeps a line there. O(cells) reads. */
export function splitFoot(
  read: RowReader,
  row: PMNode,
  rowPos: number,
  page: number,
  cuts: readonly number[],
): number | null {
  let foot: number | null = null;
  for (const c of cellsOf(row, rowPos)) {
    const cut = cuts.find((p) => p >= c.start && p <= c.end);
    const line =
      cut === undefined ? read.lineAt(c.end) : cut > c.start ? read.lineAt(cut - 1) : null;
    if (line && line.col === page) foot = Math.max(foot ?? line.bottom, line.bottom);
  }
  return foot;
}

/** The row a break inside a table cell splits: its position and node, or null for a break elsewhere. */
export function splitRowOf(doc: PMNode, b: FootBreak): { pos: number; node: PMNode } | null {
  if (b.block || b.pos < 0 || b.pos > doc.content.size) return null;
  const $p = doc.resolve(b.pos);
  for (let d = $p.depth; d > 0; d--)
    if ($p.node(d).type === S.nodes.table_row) return { pos: $p.before(d), node: $p.node(d) };
  return null;
}
