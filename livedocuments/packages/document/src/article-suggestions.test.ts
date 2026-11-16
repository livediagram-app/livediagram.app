import { describe, expect, it } from 'vitest';
import {
  MAX_ARTICLE_BLOCK_TEXT,
  normaliseRuns,
  parseArticleBlock,
  parseArticleSuggestion,
  type ArticleBlock,
  type ArticleFlow,
  type ArticleSuggestion,
} from './article-flow';
import {
  acceptedArticleFlow,
  articleHasSuggestions,
  articleSuggestionList,
  rejectedArticleFlow,
  resolveArticleRuns,
  resolveArticleSuggestions,
  runFormatOf,
  suggestionRuleHolds,
  withArticlesRejected,
  withRunFormat,
} from './article-suggestions';
import { articleToMarkdown, articleWordCount, articleTitleOf } from './article-markdown-io';

const sg = (id: string, k: ArticleSuggestion['k'], by = 'sam', extra = {}): ArticleSuggestion => ({
  id,
  k,
  by,
  n: 'Sam',
  at: 1,
  ...extra,
});
const p = (id: string, runs: object[], extra = {}) =>
  ({ id, type: 'paragraph', runs, ...extra }) as ArticleBlock;
const flowOf = (...blocks: ArticleBlock[]): ArticleFlow => ({ blocks });

describe('parsing a suggestion', () => {
  it('keeps a valid mark and drops a broken one', () => {
    expect(
      parseArticleSuggestion(
        {
          id: 's1',
          k: 'fmt',
          by: 'k',
          n: '  Sam ',
          at: 1.4,
          c: '#ff0000',
          ai: true,
          g: 'cs_1',
          was: { b: true, sup: true, sub: true, href: 'javascript:x' },
        },
        'run',
      ),
    ).toEqual({
      id: 's1',
      k: 'fmt',
      by: 'k',
      n: 'Sam',
      at: 1,
      c: '#ff0000',
      ai: true,
      g: 'cs_1',
      was: { b: true, sup: true },
    });
    expect(parseArticleSuggestion({ id: 's1', k: 'fmt', by: 'k', at: 1 }, 'block')).toBeUndefined();
    expect(parseArticleSuggestion({ id: 's1', k: 'zap', by: 'k', at: 1 }, 'run')).toBeUndefined();
    expect(parseArticleSuggestion({ id: 's1', k: 'ins', by: '', at: 1 }, 'run')).toBeUndefined();
    expect(
      parseArticleSuggestion({ id: 's1', k: 'ins', by: 'x'.repeat(65), at: 1 }, 'run'),
    ).toBeUndefined();
    expect(
      parseArticleSuggestion({ id: 's1', k: 'ins', by: 'k', at: 'now' }, 'run'),
    ).toBeUndefined();
    expect(parseArticleSuggestion(null, 'run')).toBeUndefined();
    expect(parseArticleSuggestion({ id: 's1', k: 'del', by: 'k', at: 2 }, 'run')).toEqual({
      id: 's1',
      k: 'del',
      by: 'k',
      n: '',
      at: 2,
    });
  });

  it('reads a block’s break and a run’s mark, merging runs of one suggestion', () => {
    const block = parseArticleBlock({
      id: 'b1',
      type: 'list',
      list: 'bullet',
      sg: sg('x', 'ins'),
      runs: [
        { text: 'a', sg: sg('s', 'ins') },
        { text: 'b', sg: sg('s', 'ins') },
        { text: 'c', sg: { bad: true } },
      ],
    });
    expect(block).toEqual({
      id: 'b1',
      type: 'list',
      list: 'bullet',
      sg: sg('x', 'ins'),
      runs: [{ text: 'ab', sg: sg('s', 'ins') }, { text: 'c' }],
    });
    expect(
      parseArticleBlock({ id: 'b2', type: 'paragraph', runs: [], sg: sg('y', 'fmt') }),
    ).toEqual({
      id: 'b2',
      type: 'paragraph',
      runs: [],
    });
  });

  it('counts a suggested run against the block’s budget', () => {
    const long = 'x'.repeat(MAX_ARTICLE_BLOCK_TEXT - 10);
    const runs = normaliseRuns([
      { text: long },
      { text: 'abc', sg: sg('s', 'ins') },
      { text: 'more', i: true },
    ]);
    expect(runs.map((r) => r.text.length)).toEqual([long.length, 3]);
  });
});

