import { describe, expect, it } from 'vitest';
import {
  acceptedArticleFlow,
  articleFromMarkdown,
  articleSuggestionList,
  articleToMarkdown,
  MAX_ARTICLE_BLOCK_TEXT,
  rejectedArticleFlow,
  type ArticleBlock,
  type ArticleFlow,
} from '@livedocuments/document';
import { diffKeys, suggestArticleWrite, suggestedWriteLines } from './article-suggest';

const author = { by: 'agent:tok1', n: 'Claude', at: 5, ai: true as const, g: 'cs-1' };
const ids = () => {
  let n = 0;
  return () => `s${++n}`;
};
const p = (id: string, text: string, extra = {}): ArticleBlock => ({
  id,
  type: 'paragraph',
  runs: text ? [{ text }] : [],
  ...extra,
});
const flowOf = (...blocks: ArticleBlock[]): ArticleFlow => ({ blocks });

describe('diffKeys', () => {
  it('finds the edits between two lists', () => {
    const ops = diffKeys(['a', 'b', 'c', 'd'], ['a', 'x', 'c', 'd', 'e']);
    expect(ops.map((o) => o.k)).toEqual(['eq', 'del', 'ins', 'eq', 'eq', 'ins']);
    expect(diffKeys([], ['a']).map((o) => o.k)).toEqual(['ins']);
    expect(diffKeys(['a'], []).map((o) => o.k)).toEqual(['del']);
    expect(diffKeys(['a', 'b'], ['a', 'b']).map((o) => o.k)).toEqual(['eq', 'eq']);
  });
  it('gives up matching past its edit budget', () => {
    const a = Array.from({ length: 50 }, (_, i) => `a${i}`);
    const b = Array.from({ length: 50 }, (_, i) => `b${i}`);
    const ops = diffKeys(['x', ...a, 'y'], ['x', ...b, 'y'], 10);
    expect(ops.filter((o) => o.k === 'del')).toHaveLength(50);
    expect(ops[0]).toEqual({ k: 'eq', a: 0, b: 0 });
    expect(ops[ops.length - 1]).toEqual({ k: 'eq', a: 51, b: 51 });
  });
  it('stays fast on a long, much changed list', () => {
    const a = Array.from({ length: 5000 }, (_, i) => `w${i % 97}`);
    const b = Array.from({ length: 5000 }, (_, i) => `w${(i * 7) % 89}`);
    const ops = diffKeys(a, b);
    expect(ops.filter((o) => o.k !== 'ins')).toHaveLength(5000);
  });
});

