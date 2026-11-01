// A table in an article's writing (docs/specs/007-editor/article-pages.md "Tables"): rows and columns
// of cells, each cell a stretch of runs, laid out and synced as part of the text. Pure data and its
// reading, bounded so one table always fits one sync frame; and the cell-by-cell changes between two
// versions of a table, so two people writing in different cells never overwrite each other.
import { isArticleId, normaliseRuns, sameArticleValue, type ArticleRun } from './article-flow';

export const MAX_ARTICLE_TABLE_ROWS = 500;
export const MAX_ARTICLE_TABLE_COLS = 20;
// A table's stored size: under the room's frame budget (ARTICLE_FRAME_CHARS, 200,000) with room for
// the op around it, so a table put is never dropped by the room.
export const MAX_ARTICLE_TABLE_CHARS = 150_000;
export const MAX_ARTICLE_CELL_TEXT = 2_000;
export const MAX_ARTICLE_CELL_RUNS = 64;
// The narrowest a column may be, as a share of the table's width.
export const ARTICLE_TABLE_MIN_SHARE = 0.05;

/** A column: its id (what a cell op names) and its share of the text width (the shares sum to 1). */
export type ArticleTableColumn = { id: string; w: number };
/** A row: its id and one cell per column, in the columns' order; a cell is its runs. */
export type ArticleTableRow = { id: string; cells: ArticleRun[][] };

export type ArticleTableBlock = {
  id: string;
  type: 'table';
  // The first row is a header row (repeated on every page the table reaches). Absent is off.
  header?: true;
  cols: ArticleTableColumn[];
  rows: ArticleTableRow[];
};

/** One cell's text changed, by its table, row and column ids. */
export type ArticleTableCellOp = {
  kind: 'cell';
  block: string;
  row: string;
  col: string;
  runs: ArticleRun[];
};

const finitePositive = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0;

/** Shares made to sum to 1, none under ARTICLE_TABLE_MIN_SHARE (or an even split, when there are
 *  too many columns for the minimum). Rounded to four places so a stored table stays small. */
export function normaliseShares(shares: readonly number[]): number[] {
  const n = shares.length;
  if (n === 0) return [];
  const min = Math.min(ARTICLE_TABLE_MIN_SHARE, 1 / n);
  const total = shares.reduce((sum, w) => sum + (finitePositive(w) ? w : 0), 0);
  let out = shares.map((w) => (finitePositive(w) && total > 0 ? w / total : 1 / n));
  // Lift the narrow columns to the minimum, taking the room from the rest in proportion.
  const narrow = out.filter((w) => w < min).length;
  if (narrow > 0) {
    const room = 1 - narrow * min;
    const wide = out.reduce((sum, w) => sum + (w >= min ? w : 0), 0);
    out = out.map((w) => (w < min ? min : wide > 0 ? (w / wide) * room : room / (n - narrow)));
  }
  return out.map((w) => Math.round(w * 10_000) / 10_000);
}

const cellRuns = (v: unknown): ArticleRun[] =>
  normaliseRuns(v, MAX_ARTICLE_CELL_TEXT, MAX_ARTICLE_CELL_RUNS);

/** A stored table read defensively (undefined when it has no column or no row). */
export function parseArticleTable(
  b: Record<string, unknown>,
  id: string,
): ArticleTableBlock | undefined {
  if (!Array.isArray(b.cols) || !Array.isArray(b.rows)) return undefined;
  const colIds: string[] = [];
  const shares: number[] = [];
  const seenCols = new Set<string>();
  for (const raw of b.cols as unknown[]) {
    if (colIds.length >= MAX_ARTICLE_TABLE_COLS) break;
    const c = raw as Record<string, unknown> | null;
    if (!c || typeof c !== 'object' || !isArticleId(c.id) || seenCols.has(c.id)) continue;
    seenCols.add(c.id);
    colIds.push(c.id);
    shares.push(finitePositive(c.w) ? c.w : 1);
  }
  if (colIds.length === 0) return undefined;
  const w = normaliseShares(shares);
  const cols = colIds.map((cid, i) => ({ id: cid, w: w[i]! }));
  const header = b.header === true ? { header: true as const } : {};
  // The size of everything but the rows, then each row as it is taken.
  let size = JSON.stringify({ id, type: 'table', ...header, cols, rows: [] }).length;
  const rows: ArticleTableRow[] = [];
  const seenRows = new Set<string>();
  for (const raw of b.rows as unknown[]) {
    if (rows.length >= MAX_ARTICLE_TABLE_ROWS) break;
    const r = raw as Record<string, unknown> | null;
    if (!r || typeof r !== 'object' || !isArticleId(r.id) || seenRows.has(r.id)) continue;
    const given = Array.isArray(r.cells) ? (r.cells as unknown[]) : [];
    const row: ArticleTableRow = { id: r.id, cells: cols.map((_, i) => cellRuns(given[i])) };
    const rowSize = JSON.stringify(row).length + 1;
    if (size + rowSize > MAX_ARTICLE_TABLE_CHARS) break;
    size += rowSize;
    seenRows.add(r.id);
    rows.push(row);
  }
  if (rows.length === 0) return undefined;
  return { id, type: 'table', ...header, cols, rows };
}