describe('formats', () => {
  it('reads and puts back a run’s formatting', () => {
    const run = { text: 'a', b: true as const, href: 'https://x.io', note: 'n1' };
    expect(runFormatOf(run)).toEqual({ b: true, href: 'https://x.io' });
    expect(withRunFormat(run, { i: true })).toEqual({ text: 'a', i: true, note: 'n1' });
  });
});

describe('resolving runs', () => {
  const runs = [
    { text: 'keep ' },
    { text: 'new ', sg: sg('a', 'ins') },
    { text: 'old ', sg: sg('b', 'del') },
    { text: 'bold', b: true as const, sg: sg('c', 'fmt', 'sam', { was: { i: true } }) },
  ];
  it('rejects every kind', () => {
    expect(resolveArticleRuns(runs, () => 'reject')).toEqual({
      runs: [{ text: 'keep old ' }, { text: 'bold', i: true }],
      decided: 3,
    });
  });
  it('accepts every kind', () => {
    expect(resolveArticleRuns(runs, () => 'accept')).toEqual({
      runs: [{ text: 'keep new ' }, { text: 'bold', b: true }],
      decided: 3,
    });
  });
  it('leaves what is not decided, and answers the same runs when nothing is', () => {
    expect(resolveArticleRuns(runs, (s) => (s.id === 'a' ? 'accept' : null)).decided).toBe(1);
    expect(resolveArticleRuns(runs, () => null).runs).toBe(runs);
  });
  it('puts back a plain format when a format change kept none', () => {
    const r = resolveArticleRuns([{ text: 'x', b: true, sg: sg('c', 'fmt') }], () => 'reject');
    expect(r.runs).toEqual([{ text: 'x' }]);
  });
});

