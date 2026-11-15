import { describe, expect, it } from 'vitest';
import {
  ARTICLE_HOLD_EXPIRE_MS,
  ARTICLE_HOLD_IDLE_MS,
  ARTICLE_HOLD_REFRESH_MS,
  isMutationOpKind,
  isPresenceOpKind,
  parseArticleHold,
  sameHoldPlace,
} from './index';

// docs/specs/007-editor/article-pages.md "Holding a paragraph": a hold travels as presence the room arbitrates,
// read field by field before anything holds by it.

describe('article-hold on the wire', () => {
  it('is presence: never logged, ordered or replayed', () => {
    expect(isPresenceOpKind('article-hold')).toBe(true);
    expect(isMutationOpKind('article-hold')).toBe(false);
  });

  it('keeps a paragraph hold, and only its own fields', () => {
    expect(
      parseArticleHold({ kind: 'article-hold', tabId: 't', flow: 'f', blockId: 'b', extra: 1 }),
    ).toEqual({ tabId: 't', flow: 'f', blockId: 'b' });
  });

  it('keeps a cell hold with its row and column', () => {
    expect(
      parseArticleHold({ kind: 'article-hold', tabId: 't', flow: 'f', blockId: 'b', row: 'r', col: 'c' }),
    ).toEqual({ tabId: 't', flow: 'f', blockId: 'b', row: 'r', col: 'c' });
  });

  it('keeps a release', () => {
    expect(parseArticleHold({ kind: 'article-hold', tabId: 't', flow: null })).toEqual({
      tabId: 't',
      flow: null,
    });
  });

  it('refuses what no editor sends', () => {
    expect(parseArticleHold(null)).toBeNull();
    expect(parseArticleHold('hold')).toBeNull();
    expect(parseArticleHold({ flow: 'f', blockId: 'b' })).toBeNull();
    expect(parseArticleHold({ tabId: '', flow: 'f', blockId: 'b' })).toBeNull();
    expect(parseArticleHold({ tabId: 'x'.repeat(129), flow: 'f', blockId: 'b' })).toBeNull();
    expect(parseArticleHold({ tabId: 't', flow: 'f' })).toBeNull();
    expect(parseArticleHold({ tabId: 't', flow: 7, blockId: 'b' })).toBeNull();
    expect(parseArticleHold({ tabId: 't', flow: 'f', blockId: 'b'.repeat(65) })).toBeNull();
    // A row without its column, or the other way round, is no cell.
    expect(parseArticleHold({ tabId: 't', flow: 'f', blockId: 'b', row: 'r' })).toBeNull();
    expect(parseArticleHold({ tabId: 't', flow: 'f', blockId: 'b', col: 'c' })).toBeNull();
    expect(parseArticleHold({ tabId: 't', flow: 'f', blockId: 'b', row: '', col: 'c' })).toBeNull();
  });

  it('tells one place from another', () => {
    const p = { flow: 'f', blockId: 'b' };
    expect(sameHoldPlace(p, { flow: 'f', blockId: 'b' })).toBe(true);
    expect(sameHoldPlace(p, { flow: 'g', blockId: 'b' })).toBe(false);
    expect(sameHoldPlace(p, { flow: 'f', blockId: 'c' })).toBe(false);
    expect(sameHoldPlace(p, { flow: 'f', blockId: 'b', row: 'r', col: 'c' })).toBe(false);
    expect(
      sameHoldPlace(
        { flow: 'f', blockId: 'b', row: 'r', col: 'c' },
        { flow: 'f', blockId: 'b', row: 'r', col: 'd' },
      ),
    ).toBe(false);
  });

  it('expires only after the idle time and a refresh have both passed', () => {
    expect(ARTICLE_HOLD_IDLE_MS).toBe(8_000);
    expect(ARTICLE_HOLD_EXPIRE_MS).toBeGreaterThan(ARTICLE_HOLD_IDLE_MS + ARTICLE_HOLD_REFRESH_MS);
  });
});