describe('suggestArticleWrite', () => {
  it('makes changed words insertions and deletions, by the assistant', () => {
    const before = flowOf(p('b1', 'The quick fox jumps.'));
    const after = flowOf(p('x', 'The slow fox jumps high.'));
    const out = suggestArticleWrite(before, after, author, ids());
    expect(out.flow.blocks[0]).toEqual({
      id: 'b1',
      type: 'paragraph',
      runs: [
        { text: 'The ' },
        { text: 'quick', sg: { id: 's1', k: 'del', ...author } },
        { text: 'slow', sg: { id: 's2', k: 'ins', ...author } },
        { text: ' fox jumps' },
        { text: ' high', sg: { id: 's3', k: 'ins', ...author } },
        { text: '.' },
      ],
    });
    expect(out.suggested).toBe(3);
    expect(articleToMarkdown(out.flow)).toBe(articleToMarkdown(before));
    expect(rejectedArticleFlow(out.flow).blocks).toEqual(before.blocks);
    expect(acceptedArticleFlow(out.flow).blocks[0]).toEqual({ ...after.blocks[0], id: 'b1' });
  });

  it('makes a formatting change on kept words a format change', () => {
    const before = flowOf(p('b1', 'Make it bold'));
    const after = flowOf({
      id: 'b1',
      type: 'paragraph',
      runs: [{ text: 'Make it ' }, { text: 'bold', b: true }],
    });
    const out = suggestArticleWrite(before, after, author, ids());
    expect(out.flow.blocks[0]).toEqual({
      id: 'b1',
      type: 'paragraph',
      runs: [
        { text: 'Make it ' },
        { text: 'bold', b: true, sg: { id: 's1', k: 'fmt', ...author, was: {} } },
      ],
    });
    expect(rejectedArticleFlow(out.flow).blocks).toEqual(before.blocks);
  });

  it('pairs a changed paragraph in place, keeping its id', () => {
    const before = flowOf(p('b1', 'One'), p('b2', 'Two'), p('b3', 'Three'));
    const after = flowOf(p('b1', 'One'), p('n1', 'New'), p('b3', 'Three'));
    const out = suggestArticleWrite(before, after, author, ids());
    expect(out.flow.blocks.map((b) => b.id)).toEqual(['b1', 'b2', 'b3']);
    expect(rejectedArticleFlow(out.flow).blocks).toEqual(before.blocks);
    expect(acceptedArticleFlow(out.flow).blocks[1]).toEqual(p('b2', 'New'));
  });

  it('adds a new block as a break put in', () => {
    const before = flowOf(p('b1', 'One'), p('b3', 'Three'));
    const after = flowOf(p('b1', 'One'), p('n1', 'New'), p('b3', 'Three'));
    const out = suggestArticleWrite(before, after, author, ids());
    expect(out.flow.blocks.map((b) => [b.id, 'sg' in b && b.sg?.k])).toEqual([
      ['b1', false],
      ['n1', 'ins'],
      ['b3', false],
    ]);
    expect(rejectedArticleFlow(out.flow).blocks).toEqual(before.blocks);
    expect(acceptedArticleFlow(out.flow).blocks).toEqual(after.blocks);
    const gone = suggestArticleWrite(after, before, author, ids());
    expect(rejectedArticleFlow(gone.flow).blocks).toEqual(after.blocks);
    expect(acceptedArticleFlow(gone.flow).blocks).toEqual(before.blocks);
    const empty = suggestArticleWrite(
      flowOf(p('b1', 'One'), p('e', '')),
      flowOf(p('b1', 'One')),
      author,
      ids(),
    );
    expect(empty.suggested).toBe(1);
  });

  it('takes out a block and its break, and puts a new one in, when the kinds differ', () => {
    const before = flowOf(p('b1', 'One'), p('b2', 'Two'));
    const after = flowOf(p('b1', 'One'), {
      id: 'l1',
      type: 'list',
      list: 'bullet',
      runs: [{ text: 'Item' }],
    });
    const out = suggestArticleWrite(before, after, author, ids());
    expect(rejectedArticleFlow(out.flow).blocks).toEqual(before.blocks);
    expect(acceptedArticleFlow(out.flow).blocks).toEqual([
      p('b1', 'One'),
      { id: 'l1', type: 'list', list: 'bullet', runs: [{ text: 'Item' }] },
    ]);
    expect(out.suggested).toBe(4);
  });

  it('writes what has no suggestion form straight in, and says so', () => {
    const before = flowOf(p('b1', 'One'), { id: 'd1', type: 'divider' });
    const after: ArticleFlow = {
      blocks: [p('b1', 'One', { style: 'h1' }), { id: 'c1', type: 'code', text: 'x = 1' }],
      style: { look: 'bold' },
    };
    const out = suggestArticleWrite(before, after, author, ids());
    expect(out.flow.blocks.map((b) => b.type)).toEqual(['paragraph', 'code']);
    expect([...out.direct]).toEqual([
      ['block style', 1],
      ['divider', 1],
      ['code', 1],
      ['look', 1],
    ]);
    expect(out.flow.style).toEqual({ look: 'bold' });
    const style = suggestArticleWrite(
      flowOf(p('b1', 'One')),
      flowOf(p('b1', 'Two', { style: 'h1' })),
      author,
      ids(),
    );
    expect([...style.direct]).toEqual([['block style', 1]]);
  });

  it('leaves a block holding someone else’s suggestion as it is', () => {
    const theirs = { id: 'k1', k: 'ins' as const, by: 'key-sam', n: 'Sam', at: 1 };
    const before = flowOf(p('b1', 'Hi'), {
      id: 'b2',
      type: 'paragraph',
      runs: [{ text: 'Old' }, { text: ' text', sg: theirs }],
    });
    const out = suggestArticleWrite(before, flowOf(p('b1', 'Hi'), p('b2', 'New')), author, ids());
    expect(out.flow.blocks[1]).toEqual(before.blocks[1]);
    expect(out.kept).toBe(1);
    const gone = suggestArticleWrite(before, flowOf(p('b1', 'Hi')), author, ids());
    expect(gone.flow.blocks[1]).toEqual(before.blocks[1]);
    expect(gone.kept).toBe(1);
  });

  it('keeps blocks the rejected view joined, with their own', () => {
    const brk = { id: 'k2', k: 'ins' as const, by: 'key-sam', n: 'Sam', at: 1 };
    const before = flowOf(p('b1', 'Hello '), p('b2', 'world', { sg: brk }), p('b3', 'Bye'));
    expect(articleToMarkdown(before)).toBe('Hello world\n\nBye\n');
    const same = suggestArticleWrite(
      before,
      articleFromMarkdown('Hello world\n\nBye', before) as ArticleFlow,
      author,
      ids(),
    );
    expect(same.flow.blocks).toEqual(before.blocks);
    expect(same.suggested).toBe(0);
  });

  it('suggests nothing new when the same text is written again', () => {
    const before = flowOf(p('b1', 'The quick fox.'));
    const first = suggestArticleWrite(before, flowOf(p('b1', 'The slow fox.')), author, ids());
    const again = suggestArticleWrite(first.flow, flowOf(p('b1', 'The slow fox.')), author, ids());
    expect(articleSuggestionList(again.flow).map((e) => e.text)).toEqual(['quick', 'slow']);
  });

  it('leaves a paragraph that would pass its limit with the suggested words beside the old', () => {
    const long = 'a '.repeat(MAX_ARTICLE_BLOCK_TEXT / 2 - 10);
    const before = flowOf(p('b1', long));
    const out = suggestArticleWrite(
      before,
      flowOf(p('b1', 'b '.repeat(MAX_ARTICLE_BLOCK_TEXT / 2 - 10))),
      author,
      ids(),
    );
    expect(out.tooLong).toBe(1);
    expect(out.flow.blocks[0]).toEqual(before.blocks[0]);
  });

  it('mints its own ids by default, and new blocks never take a stored id', () => {
    const before = flowOf(
      p('b1', 'One'),
      p('b2', 'x', { sg: { id: 'k', k: 'ins', by: 'kim', n: 'Kim', at: 1 } }),
    );
    const out = suggestArticleWrite(
      before,
      flowOf(p('b1', 'One'), { id: 'd', type: 'divider' }, p('b2', 'New')),
      author,
    );
    const idsOut = out.flow.blocks.map((b) => b.id);
    expect(new Set(idsOut).size).toBe(idsOut.length);
    const minted = articleSuggestionList(out.flow).filter((e) => e.suggestion.by === author.by);
    for (const e of minted) expect(e.suggestion.id).toMatch(/^s-[0-9a-f]{8}$/);
  });
});

