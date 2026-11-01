import { describe, expect, it } from 'vitest';
import { parseArticleBlock, parseArticleFlow, type ArticleFlow } from './article-flow';
import { applyArticleOps, diffArticleFlow, parseArticleOps } from './article-flow-ops';
import {
  ARTICLE_TABLE_MIN_SHARE,
  MAX_ARTICLE_CELL_TEXT,
  MAX_ARTICLE_TABLE_CHARS,
  MAX_ARTICLE_TABLE_COLS,
  MAX_ARTICLE_TABLE_ROWS,
  articleTableText,
  newArticleTable,
  nextTablePartId,
  normaliseShares,
  parseArticleTable,
  tableCellOps,
  tableFromGrid,
  withTableCell,
  type ArticleTableBlock,
} from './article-table';
import { applyParticipantArticleOps } from './participant-article';
import type { Tab } from './index';

// docs/specs/007-editor/article-pages.md "Tables", "Collaboration", "Share roles".
const runs = (text: string) => (text ? [{ text }] : []);
const table = (cells: string[][], header = true): ArticleTableBlock => ({
  id: 't',
  type: 'table',
  ...(header ? { header: true as const } : {}),
  cols: cells[0]!.map((_, i) => ({ id: `c${i}`, w: 1 / cells[0]!.length })),
  rows: cells.map((r, i) => ({ id: `r${i}`, cells: r.map(runs) })),
});
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('normaliseShares', () => {
  it('sums to 1, lifts narrow columns to the minimum and fills bad shares with the mean', () => {
    expect(normaliseShares([])).toEqual([]);
    expect(normaliseShares([1, 1])).toEqual([0.5, 0.5]);
    expect(normaliseShares([1, Number.NaN])).toEqual([0.5, 0.5]);
    expect(normaliseShares([-1, 0])).toEqual([0.5, 0.5]);
    const lifted = normaliseShares([0.01, 0.99]);
    expect(lifted[0]).toBe(ARTICLE_TABLE_MIN_SHARE);
    expect(sum(lifted)).toBeCloseTo(1);
  });

  it('splits evenly when there are too many columns for the minimum', () => {
    const many = normaliseShares(Array.from({ length: 25 }, (_, i) => (i === 0 ? 100 : 1)));
    expect(many.every((w) => w >= 1 / 25 - 1e-4)).toBe(true);
    expect(sum(many)).toBeCloseTo(1, 3);
  });
});

