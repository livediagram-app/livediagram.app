import { describe, expect, it } from 'vitest';
import type { ArticleFlow } from '@liveworkspace/article/article-flow';
import {
  articleTableText,
  tableCellOps,
  withTableCell,
  type ArticleTableBlock,
} from '@liveworkspace/article/article-table';
import { applyArticleOps, diffArticleFlow, parseArticleOps } from './article-flow-ops';
import { applyParticipantArticleOps } from './participant-article';
import type { Tab } from './index';

// docs/specs/007-editor/article-pages.md "Tables", "Collaboration", "Share roles": a table's cells through the ops and
// a Participant's edits (the table's own reading is tested in @liveworkspace/article).
const runs = (text: string) => (text ? [{ text }] : []);
const table = (cells: string[][], header = true): ArticleTableBlock => ({
  id: 't',
  type: 'table',
  ...(header ? { header: true as const } : {}),
  cols: cells[0]!.map((_, i) => ({ id: `c${i}`, w: 1 / cells[0]!.length })),
  rows: cells.map((r, i) => ({ id: `r${i}`, cells: r.map(runs) })),
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
