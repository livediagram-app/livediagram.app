import { describe, expect, it } from 'vitest';
import type { ArticleHoldRow, RoomOp } from '@livedocuments/api-schema';
import type { ArticleBlock, Tab } from '@livedocuments/document';
import { heldArticleTargets, heldMessage } from './held-paragraphs';

// docs/specs/024-agents/pages-for-agents.md "Held paragraphs": which of an agent's article frames meet a person's
// hold, and the words the refusal says.

const sam: Omit<ArticleHoldRow, 'flow' | 'blockId'> = { name: 'Sam Lee', color: '#f00' };
const hold = (blockId: string, extra: Partial<ArticleHoldRow> = {}): ArticleHoldRow => ({
  flow: 'f',
  blockId,
  ...sam,
  ...extra,
});
const para = (id: string, text = 'words'): ArticleBlock => ({
  id,
  type: 'paragraph',
  runs: [{ text }],
});
const frame = (ops: unknown[], flow = 'f'): RoomOp =>
  ({ kind: 'article', tabId: 't', flow, ops }) as RoomOp;

describe('which writes meet a hold', () => {
  it('meets a held paragraph put, moved or removed, and leaves the rest', () => {
    const holds = [hold('b1'), hold('b2'), hold('b3')];
    const met = heldArticleTargets(
      [
        frame([
          { kind: 'put', block: para('b1') },
          { kind: 'put', block: para('b2'), after: null },
          { kind: 'remove', id: 'b3' },
          { kind: 'put', block: para('b9') },
          { kind: 'style' },
        ]),
      ],
      holds,
    );
    expect(met.map((h) => h.blockId)).toEqual(['b1', 'b2', 'b3']);
    expect(met[0]).toEqual({ flow: 'f', blockId: 'b1', by: { name: 'Sam Lee', color: '#f00' } });
  });

  it('holds nothing without holds, or when the room could not answer', () => {
    const ops = [frame([{ kind: 'put', block: para('b1') }])];
    expect(heldArticleTargets(ops, null)).toEqual([]);
    expect(heldArticleTargets(ops, [])).toEqual([]);
  });

  it('keeps to the article a hold is in', () => {
    expect(heldArticleTargets([frame([{ kind: 'remove', id: 'b1' }], 'g')], [hold('b1')])).toEqual(
      [],
    );
  });

  it('meets a cell hold by that cell, or by its whole table, never by another cell', () => {
    const cell = hold('tbl', { row: 'r1', col: 'c1' });
    const other = { kind: 'cell', block: 'tbl', row: 'r1', col: 'c2', runs: [] };
    const same = { kind: 'cell', block: 'tbl', row: 'r1', col: 'c1', runs: [] };
    expect(heldArticleTargets([frame([other])], [cell])).toEqual([]);
    expect(heldArticleTargets([frame([same])], [cell])).toHaveLength(1);
    expect(
      heldArticleTargets([frame([{ kind: 'put', block: { id: 'tbl', type: 'table' } }])], [cell]),
    ).toHaveLength(1);
    // A hold of the table block as a whole is met by any of its cells.
    expect(heldArticleTargets([frame([other])], [hold('tbl')])).toHaveLength(1);
  });

  it('meets every hold in an article written away, each once', () => {
    const removed = { kind: 'article', tabId: 't', flow: 'f', removed: true } as RoomOp;
    const met = heldArticleTargets(
      [removed, frame([{ kind: 'remove', id: 'b1' }]), { kind: 'tab-focus', tabId: 't' }],
      [hold('b1'), hold('b2'), hold('x', { flow: 'g' })],
    );
    expect(met.map((h) => h.blockId)).toEqual(['b1', 'b2']);
  });
});

describe('the refusal says who is writing where', () => {
  const tab = (blocks: ArticleBlock[]): Tab =>
    ({ id: 't', name: 'T', elements: [], articles: { f: { blocks } } }) as unknown as Tab;
  const by = { name: 'Sam Lee', color: '#f00' };

  it('quotes a paragraph by its opening words, cut with an ellipsis past 40 characters', () => {
    const long = 'The plan for spring is to plant everything at once,   and then wait';
    expect(heldMessage(tab([para('b1', long)]), [{ flow: 'f', blockId: 'b1', by }])).toBe(
      'Sam Lee is writing in "The plan for spring is to plant everythi…". Try again once they pause, or leave that paragraph as it is.',
    );
    expect(heldMessage(tab([para('b1', 'Short')]), [{ flow: 'f', blockId: 'b1', by }])).toBe(
      'Sam Lee is writing in "Short". Try again once they pause, or leave that paragraph as it is.',
    );
  });

  it('names an empty or missing paragraph, a cell, a table and a block with no text plainly', () => {
    const blocks: ArticleBlock[] = [
      para('empty', '  '),
      { id: 'd', type: 'divider' } as ArticleBlock,
      {
        id: 'tbl',
        type: 'table',
        cols: [{ id: 'c1', width: 1 }],
        rows: [{ id: 'r1', cells: [[{ text: 'Cell words' }]] }],
      } as unknown as ArticleBlock,
    ];
    const message = heldMessage(tab(blocks), [
      { flow: 'f', blockId: 'empty', by },
      { flow: 'f', blockId: 'gone', by },
      { flow: 'f', blockId: 'tbl', row: 'r1', col: 'c1', by },
      { flow: 'f', blockId: 'd', by: { name: 'Ann', color: '#0f0' } },
    ]);
    expect(message).toBe(
      'Sam Lee is writing in a paragraph; Sam Lee is writing in a paragraph; Sam Lee is writing in a table cell (and 1 more). Try again once they pause, or leave those paragraphs as they are.',
    );
    expect(heldMessage(tab(blocks), [{ flow: 'f', blockId: 'd', by }])).toMatch(
      /^Sam Lee is writing in a paragraph\./,
    );
    expect(heldMessage(tab(blocks), [{ flow: 'f', blockId: 'tbl', by }])).toMatch(
      /^Sam Lee is writing in "Cell words/,
    );
  });
});
