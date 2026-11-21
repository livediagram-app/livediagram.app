import { describe, expect, it } from 'vitest';
import type { ArticleBlock } from '@liveknowledge/document';
import { WORDS_PER_MINUTE, pageWords, readingMinutes } from './reading-time';

const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ');

describe('pageWords', () => {
  it('counts text, lists, table cells and code, and nothing in zones or dividers', () => {
    const blocks: ArticleBlock[] = [
      { id: 'a', type: 'paragraph', style: 'h1', runs: [{ text: 'How we ship' }] },
      { id: 'b', type: 'paragraph', runs: [{ text: 'Every change ' }, { text: 'goes  out.' }] },
      { id: 'c', type: 'list', list: 'bullet', runs: [{ text: 'Flag first' }] },
      { id: 'd', type: 'code', text: 'git push origin main' },
      {
        id: 'e',
        type: 'table',
        cols: [],
        rows: [{ id: 'r', cells: [[{ text: 'One two' }], []] }],
      } as unknown as ArticleBlock,
      { id: 'f', type: 'divider' },
    ];
    expect(pageWords(blocks)).toBe(3 + 4 + 2 + 4 + 2);
  });

  it('keeps its answer per block list', () => {
    const blocks: ArticleBlock[] = [{ id: 'a', type: 'paragraph', runs: [{ text: 'one two' }] }];
    expect(pageWords(blocks)).toBe(2);
    expect(pageWords(blocks)).toBe(2);
  });
});

describe('readingMinutes', () => {
  it('is nothing for an empty page and at least a minute for any writing', () => {
    expect(readingMinutes(0)).toBe(0);
    expect(readingMinutes(1)).toBe(1);
    expect(readingMinutes(WORDS_PER_MINUTE * 4)).toBe(4);
    expect(readingMinutes(WORDS_PER_MINUTE * 4 + WORDS_PER_MINUTE / 2 + 1)).toBe(5);
  });

  it('reads a 100,000-word page quickly', () => {
    const blocks: ArticleBlock[] = Array.from({ length: 2000 }, (_, i) => ({
      id: `b${i}`,
      type: 'paragraph' as const,
      runs: [{ text: words(50) }],
    }));
    const start = performance.now();
    expect(pageWords(blocks)).toBe(100_000);
    expect(performance.now() - start).toBeLessThan(200);
  });
});
