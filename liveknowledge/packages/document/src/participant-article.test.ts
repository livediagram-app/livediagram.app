import { describe, expect, it } from 'vitest';
import type { ArticleBlock, ArticleFlow } from './article-flow';
import { articlesOf } from './article-flow';
import type { Tab } from './index';
import { applyParticipantArticleOps, participantArticlesChange } from './participant-article';
import { participantTabChange } from './participant-content';

// The participant writing rule (docs/specs/013-workspace/share-roles.md "What a Participant changes"): a Participant
// writes in an article, never reshapes it.
const para = (id: string, text: string): ArticleBlock => ({
  id,
  type: 'paragraph',
  runs: [{ text }],
});
const zone: ArticleBlock = { id: 'z1', type: 'zone', zone: 'object', width: 200, height: 100 };

function tabWith(flow: ArticleFlow, extra: Partial<Tab> = {}): Tab {
  return {
    id: 't1',
    name: 'Brief',
    elements: [],
    pages: [{ id: 'p1', kind: 'article', orientation: 'portrait', flow: 'f1' }],
    articles: { f1: flow },
    ...extra,
  };
}

const base: ArticleFlow = { blocks: [para('b1', 'Hello'), zone, { id: 'pb', type: 'pageBreak' }] };

describe('applyParticipantArticleOps', () => {
  it('writes, adds and removes writing blocks', () => {
    const tab = tabWith(base);
    const r = applyParticipantArticleOps(tab, 'f1', [
      { kind: 'put', block: para('b1', 'Hello there') },
      { kind: 'put', block: para('b2', 'More'), after: 'b1', before: 'z1' },
    ]);
    expect(r.result).toBe('applied');
    if (r.result !== 'applied') return;
    expect(r.changed).toBe(true);
    expect(articlesOf(r.tab).f1!.blocks.map((b) => b.id)).toEqual(['b1', 'b2', 'z1', 'pb']);
    const removed = applyParticipantArticleOps(r.tab, 'f1', [{ kind: 'remove', id: 'b2' }]);
    expect(removed).toMatchObject({ result: 'applied', changed: true });
  });

  it('answers unchanged when the writing already says it', () => {
    const r = applyParticipantArticleOps(tabWith(base), 'f1', [
      { kind: 'put', block: para('b1', 'Hello') },
    ]);
    expect(r).toMatchObject({ result: 'applied', changed: false });
  });

  it('refuses the style, a zone, a page break and a block put over one', () => {
    const tab = tabWith(base);
    for (const ops of [
      [{ kind: 'style', style: { look: 'bold' } }],
      [{ kind: 'remove', id: 'z1' }],
      [{ kind: 'remove', id: 'pb' }],
      [{ kind: 'put', block: { ...zone, width: 300 } }],
      [{ kind: 'put', block: { id: 'x', type: 'divider' } }],
      [{ kind: 'put', block: para('z1', 'over a zone') }],
    ] as const) {
      expect(applyParticipantArticleOps(tab, 'f1', ops as never), JSON.stringify(ops)).toEqual({
        result: 'refused',
        reason: 'not-writing',
      });
    }
  });

  it('refuses a missing article, a locked tab and a locked page', () => {
    expect(applyParticipantArticleOps(tabWith(base), 'nope', [])).toEqual({
      result: 'refused',
      reason: 'missing',
    });
    expect(applyParticipantArticleOps(tabWith(base, { locked: true }), 'f1', [])).toEqual({
      result: 'refused',
      reason: 'tab-locked',
    });
    const lockedPage = tabWith(base, {
      pages: [{ id: 'p1', kind: 'article', orientation: 'portrait', flow: 'f1', locked: true }],
    });
    expect(applyParticipantArticleOps(lockedPage, 'f1', [])).toEqual({
      result: 'refused',
      reason: 'locked',
    });
  });
});

describe('participantArticlesChange (the editor side)', () => {
  it('takes writing, and refuses an article added, removed or restyled', () => {
    const before = tabWith(base);
    const written = tabWith({ blocks: [para('b1', 'Hi'), zone, { id: 'pb', type: 'pageBreak' }] });
    expect(participantArticlesChange(before, written)).toBe(true);
    expect(participantTabChange(before, written)).toBe(written);
    expect(participantArticlesChange(before, { ...before, articles: {} })).toBe(false);
    expect(
      participantArticlesChange(before, {
        ...before,
        articles: { f1: base, f2: base },
      }),
    ).toBe(false);
    expect(participantArticlesChange(before, tabWith({ ...base, style: { look: 'bold' } }))).toBe(
      false,
    );
  });

  it('refuses writing that also changes the pages around it', () => {
    const before = tabWith(base);
    const grown = tabWith(
      { blocks: [para('b1', 'Hi'), zone, { id: 'pb', type: 'pageBreak' }] },
      {
        pages: [
          { id: 'p1', kind: 'article', orientation: 'portrait', flow: 'f1' },
          { id: 'p2', kind: 'article', orientation: 'portrait', flow: 'f1' },
        ],
      },
    );
    expect(participantTabChange(before, grown)).toBeNull();
  });
});