describe('resolving the writing', () => {
  const split = flowOf(
    p('b1', [{ text: 'Hello ' }]),
    p('b2', [{ text: 'world' }], { sg: sg('br', 'ins') }),
  );
  it('a break put in, rejected, joins back; accepted, stays', () => {
    expect(rejectedArticleFlow(split).blocks).toEqual([p('b1', [{ text: 'Hello world' }])]);
    expect(acceptedArticleFlow(split).blocks).toEqual([
      p('b1', [{ text: 'Hello ' }]),
      p('b2', [{ text: 'world' }]),
    ]);
  });
  it('a break taken out, accepted, joins; rejected, stays', () => {
    const joined = flowOf(
      p('b1', [{ text: 'a' }]),
      p('b2', [{ text: 'b' }], { sg: sg('br', 'del') }),
    );
    expect(acceptedArticleFlow(joined).blocks).toEqual([p('b1', [{ text: 'ab' }])]);
    expect(rejectedArticleFlow(joined).blocks).toEqual([
      p('b1', [{ text: 'a' }]),
      p('b2', [{ text: 'b' }]),
    ]);
  });
  it('a new paragraph of inserted words goes whole when rejected', () => {
    const added = flowOf(
      p('b1', [{ text: 'a' }]),
      p('b2', [{ text: 'new', sg: sg('w', 'ins') }], { sg: sg('br', 'ins') }),
    );
    expect(rejectedArticleFlow(added).blocks).toEqual([p('b1', [{ text: 'a' }])]);
  });
  it('with no text block before, an empty block goes and one with words stays', () => {
    const zone = {
      id: 'z',
      type: 'zone',
      zone: 'drawing',
      width: 100,
      height: 100,
    } as ArticleBlock;
    const flow = flowOf(
      zone,
      p('b1', [], { sg: sg('a', 'ins') }),
      { id: 'd', type: 'divider' },
      p('b2', [{ text: 'kept' }], { sg: sg('b', 'ins') }),
    );
    expect(rejectedArticleFlow(flow).blocks).toEqual([
      zone,
      { id: 'd', type: 'divider' },
      p('b2', [{ text: 'kept' }]),
    ]);
  });
  it('never joins past a block’s limit', () => {
    const half = 'x'.repeat(MAX_ARTICLE_BLOCK_TEXT / 2 + 1);
    const flow = flowOf(
      p('b1', [{ text: half }]),
      p('b2', [{ text: half }], { sg: sg('a', 'del') }),
    );
    expect(acceptedArticleFlow(flow).blocks).toHaveLength(2);
  });
  it('never empties an article', () => {
    const flow = flowOf(p('b1', [{ text: 'x', sg: sg('a', 'ins') }], { sg: sg('b', 'ins') }));
    expect(rejectedArticleFlow(flow).blocks).toEqual([p('b1', [])]);
  });
  it('resolves a table’s cells, keeping its style', () => {
    const table = {
      id: 't',
      type: 'table',
      cols: [{ id: 'c', w: 1 }],
      rows: [
        { id: 'r', cells: [[{ text: 'x', sg: sg('a', 'ins') }, { text: 'y' }]] },
        { id: 'r2', cells: [[{ text: 'z' }]] },
      ],
    } as ArticleBlock;
    const out = resolveArticleSuggestions(
      { blocks: [table], style: { look: 'bold' } },
      () => 'reject',
    );
    expect(out.decided).toBe(1);
    expect(out.flow.style).toEqual({ look: 'bold' });
    expect((out.flow.blocks[0] as { rows: { cells: unknown[][] }[] }).rows[0]!.cells[0]).toEqual([
      { text: 'y' },
    ]);
  });
  it('answers the same flow when nothing is decided, memoised', () => {
    const plain = flowOf(p('b1', [{ text: 'a' }]));
    expect(rejectedArticleFlow(plain)).toBe(plain);
    expect(resolveArticleSuggestions(split, () => null).flow).toBe(split);
    expect(rejectedArticleFlow(split)).toBe(rejectedArticleFlow(split));
  });
});

describe('finding suggestions', () => {
  it('knows whether writing holds one, in a cell too', () => {
    expect(articleHasSuggestions(flowOf(p('b', [{ text: 'a' }])))).toBe(false);
    const cell = {
      id: 't',
      type: 'table',
      cols: [{ id: 'c', w: 1 }],
      rows: [{ id: 'r', cells: [[{ text: 'a', sg: sg('a', 'del') }]] }],
    } as ArticleBlock;
    expect(articleHasSuggestions(flowOf(cell))).toBe(true);
    expect(articleSuggestionList(flowOf(cell))).toEqual([
      { suggestion: sg('a', 'del'), block: 't', text: 'a', isBreak: false },
    ]);
  });
  it('lists each once, in order, a break before its words', () => {
    const flow = flowOf(
      p('b1', [
        { text: 'a', sg: sg('w', 'ins') },
        { text: 'b' },
        { text: 'c', sg: sg('w', 'ins') },
      ]),
      p('b2', [{ text: 'd' }], { sg: sg('br', 'ins') }),
    );
    expect(articleSuggestionList(flow).map((e) => [e.suggestion.id, e.text, e.isBreak])).toEqual([
      ['w', 'ac', false],
      ['br', '', true],
    ]);
    expect(articleSuggestionList(flowOf(p('b', [{ text: 'x' }])))).toEqual([]);
  });
  it('puts every article of a tab in its rejected view, the same tab when none holds one', () => {
    const tab = {
      elements: [],
      articles: {
        a: flowOf(p('b', [{ text: 'x', sg: sg('s', 'ins') }, { text: 'y' }])),
        b: flowOf(p('c', [{ text: 'z' }])),
      },
    };
    const out = withArticlesRejected(tab);
    expect(out.articles.a.blocks).toEqual([p('b', [{ text: 'y' }])]);
    expect(out.articles.b).toEqual(tab.articles.b);
    const plain = { elements: [], articles: { b: flowOf(p('c', [{ text: 'z' }])) } };
    expect(withArticlesRejected(plain)).toBe(plain);
  });
});

