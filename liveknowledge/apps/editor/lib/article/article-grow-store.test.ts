import { describe, expect, it } from 'vitest';
import {
  ARTICLE_GROW_SETTLE_TRIES,
  ARTICLE_SETTLE_WINDOW_MS,
  articleGrowFloor,
  clearArticleGrow,
  isArticleGrowPending,
  isArticleSettleClaimed,
  markArticleGrow,
  markArticleSettle,
  noteArticleGrown,
} from './article-grow-store';

describe('article grow marks', () => {
  it('holds a mark until it is cleared', () => {
    expect(isArticleGrowPending('t', 'f')).toBe(false);
    markArticleGrow('t', 'f');
    expect(isArticleGrowPending('t', 'f')).toBe(true);
    clearArticleGrow('t', 'f');
    expect(isArticleGrowPending('t', 'f')).toBe(false);
  });

  it('keeps a grown mark to settle what it added: the first grow sets the floor, a few grows at most', () => {
    noteArticleGrown('t', 'gone', 1);
    expect(isArticleGrowPending('t', 'gone')).toBe(false);
    markArticleGrow('t', 'g');
    expect(articleGrowFloor('t', 'g')).toBeNull();
    noteArticleGrown('t', 'g', 1);
    noteArticleGrown('t', 'g', 3);
    expect(articleGrowFloor('t', 'g')).toBe(1);
    for (let i = 2; i < ARTICLE_GROW_SETTLE_TRIES; i++) noteArticleGrown('t', 'g', 4);
    expect(isArticleGrowPending('t', 'g')).toBe(false);
    expect(articleGrowFloor('t', 'g')).toBeNull();
  });
});

// docs/specs/020-import-export/office-import.md "One undo step": the importer settles what it imported.
describe('article settle claims', () => {
  it('claims an imported article from its first layout for the writer window, then forgets it', () => {
    expect(isArticleSettleClaimed('tab', 'flow', 1_000)).toBe(false);
    markArticleSettle('tab', 'flow');
    // The window starts at the first layout, however long the editor took to mount.
    expect(isArticleSettleClaimed('tab', 'flow', 50_000)).toBe(true);
    expect(isArticleSettleClaimed('tab', 'other', 50_000)).toBe(false);
    expect(isArticleSettleClaimed('tab', 'flow', 50_000 + ARTICLE_SETTLE_WINDOW_MS - 1)).toBe(true);
    expect(isArticleSettleClaimed('tab', 'flow', 50_000 + ARTICLE_SETTLE_WINDOW_MS)).toBe(false);
    expect(isArticleSettleClaimed('tab', 'flow', 50_000 + 1)).toBe(false);
  });
});
