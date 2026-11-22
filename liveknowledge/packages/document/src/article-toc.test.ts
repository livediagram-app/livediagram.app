import { describe, expect, it } from 'vitest';
import type { ArticleBlock } from './article-flow';
import { articleTocEntries, tocDepthOf } from './article-toc';

// docs/specs/007-editor/article-pages.md "Table of contents".
const p = (id: string, text: string, style?: string): ArticleBlock =>
  ({ id, type: 'paragraph', ...(style ? { style } : {}), runs: [{ text }] }) as ArticleBlock;

describe('a contents block’s entries', () => {
  const blocks: ArticleBlock[] = [
    p('t', 'Report', 'title'),
    p('s', 'Sub', 'subtitle'),
    p('a', ' Intro\n  part ', 'h1'),
    p('b', 'Body'),
    p('c', 'Details', 'h2'),
    p('d', 'Fine', 'h3'),
    p('e', '   ', 'h2'),
    { id: 'x', type: 'divider' },
    { id: 'q', type: 'paragraph', style: 'h1', runs: [] },
    { id: 'r', type: 'paragraph', style: 'h2' } as unknown as ArticleBlock,
  ];

  it('lists headings 1 to 3 in order, text plain, empty ones and the title left out', () => {
    expect(articleTocEntries(blocks)).toEqual([
      { id: 'a', level: 1, text: 'Intro part' },
      { id: 'c', level: 2, text: 'Details' },
      { id: 'd', level: 3, text: 'Fine' },
    ]);
  });

  it('lists only the levels its depth chooses', () => {
    expect(articleTocEntries(blocks, 1).map((e) => e.id)).toEqual(['a']);
    expect(articleTocEntries(blocks, 2).map((e) => e.id)).toEqual(['a', 'c']);
  });

  it('reads an absent or unknown depth as 3', () => {
    expect(tocDepthOf({})).toBe(3);
    expect(tocDepthOf({ depth: 7 })).toBe(3);
    expect(tocDepthOf({ depth: 1 })).toBe(1);
    expect(tocDepthOf({ depth: 2 })).toBe(2);
  });
});