describe('reading a stored table', () => {
  it('reads a good table, its header and its shares', () => {
    const t = parseArticleBlock({ ...table([['a', 'b']]), header: true });
    expect(t).toEqual(table([['a', 'b']]));
    expect(parseArticleBlock({ ...table([['a']], false), header: 'yes' })).toEqual(
      table([['a']], false),
    );
  });

  it('drops a table with no columns or no rows, or without lists for them', () => {
    expect(parseArticleTable({ cols: 'x', rows: [] }, 't')).toBeUndefined();
    expect(parseArticleTable({ cols: [], rows: [{ id: 'r', cells: [] }] }, 't')).toBeUndefined();
    expect(parseArticleTable({ cols: [{ id: 'c', w: 1 }], rows: [] }, 't')).toBeUndefined();
    expect(parseArticleTable({ cols: [{ id: 'c', w: 1 }], rows: [null, 3] }, 't')).toBeUndefined();
  });

  it('drops bad or repeated columns and rows, and pads or cuts ragged rows', () => {
    const t = parseArticleTable(
      {
        cols: [null, { id: '' }, { id: 'a', w: 'wide' }, { id: 'a', w: 1 }, { id: 'b', w: 3 }],
        rows: [
          { id: 'r1', cells: [[{ text: 'x' }]] },
          { id: 'r1', cells: [] },
          { id: 'r2', cells: 'nope' },
          { id: 'r3', cells: [[], [], [{ text: 'cut' }]] },
          { cells: [] },
        ],
      },
      't',
    )!;
    expect(t.cols.map((c) => c.id)).toEqual(['a', 'b']);
    expect(t.cols.map((c) => c.w)).toEqual([0.25, 0.75]);
    expect(t.rows.map((r) => r.id)).toEqual(['r1', 'r2', 'r3']);
    expect(t.rows.map((r) => r.cells.length)).toEqual([2, 2, 2]);
    expect(t.rows[1]!.cells).toEqual([[], []]);
  });

  it('keeps at most the column and row caps, a cell at most its text cap', () => {
    const t = parseArticleTable(
      {
        cols: Array.from({ length: MAX_ARTICLE_TABLE_COLS + 3 }, (_, i) => ({ id: `c${i}`, w: 1 })),
        rows: Array.from({ length: MAX_ARTICLE_TABLE_ROWS + 5 }, (_, i) => ({
          id: `r${i}`,
          cells: i === 0 ? [[{ text: 'x'.repeat(MAX_ARTICLE_CELL_TEXT + 50) }]] : [],
        })),
      },
      't',
    )!;
    expect(t.cols).toHaveLength(MAX_ARTICLE_TABLE_COLS);
    expect(t.rows).toHaveLength(MAX_ARTICLE_TABLE_ROWS);
    expect(t.rows[0]!.cells[0]![0]!.text).toHaveLength(MAX_ARTICLE_CELL_TEXT);
  });

  it('stops taking rows once the table would pass its size', () => {
    const t = parseArticleTable(
      {
        cols: [{ id: 'c', w: 1 }],
        rows: Array.from({ length: 200 }, (_, i) => ({
          id: `r${i}`,
          cells: [[{ text: 'y'.repeat(MAX_ARTICLE_CELL_TEXT) }]],
        })),
      },
      't',
    )!;
    expect(t.rows.length).toBeLessThan(200);
    expect(JSON.stringify(t).length).toBeLessThanOrEqual(MAX_ARTICLE_TABLE_CHARS);
  });

  it('is part of an article read, and a contents block keeps only depth 1 or 2', () => {
    const flow = parseArticleFlow({
      blocks: [
        table([['a']]),
        { id: 'x1', type: 'toc' },
        { id: 'x2', type: 'toc', depth: 2 },
        { id: 'x3', type: 'toc', depth: 3 },
        { id: 'x4', type: 'toc', depth: 1 },
      ],
    });
    expect(flow.blocks.map((b) => (b.type === 'toc' ? (b.depth ?? 3) : b.type))).toEqual([
      'table',
      3,
      2,
      3,
      1,
    ]);
  });
});

describe('making tables', () => {
  it('makes a new empty table, each row as wide as the widest, ids fresh', () => {
    const t = newArticleTable('t', 3, 2, true);
    expect(t.header).toBe(true);
    expect(t.rows).toHaveLength(3);
    expect(t.cols).toHaveLength(2);
    expect(new Set([...t.cols.map((c) => c.id), ...t.rows.map((r) => r.id)]).size).toBe(5);
    expect(newArticleTable('t', 0, 0, false).rows).toHaveLength(1);
    const ragged = tableFromGrid('t', [[runs('a')], [runs('b'), runs('c')]], false)!;
    expect(ragged.rows.map((r) => r.cells.length)).toEqual([2, 2]);
    expect(ragged.header).toBeUndefined();
  });

  it('makes nothing from an empty grid', () => {
    expect(tableFromGrid('t', [], true)).toBeUndefined();
    expect(tableFromGrid('t', [[]], true)).toBeUndefined();
  });

  it('never repeats a part id it is told is taken', () => {
    const taken = new Set<string>();
    for (let i = 0; i < 50; i++) taken.add(nextTablePartId('r', taken));
    expect(taken.size).toBe(50);
  });

  it('reads as tab- and newline-joined text', () => {
    expect(
      articleTableText(
        table([
          ['a', 'b'],
          ['c', ''],
        ]),
      ),
    ).toBe('a\tb\nc\t');
  });
});

