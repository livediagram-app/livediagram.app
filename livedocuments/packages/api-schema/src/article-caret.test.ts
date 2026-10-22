import { describe, expect, it } from 'vitest';
import { ARTICLE_CARET_MAX_ID_LEN, isPresenceOpKind, parseArticleCaret } from './index';

// docs/specs/007-editor/article-pages.md "Collaboration": a writer's caret travels as presence,
// as a block id and a character offset, validated before anyone draws it.

describe('article-caret on the wire', () => {
  it('is presence: unordered, never logged or replayed', () => {
    expect(isPresenceOpKind('article-caret')).toBe(true);
  });

  it('keeps a caret in a block', () => {
    expect(
      parseArticleCaret({ kind: 'article-caret', tabId: 't', flow: 'f', blockId: 'b2', offset: 4 }),
    ).toEqual({ tabId: 't', flow: 'f', blockId: 'b2', offset: 4 });
  });

  it('keeps a caret that left the writing', () => {
    expect(parseArticleCaret({ kind: 'article-caret', tabId: 't', flow: null })).toEqual({
      tabId: 't',
      flow: null,
    });
  });

  it.each([
    null,
    'x',
    { flow: null },
    { tabId: 't', flow: 'f', offset: 1 },
    { tabId: 't', flow: 'f', blockId: 'b', offset: -1 },
    { tabId: 't', flow: 'f', blockId: 'b', offset: 1.5 },
    { tabId: 't', flow: 'f', blockId: 'b', offset: Number.NaN },
    { tabId: 't', flow: 'f', blockId: 'b', offset: '3' },
    { tabId: 't', flow: 'f', blockId: '', offset: 0 },
    { tabId: 't', flow: 'f', blockId: 'x'.repeat(ARTICLE_CARET_MAX_ID_LEN + 1), offset: 0 },
    { tabId: 7, flow: null },
  ])('refuses a malformed caret %#', (op) => {
    expect(parseArticleCaret(op)).toBeNull();
  });
});
