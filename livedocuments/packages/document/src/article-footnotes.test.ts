import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  ARTICLE_FOOTNOTE_REF,
  MAX_ARTICLE_FOOTNOTE_TEXT,
  articleFootnotes,
  articleRunsText,
  cleanFootnoteText,
} from './article-footnotes';
import { normaliseRuns, parseArticleBlock, type ArticleBlock } from './article-flow';
import { articleFromMarkdown, articleToMarkdown, articleWordCount } from './article-markdown-io';
import { looksLikeMarkdown, parseInline, parseMarkdownBlocks } from './article-markdown';
import { articleTocEntries } from './article-toc';

// docs/specs/007-editor/article-pages.md "Footnotes" (Work Tracker #219).

const ref = (fn: string) => ({ text: ARTICLE_FOOTNOTE_REF, fn });
const shape = (blocks: readonly ArticleBlock[]) =>
  blocks.map(({ id: _id, ...rest }) => {
    void _id;
    return rest;
  });

describe('a footnote as stored', () => {
  it('keeps its note on its run, plain and one line, cut at the most a note holds', () => {
    expect(cleanFootnoteText('a\nb\tc\r\u2028d')).toBe('a b c  d');
    expect(cleanFootnoteText('x'.repeat(MAX_ARTICLE_FOOTNOTE_TEXT + 5))).toHaveLength(
      MAX_ARTICLE_FOOTNOTE_TEXT,
    );
    // Never half an emoji at the cut.
    const emoji = 'x'.repeat(MAX_ARTICLE_FOOTNOTE_TEXT - 1) + '😀';
    expect(cleanFootnoteText(emoji)).toHaveLength(MAX_ARTICLE_FOOTNOTE_TEXT - 1);
    const block = parseArticleBlock({
      id: 'p',
      type: 'paragraph',
      runs: [{ text: 'See' }, { text: '*', fn: 'One\ntwo', b: true }, { text: '*', fn: 7 }],
    });
    expect(block).toEqual({
      id: 'p',
      type: 'paragraph',
      // A note that is not text is no note: that run is a plain asterisk, and merges with nothing.
      runs: [{ text: 'See' }, { text: '*', b: true, fn: 'One two' }, { text: '*' }],
    });
  });

  it('merges two references to the same note, keeps different ones apart, and counts notes in the budget', () => {
    expect(normaliseRuns([ref('a'), ref('a'), ref('b'), { text: 'x' }])).toEqual([
      { text: '**', fn: 'a' },
      { text: '*', fn: 'b' },
      { text: 'x' },
    ]);
    // An empty note is still a note.
    expect(normaliseRuns([ref('')])).toEqual([{ text: '*', fn: '' }]);
    expect(normaliseRuns([ref('x'.repeat(10)), { text: 'abcdef' }], 14)).toEqual([
      { text: '*', fn: 'x'.repeat(10) },
      { text: 'abc' },
    ]);
  });

  it('numbers every reference through the article, a table cell by cell, and reads text without them', () => {
    const blocks: ArticleBlock[] = [
      { id: 'a', type: 'paragraph', style: 'h1', runs: [{ text: 'Results' }, ref('First')] },
      {
        id: 't',
        type: 'table',
        header: true,
        cols: [{ w: 0.5 }, { w: 0.5 }],
        rows: [
          { id: 'r1', cells: [[ref('Second')], [{ text: 'b' }]] },
          { id: 'r2', cells: [[{ text: 'c' }], [{ text: '**', fn: 'Third' }]] },
        ],
      } as ArticleBlock,
      { id: 'z', type: 'divider' },
    ];
    expect(articleFootnotes(blocks)).toEqual([
      { n: 1, text: 'First' },
      { n: 2, text: 'Second' },
      { n: 3, text: 'Third' },
      { n: 4, text: 'Third' },
    ]);
    expect(articleRunsText([{ text: 'Results' }, ref('First'), { text: ' now' }])).toBe(
      'Results now',
    );
    // A contents entry never shows a reference.
    expect(articleTocEntries(blocks)).toEqual([{ id: 'a', level: 1, text: 'Results' }]);
  });
});