describe('cell by cell', () => {
  const before = table([
    ['a', 'b'],
    ['c', 'd'],
  ]);

  it('sends only the changed cells while the shape stays', () => {
    const after = withTableCell(before, 'r1', 'c0', runs('C'));
    expect(tableCellOps(before, after)).toEqual([
      { kind: 'cell', block: 't', row: 'r1', col: 'c0', runs: [{ text: 'C' }] },
    ]);
    expect(tableCellOps(before, before)).toEqual([]);
  });

  it('answers null when the shape changed', () => {
    expect(tableCellOps(before, { ...before, header: undefined })).toBeNull();
    expect(tableCellOps(before, { ...before, id: 'u' })).toBeNull();
    expect(tableCellOps(before, { ...before, rows: before.rows.slice(1) })).toBeNull();
    expect(
      tableCellOps(before, {
        ...before,
        cols: before.cols.map((c, i) => ({ ...c, w: i ? 0.7 : 0.3 })),
      }),
    ).toBeNull();
  });

  it('leaves a table be when the cell is gone', () => {
    expect(withTableCell(before, 'r9', 'c0', runs('x'))).toBe(before);
    expect(withTableCell(before, 'r0', 'c9', runs('x'))).toBe(before);
  });

  it('diffs a cells-only change as cell ops and a shape change as a put', () => {
    const was: ArticleFlow = { blocks: [before] };
    const cells = diffArticleFlow(was, { blocks: [withTableCell(before, 'r0', 'c1', runs('B'))] });
    expect(cells.map((o) => o.kind)).toEqual(['cell']);
    const shape = diffArticleFlow(was, { blocks: [{ ...before, rows: before.rows.slice(0, 1) }] });
    expect(shape.map((o) => o.kind)).toEqual(['put']);
  });

  it('merges two writers in different cells, and drops a cell op whose cell went', () => {
    const base: ArticleFlow = { blocks: [before] };
    const mine = diffArticleFlow(base, { blocks: [withTableCell(before, 'r0', 'c0', runs('A'))] });
    const theirs = diffArticleFlow(base, {
      blocks: [withTableCell(before, 'r1', 'c1', runs('D'))],
    });
    const merged = applyArticleOps(applyArticleOps(base, theirs), mine);
    expect(articleTableText(merged.blocks[0] as ArticleTableBlock)).toBe('A\tb\nc\tD');
    // A shape change first: a cell op for a row it removed changes nothing.
    const shrunk = applyArticleOps(base, [
      { kind: 'put', block: { ...before, rows: before.rows.slice(0, 1) } },
    ]);
    expect(applyArticleOps(shrunk, theirs)).toEqual(shrunk);
    // A cell op naming a block that is not a table changes nothing.
    const para: ArticleFlow = { blocks: [{ id: 't', type: 'paragraph', runs: [] }] };
    expect(applyArticleOps(para, mine).blocks).toEqual(para.blocks);
  });

  it('reads a peer’s cell op defensively', () => {
    expect(
      parseArticleOps([
        { kind: 'cell', block: 't', row: 'r0', col: 'c0', runs: [{ text: 'x' }, { text: 1 }] },
        { kind: 'cell', block: '', row: 'r0', col: 'c0', runs: [] },
        { kind: 'cell', block: 't', row: 'r0' },
      ]),
    ).toEqual([{ kind: 'cell', block: 't', row: 'r0', col: 'c0', runs: [{ text: 'x' }] }]);
  });
});

describe('a Participant and a table', () => {
  const tab = (blocks: ArticleFlow['blocks']): Tab => ({
    id: 't1',
    name: 'Brief',
    elements: [],
    pages: [{ id: 'p1', kind: 'article', orientation: 'portrait', flow: 'f1' }],
    articles: { f1: { blocks } },
  });
  const t = table([['a', 'b']]);

  it('writes a cell’s text', () => {
    const out = applyParticipantArticleOps(tab([t]), 'f1', [
      { kind: 'cell', block: 't', row: 'r0', col: 'c0', runs: runs('A') },
    ]);
    expect(out.result).toBe('applied');
  });

  it('never puts or removes a table or a contents block, nor writes a cell of a missing table', () => {
    const refused = (ops: Parameters<typeof applyParticipantArticleOps>[2], blocks = [t]) =>
      applyParticipantArticleOps(tab(blocks), 'f1', ops).result;
    expect(refused([{ kind: 'put', block: { ...t, header: undefined } }])).toBe('refused');
    expect(refused([{ kind: 'remove', id: 't' }])).toBe('refused');
    expect(refused([{ kind: 'put', block: { id: 'x', type: 'toc' } }])).toBe('refused');
    expect(refused([{ kind: 'cell', block: 'gone', row: 'r0', col: 'c0', runs: [] }])).toBe(
      'refused',
    );
  });
});