/** A short id for a row or a column, unique in its table: `r-` or `c-` and six hex digits. */
export function nextTablePartId(prefix: 'r' | 'c', taken?: ReadonlySet<string>): string {
  let id: string;
  do id = `${prefix}-${crypto.randomUUID().slice(0, 6)}`;
  while (taken?.has(id));
  return id;
}

/** A table from a grid of cells (rows of runs), capped to the table limits, every row as wide as the
 *  widest; undefined for an empty grid. Ids are fresh. */
export function tableFromGrid(
  id: string,
  grid: readonly (readonly ArticleRun[][])[],
  header: boolean,
): ArticleTableBlock | undefined {
  const rows = grid.slice(0, MAX_ARTICLE_TABLE_ROWS);
  const width = Math.min(
    MAX_ARTICLE_TABLE_COLS,
    rows.reduce((n, r) => Math.max(n, r.length), 0),
  );
  if (rows.length === 0 || width === 0) return undefined;
  const taken = new Set<string>();
  const fresh = (prefix: 'r' | 'c') => {
    const part = nextTablePartId(prefix, taken);
    taken.add(part);
    return part;
  };
  const share = normaliseShares(Array.from({ length: width }, () => 1));
  const cols = share.map((w) => ({ id: fresh('c'), w }));
  return parseArticleTable(
    {
      ...(header ? { header: true } : {}),
      cols,
      rows: rows.map((r) => ({
        id: fresh('r'),
        cells: cols.map((_, i) => r[i] ?? []),
      })),
    },
    id,
  );
}

/** A new empty table of `rows` x `cols`. */
export function newArticleTable(
  id: string,
  rows: number,
  cols: number,
  header: boolean,
): ArticleTableBlock {
  const grid = Array.from({ length: Math.max(1, rows) }, () =>
    Array.from({ length: Math.max(1, cols) }, () => [] as ArticleRun[]),
  );
  return tableFromGrid(id, grid, header)!;
}

const cellText = (runs: readonly ArticleRun[]) => runs.map((r) => r.text).join('');

/** A table's text: its cells joined by tabs, its rows by newlines (find, word counts, views). */
export function articleTableText(block: ArticleTableBlock): string {
  return block.rows.map((r) => r.cells.map(cellText).join('\t')).join('\n');
}

/** Whether two versions of a table have the same shape: header, columns (ids and shares) and row
 *  ids, in order. Cells' text is all that may differ. */
function sameShape(a: ArticleTableBlock, b: ArticleTableBlock): boolean {
  return (
    a.header === b.header &&
    a.cols.length === b.cols.length &&
    a.cols.every((c, i) => c.id === b.cols[i]!.id && c.w === b.cols[i]!.w) &&
    a.rows.length === b.rows.length &&
    a.rows.every((r, i) => r.id === b.rows[i]!.id)
  );
}

/** The cell ops that turn `before` into `after` when only cells' text changed, else null (the shape
 *  changed: the whole table goes as one put). */
export function tableCellOps(
  before: ArticleTableBlock,
  after: ArticleTableBlock,
): ArticleTableCellOp[] | null {
  if (before.id !== after.id || !sameShape(before, after)) return null;
  const ops: ArticleTableCellOp[] = [];
  after.rows.forEach((row, r) => {
    const was = before.rows[r]!;
    if (was === row) return;
    row.cells.forEach((runs, c) => {
      const old = was.cells[c];
      if (old === runs || sameArticleValue(old, runs)) return;
      ops.push({ kind: 'cell', block: after.id, row: row.id, col: after.cols[c]!.id, runs });
    });
  });
  return ops;
}

/** One cell's text replaced; the same table back when the row or column is not there. */
export function withTableCell(
  block: ArticleTableBlock,
  rowId: string,
  colId: string,
  runs: ArticleRun[],
): ArticleTableBlock {
  const c = block.cols.findIndex((col) => col.id === colId);
  const r = block.rows.findIndex((row) => row.id === rowId);
  if (c < 0 || r < 0) return block;
  const row = block.rows[r]!;
  const cells = row.cells.map((cell, i) => (i === c ? runs : cell));
  const rows = block.rows.map((x, i) => (i === r ? { ...row, cells } : x));
  return { ...block, rows };
}