describe('footnotes in Markdown', () => {
  const flow = {
    blocks: [
      { id: 't', type: 'paragraph', style: 'title', runs: [{ text: 'Report' }, ref('Title note')] },
      {
        id: 'p',
        type: 'paragraph',
        runs: [{ text: 'Sales rose' }, ref('Q3 figures, *unaudited*.'), { text: ' again.' }],
      },
      { id: 'l', type: 'list', list: 'bullet', runs: [{ text: 'An item' }, ref('On a list')] },
      {
        id: 'tb',
        type: 'table',
        header: false,
        cols: [{ w: 1 }],
        rows: [{ id: 'r', cells: [[{ text: 'Cell' }, ref('In a cell')]] }],
      },
    ] as ArticleBlock[],
  };

  it('writes each reference as its number and the notes after the last block', () => {
    expect(articleToMarkdown(flow)).toBe(
      [
        '---',
        'title: Report',
        '---',
        '',
        'Sales rose[^1] again.',
        '',
        '- An item[^2]',
        '',
        '|  |',
        '| --- |',
        '| Cell[^3] |',
        '',
        '[^1]: Q3 figures, \\*unaudited\\*.',
        '[^2]: On a list',
        '[^3]: In a cell',
        '',
      ].join('\n'),
    );
  });

  it('reads them back as footnotes, numbered by the article whatever the labels', () => {
    const back = articleFromMarkdown(articleToMarkdown(flow));
    if (!('blocks' in back)) throw new Error('not read');
    expect(shape(back.blocks).slice(1, 3)).toEqual(shape(flow.blocks).slice(1, 3));
    const table = back.blocks[3]!;
    expect(table.type === 'table' && table.rows[0]!.cells[0]).toEqual([
      { text: 'Cell' },
      ref('In a cell'),
    ]);
    const out = articleFromMarkdown(
      'Here[^note] and [^b] and [^none].\n\n```\n[^b]: code, not a note\n```\n\n[^b]: Bee\n[^note]: First\n[^note]: Ignored',
    );
    expect('blocks' in out && shape(out.blocks)).toEqual([
      {
        type: 'paragraph',
        runs: [
          { text: 'Here' },
          ref('First'),
          { text: ' and ' },
          ref('Bee'),
          // No definition: it stays text.
          { text: ' and [^none].' },
        ],
      },
      { type: 'code', text: '[^b]: code, not a note' },
    ]);
  });

  it('reads pasted Markdown with footnotes, and an escaped reference as text', () => {
    expect(looksLikeMarkdown('Plain text[^1]\n[^1]: a source')).toBe(true);
    expect(shape(parseMarkdownBlocks('A\\[^1\\] b[^1]\n\n[^1]: Note'))).toEqual([
      { type: 'paragraph', runs: [{ text: 'A[^1] b' }, ref('Note')] },
    ]);
    // A reference inside code is code.
    expect(parseInline('`x[^1]`', {}, new Map([['1', 'n']]))).toEqual([
      { text: 'x[^1]', code: true },
    ]);
  });

  it('counts a note’s words, never a reference', () => {
    expect(articleWordCount({ blocks: [flow.blocks[1]!] })).toBe(6);
  });

  it('reads a long run of unclosed references in budget', () => {
    const notes = new Map([['1', 'n']]);
    // Within a block's 20,000 characters, so the reference is kept.
    const text = '[^'.repeat(9_000) + ' [^1] ' + '[^x '.repeat(400) + ']';
    let runs: ReturnType<typeof parseInline> = [];
    const took = cpuMsOf(() => {
      runs = parseInline(text, {}, notes);
    });
    expect(runs.filter((r) => r.fn !== undefined)).toHaveLength(1);
    // Each `]` is looked for once: measured under 20 ms.
    expect(took).toBeLessThan(cpuBudgetMs(250));
  });
});
