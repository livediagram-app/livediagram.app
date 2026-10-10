import { describe, expect, it } from 'vitest';
import { articleLocked, isArticleLocked, lockedArticleFlows } from './article-lock';

// docs/specs/007-editor/illustrate-pages.md "Locking a page": locking any page of an article
// holds the whole article, from any of its pages.
const pages = [
  { id: 'i', kind: 'infographic' },
  { id: 'li', kind: 'infographic', locked: true as const },
  { id: 'a1', kind: 'article', flow: 'a' },
  { id: 'a2', kind: 'article', flow: 'a', locked: true as const },
  { id: 'b1', kind: 'article', flow: 'b' },
];

describe('article locks', () => {
  it('names the articles with a locked page', () => {
    expect([...lockedArticleFlows(pages)]).toEqual(['a']);
    expect(lockedArticleFlows([]).size).toBe(0);
  });

  it('holds every page of a partly locked article, and a locked page of any kind', () => {
    expect(isArticleLocked(pages, 'a1')).toBe(true);
    expect(isArticleLocked(pages, 'a2')).toBe(true);
    expect(isArticleLocked(pages, 'li')).toBe(true);
    expect(isArticleLocked(pages, 'b1')).toBe(false);
    expect(isArticleLocked(pages, 'i')).toBe(false);
    expect(isArticleLocked(pages, 'missing')).toBe(false);
  });

  it('reads a tab as stored', () => {
    const tab = {
      pages: [
        { id: 'a1', orientation: 'portrait', kind: 'article', flow: 'a' },
        { id: 'a2', orientation: 'portrait', kind: 'article', flow: 'a', locked: true },
        { id: 'b1', orientation: 'portrait', kind: 'article', flow: 'b' },
      ],
    };
    expect(articleLocked(tab, 'a')).toBe(true);
    expect(articleLocked(tab, 'b')).toBe(false);
    expect(articleLocked({}, 'a')).toBe(false);
  });
});