describe('the suggestion rule', () => {
  const base = flowOf(p('b1', [{ text: 'Hello world' }]));
  it('takes an insertion, a deletion and a format change of its own', () => {
    const after = flowOf(
      p('b1', [
        { text: 'Hello ' },
        { text: 'big ', sg: sg('a', 'ins') },
        { text: 'wor', b: true, sg: sg('f', 'fmt', 'sam', { was: {} }) },
        { text: 'ld', sg: sg('d', 'del') },
      ]),
    );
    expect(suggestionRuleHolds(base, after, 'sam')).toBe(true);
  });
  it('takes a split and a comment on text', () => {
    const after = flowOf(
      p('b1', [{ text: 'Hello ', note: 'n1' }]),
      p('b2', [{ text: 'world' }], { sg: sg('br', 'ins') }),
    );
    expect(suggestionRuleHolds(base, after, 'sam')).toBe(true);
  });
  it('reads a table’s cells too', () => {
    const table = (text: string, extra = {}) =>
      ({
        id: 't',
        type: 'table',
        cols: [{ id: 'c', w: 1 }],
        rows: [{ id: 'r', cells: [[{ text, ...extra }]] }],
      }) as ArticleBlock;
    expect(suggestionRuleHolds(flowOf(table('a')), flowOf(table('a', { note: 'n' })), 'sam')).toBe(
      true,
    );
    expect(suggestionRuleHolds(flowOf(table('a')), flowOf(table('b')), 'sam')).toBe(false);
  });
  it('refuses writing straight in', () => {
    expect(suggestionRuleHolds(base, flowOf(p('b1', [{ text: 'Hello there' }])), 'sam')).toBe(
      false,
    );
  });
  it('refuses a suggestion in someone else’s name, or marked as an assistant’s', () => {
    const forged = flowOf(
      p('b1', [{ text: 'Hello world' }, { text: '!', sg: sg('a', 'ins', 'kim') }]),
    );
    expect(suggestionRuleHolds(base, forged, 'sam')).toBe(false);
    const ai = flowOf(
      p('b1', [{ text: 'Hello world' }, { text: '!', sg: sg('a', 'ins', 'sam', { ai: true }) }]),
    );
    expect(suggestionRuleHolds(base, ai, 'sam')).toBe(false);
  });
  it('refuses touching someone else’s suggestion, and takes back its own', () => {
    const theirs = flowOf(
      p('b1', [{ text: 'Hello world' }, { text: '!', sg: sg('a', 'ins', 'kim') }]),
    );
    expect(suggestionRuleHolds(theirs, base, 'sam')).toBe(false);
    const accepted = flowOf(p('b1', [{ text: 'Hello world!' }]));
    expect(suggestionRuleHolds(theirs, accepted, 'sam')).toBe(false);
    const edited = flowOf(
      p('b1', [{ text: 'Hello world' }, { text: '!!', sg: sg('a', 'ins', 'kim') }]),
    );
    expect(suggestionRuleHolds(theirs, edited, 'sam')).toBe(false);
    const mine = flowOf(
      p('b1', [{ text: 'Hello world' }, { text: '!', sg: sg('a', 'ins', 'sam') }]),
    );
    expect(suggestionRuleHolds(mine, base, 'sam')).toBe(true);
  });
});

describe('Markdown and counts read the rejected view', () => {
  it('writes no unaccepted words', () => {
    const flow = flowOf(
      p('t', [{ text: 'Plan' }, { text: ' B', sg: sg('a', 'ins') }], { style: 'title' }),
      p('b1', [
        { text: 'one ' },
        { text: 'two', sg: sg('b', 'del') },
        { text: ' three', sg: sg('c', 'ins') },
      ]),
    );
    expect(articleToMarkdown(flow)).toBe('---\ntitle: Plan\n---\n\none two\n');
    expect(articleWordCount(flow)).toBe(3);
    expect(articleTitleOf(flow)).toBe('Plan');
  });
});