describe('suggestArticleWrite: kinds of block', () => {
  it('diffs a list item’s words and keeps a footnote reference whole', () => {
    const li = (text: string) =>
      ({
        id: 'l1',
        type: 'list',
        list: 'bullet',
        runs: [{ text }, { text: '1', fn: 'A note' }],
      }) as ArticleBlock;
    const out = suggestArticleWrite(flowOf(li('Old item')), flowOf(li('New item')), author, ids());
    expect(out.suggested).toBe(2);
    expect(rejectedArticleFlow(out.flow).blocks).toEqual([li('Old item')]);
  });

  it('leaves a table holding someone else’s suggestion, and writes another straight in', () => {
    const table = (text: string, sg?: object) =>
      ({
        id: 't1',
        type: 'table',
        cols: [{ id: 'c', w: 1 }],
        rows: [{ id: 'r', cells: [[{ text, ...(sg ? { sg } : {}) }]] }],
      }) as ArticleBlock;
    const theirs = { id: 'k', k: 'ins', by: 'kim', n: 'Kim', at: 1 };
    const kept = suggestArticleWrite(
      flowOf(p('b1', 'A'), table('x', theirs)),
      flowOf(p('b1', 'A')),
      author,
      ids(),
    );
    expect(kept.kept).toBe(1);
    const plain = suggestArticleWrite(
      flowOf(p('b1', 'A'), table('x')),
      flowOf(p('b1', 'A')),
      author,
      ids(),
    );
    expect([...plain.direct]).toEqual([['table', 1]]);
    const brk = suggestArticleWrite(
      flowOf(p('b1', 'A'), p('b2', 'B', { sg: { id: 'k', k: 'del', by: 'kim', n: 'Kim', at: 1 } })),
      flowOf(p('b1', 'A')),
      author,
      ids(),
    );
    expect(brk.kept).toBe(1);
  });

  it('rewrites its own earlier suggestions', () => {
    const before = flowOf({
      id: 'b1',
      type: 'paragraph',
      runs: [{ text: 'Hi' }, { text: ' there', sg: { id: 'old', k: 'ins', ...author } }],
    });
    const out = suggestArticleWrite(before, flowOf(p('b1', 'Hello')), author, ids());
    expect(out.kept).toBe(0);
    expect(rejectedArticleFlow(out.flow).blocks).toEqual([p('b1', 'Hi')]);
  });

  it('leaves a paragraph whose suggestions would pass a block’s runs', () => {
    const words = (w: string) =>
      Array.from({ length: 300 }, (_, i) => ({
        text: `${w}${i} `,
        ...(i % 2 ? { b: true as const } : {}),
      }));
    const before = flowOf({ id: 'b1', type: 'paragraph', runs: words('a') });
    const out = suggestArticleWrite(
      before,
      flowOf({ id: 'b1', type: 'paragraph', runs: words('z') }),
      author,
      ids(),
    );
    expect(out.tooLong).toBe(1);
  });

  it('puts in an empty paragraph as a break alone', () => {
    const out = suggestArticleWrite(
      flowOf(p('b1', 'A')),
      flowOf(p('b1', 'A'), { id: 'd', type: 'divider' }, p('e', '')),
      author,
      ids(),
    );
    expect(out.suggested).toBe(1);
  });

  it('notes a look taken off', () => {
    const out = suggestArticleWrite(
      { blocks: [p('b1', 'A')], style: { look: 'bold' } },
      flowOf(p('b1', 'A')),
      author,
      ids(),
    );
    expect([...out.direct]).toEqual([['look', 1]]);
    expect(out.flow.style).toBeUndefined();
  });
});

