import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { articlesOf } from './article-flow';
import { pagesOf } from './page';

// docs/specs/007-editor/blueprints/flashcards.md "Performance and limits" (Work Tracker 728): a typing commit on a
// 100-card stack changes one card's writing and no page, and the editor reads the tab's pages and writing on every
// render and every keystroke's checks. Each is read once per stored object, so a commit reads one card again.

function stack(n: number) {
  const pages = [];
  const articles: Record<string, unknown> = {};
  for (let i = 0; i < n; i++) {
    pages.push({
      id: `c${i}`,
      orientation: 'landscape',
      size: 'card',
      kind: 'flashcard',
      flow: `f${i}`,
    });
    articles[`f${i}`] = {
      blocks: [
        { id: `t${i}`, type: 'paragraph', style: 'title', runs: [{ text: `Card ${i}` }] },
        { id: `p${i}`, type: 'paragraph', runs: [{ text: `What card ${i} says.` }] },
      ],
      style: { margins: 'narrow' },
    };
  }
  return { pages, articles };
}

describe('the pages read from a tab', () => {
  it('are the same frozen pages for the same stored array, and read again for a new one', () => {
    const tab = stack(3);
    const once = pagesOf(tab);
    expect(pagesOf({ ...tab })).toBe(once);
    expect(Object.isFrozen(once)).toBe(true);
    expect(Object.isFrozen(once[0])).toBe(true);
    expect(() => (once as unknown[]).push({})).toThrow();
    const moved = pagesOf({ pages: [...tab.pages].reverse() });
    expect(moved).not.toBe(once);
    expect(moved.map((p) => p.id)).toEqual(['c2', 'c1', 'c0']);
  });

  it('never cache the starting page of a tab with none stored', () => {
    expect(pagesOf({ pages: [] })).not.toBe(pagesOf({ pages: [] }));
    expect(pagesOf({ pageOrientation: 'landscape' })[0]!.orientation).toBe('landscape');
  });

  it('cost nothing to read again: 1,000 reads of a 100-card stack', () => {
    const tab = stack(100);
    pagesOf(tab);
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 1000; i++) pagesOf(tab);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(20));
  });
});

describe('the writing read from a tab', () => {
  it('keeps every unchanged article as read when one article changes', () => {
    const tab = stack(100);
    const before = articlesOf(tab);
    const typed = {
      ...tab,
      articles: {
        ...tab.articles,
        f0: { blocks: [{ id: 'p0', type: 'paragraph', runs: [{ text: 'New' }] }] },
      },
    };
    const after = articlesOf(typed);
    expect(after).not.toBe(before);
    expect(after.f1).toBe(before.f1);
    expect(after.f99).toBe(before.f99);
    expect(after.f0).not.toBe(before.f0);
    expect(after.f0!.blocks[0]).toMatchObject({ runs: [{ text: 'New' }] });
  });

  it('names an empty article by its own flow, even when two flows share a stored object', () => {
    const empty = { blocks: [] };
    const read = articlesOf({ articles: { a: empty, b: empty } });
    expect(read.a!.blocks[0]!.id).toBe('a-b0');
    expect(read.b!.blocks[0]!.id).toBe('b-b0');
    // A stored article that is not an object reads as an empty one.
    expect(articlesOf({ articles: { c: 'x' } }).c!.blocks[0]!.id).toBe('c-b0');
  });

  it('reads one card again per commit on a 100-card stack', () => {
    const tab = stack(100);
    articlesOf(tab);
    let articles = tab.articles;
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 200; i++) {
        articles = {
          ...articles,
          f0: { blocks: [{ id: 'p0', type: 'paragraph', runs: [{ text: `${i}` }] }] },
        };
        articlesOf({ articles });
      }
    });
    expect(ms).toBeLessThan(cpuBudgetMs(60));
  });
});
