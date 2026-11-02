import { describe, expect, it } from 'vitest';
import {
  ARTICLE_SETTLE_WINDOW_MS,
  clearArticleGrow,
  isArticleGrowPending,
  isArticleSettleClaimed,
  markArticleGrow,
  markArticleSettle,
} from './article-grow-store';

describe('article grow marks', () => {
  it('holds a mark until it is cleared', () => {
    expect(isArticleGrowPending('t', 'f')).toBe(false);
    markArticleGrow('t', 'f');
    expect(isArticleGrowPending('t', 'f')).toBe(true);
    clearArticleGrow('t', 'f');
    expect(isArticleGrowPending('t', 'f')).toBe(false);
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