describe('suggestedWriteLines', () => {
  it('says what was suggested, written straight in, left and too long', () => {
    expect(
      suggestedWriteLines(
        {
          flow: { blocks: [] },
          suggested: 1,
          direct: new Map([
            ['table', 2],
            ['block style', 1],
            ['odd', 1],
          ]),
          kept: 1,
          tooLong: 1,
        },
        'Plan',
      ),
    ).toEqual([
      'Suggested 1 edit to the article "Plan": they wait for review in the editor.',
      'Written straight in, with no suggestion form: 2 tables, 1 block style, 1 odd.',
      "Left 1 block holding others' suggestions as it is: they wait for review.",
      "Left 1 paragraph as it is: with the suggested words kept beside the old, it would pass a paragraph's 20,000 characters. Split it first.",
    ]);
    expect(
      suggestedWriteLines(
        { flow: { blocks: [] }, suggested: 0, direct: new Map(), kept: 2, tooLong: 2 },
        'Plan',
      ),
    ).toEqual([
      'Suggested no edits to the article "Plan": its text already reads that way.',
      "Left 2 blocks holding others' suggestions as they are: they wait for review.",
      "Left 2 paragraphs as they are: with the suggested words kept beside the old, they would pass a paragraph's 20,000 characters. Split them first.",
    ]);
  });
});

describe('suggestedWriteLines: plurals', () => {
  it('counts more than one edit, with nothing else to say', () => {
    expect(
      suggestedWriteLines(
        { flow: { blocks: [] }, suggested: 2, direct: new Map(), kept: 0, tooLong: 0 },
        'Plan',
      ),
    ).toEqual(['Suggested 2 edits to the article "Plan": they wait for review in the editor.']);
  });
});
