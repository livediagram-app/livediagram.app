import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorState } from 'prosemirror-state';
import { blocksToDoc } from './article-convert';
import { articleSchema } from './article-schema';
import { blockIdsPlugin } from './article-plugins';
import {
  describeSuggestion,
  docHasSuggestions,
  formatChangeNames,
  suggestionAgo,
} from './article-suggest-describe';
import {
  announceSuggestRefused,
  announceSuggested,
  onSuggested,
  onSuggestionReview,
  requestSuggestionReview,
  resetSuggestState,
  sayToReviewer,
  setSuggestAuthor,
  setSuggestMode,
  setSuggestOnly,
  setSuggestToast,
  suggestAuthorKey,
  suggestAuthorNow,
  suggestOnlyNow,
  suggestingNow,
  takeSuggestionReview,
  SUGGEST_ONLY_REFUSED_NOTICE,
  SUGGEST_REFUSED_NOTICE,
} from './article-suggest-store';
import { breakDecorations, suggestBreaksPlugin, withinTextblocks } from './article-suggest-plugin';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';

// A suggestion's card copy, the suggest store and the ¶ widget (docs/specs/007-editor/suggestions.md).
afterEach(() => {
  resetSuggestState();
  setSuggestToast(null);
});

describe('describeSuggestion', () => {
  it('says what each kind does, quoting text cut to 60 characters', () => {
    expect(describeSuggestion({ k: 'ins', text: 'a quick  test', isBreak: false })).toBe(
      'Add “a quick test”',
    );
    expect(describeSuggestion({ k: 'del', text: 'x'.repeat(80), isBreak: false })).toBe(
      `Delete “${'x'.repeat(59)}…”`,
    );
    expect(describeSuggestion({ k: 'ins', isBreak: true })).toBe('Add a paragraph break');
    expect(describeSuggestion({ k: 'del', isBreak: true })).toBe('Remove a paragraph break');
    expect(
      describeSuggestion({ k: 'fmt', was: {}, now: { b: true, i: true }, isBreak: false }),
    ).toBe('Format: Bold, Italic');
    expect(describeSuggestion({ k: 'fmt', was: {}, now: {}, isBreak: false })).toBe('Format');
    expect(formatChangeNames({ href: 'a' }, { href: 'b', hl: '#fff000' })).toEqual([
      'Link',
      'Highlight',
    ]);
  });

  it('says how long ago: just now, minutes, hours, then the date', () => {
    const now = Date.UTC(2026, 10, 16, 12);
    expect(suggestionAgo(now - 5_000, now)).toBe('just now');
    expect(suggestionAgo(now - 4 * 60_000, now)).toBe('4 min ago');
    expect(suggestionAgo(now - 3 * 3_600_000, now)).toBe('3 h ago');
    expect(suggestionAgo(Date.UTC(2026, 10, 2, 12), now, 'en-GB')).toBe('2 Nov');
    expect(suggestionAgo(now + 9_000, now)).toBe('just now');
  });
});

describe('the suggest store', () => {
  it('suggests in Suggesting mode or on Suggest Only, as the session’s author', () => {
    setSuggestAuthor({ by: 'k1', n: 'Sam', c: '#ff0000' });
    setSuggestAuthor({ by: 'k1', n: 'Sam', c: '#ff0000' });
    expect(suggestAuthorKey()).toBe('k1');
    expect(suggestingNow()).toBe(false);
    expect(suggestAuthorNow()).toBeNull();
    setSuggestMode('suggesting');
    expect(suggestAuthorNow()).toEqual({ by: 'k1', n: 'Sam', c: '#ff0000' });
    setSuggestMode('editing');
    setSuggestOnly(true);
    expect(suggestOnlyNow()).toBe(true);
    expect(suggestingNow()).toBe(true);
    setSuggestAuthor(null);
    expect(suggestAuthorNow()).toBeNull();
  });

  it('says a refusal once in a while, in the words for the session', () => {
    const said: string[] = [];
    setSuggestToast((m) => said.push(m));
    announceSuggestRefused(10_000);
    announceSuggestRefused(10_100);
    setSuggestOnly(true);
    announceSuggestRefused(20_000);
    sayToReviewer('2 wait');
    expect(said).toEqual([SUGGEST_REFUSED_NOTICE, SUGGEST_ONLY_REFUSED_NOTICE, '2 wait']);
  });

  it('hands on an assistant’s suggestions and keeps a review request until its article takes it', () => {
    const seen = vi.fn();
    const off = onSuggested(seen);
    announceSuggested({ tabId: 't', flow: 'f', n: 'Claude', count: 3, g: 'cs-1' });
    off();
    announceSuggested({ tabId: 't', flow: 'f', n: 'Claude', count: 1, g: 'cs-2' });
    expect(seen).toHaveBeenCalledTimes(1);
    const heard = vi.fn();
    const offReview = onSuggestionReview(heard);
    requestSuggestionReview('f', 'cs-1');
    offReview();
    expect(heard).toHaveBeenCalledWith({ flow: 'f', g: 'cs-1' });
    expect(takeSuggestionReview('other')).toBeNull();
    expect(takeSuggestionReview('f')).toEqual({ flow: 'f', g: 'cs-1' });
    expect(takeSuggestionReview('f')).toBeNull();
  });
});

describe('the ¶ of a suggested break', () => {
  it('draws one widget per break, and finds suggestions in the writing', () => {
    const plain = blocksToDoc([{ id: 'a', type: 'paragraph', runs: [{ text: 'x' }] }]);
    expect(breakDecorations(plain).find()).toHaveLength(0);
    expect(docHasSuggestions(plain)).toBe(false);
    const sg = { id: 's1', k: 'del', by: 'k', n: 'Sam', c: '#ff0000', at: 1 };
    const doc = blocksToDoc([
      { id: 'a', type: 'paragraph', runs: [{ text: 'x' }] },
      { id: 'b', type: 'paragraph', runs: [{ text: 'y' }], sg } as never,
    ]);
    expect(breakDecorations(doc).find()).toHaveLength(1);
    expect(docHasSuggestions(doc)).toBe(true);
  });

  it('keeps a break suggestion on the first half when a paragraph is split', () => {
    const sg = { id: 's1', k: 'ins', by: 'k', n: 'Sam', at: 1 };
    const state = EditorState.create({
      schema: articleSchema,
      doc: blocksToDoc([
        { id: 'a', type: 'paragraph', runs: [{ text: 'one' }] },
        { id: 'b', type: 'paragraph', runs: [{ text: 'two' }], sg } as never,
      ]),
      plugins: [blockIdsPlugin],
    });
    const next = state.apply(state.tr.split(7));
    const sgs: unknown[] = [];
    next.doc.forEach((n) => sgs.push(n.attrs.sg));
    expect(sgs.filter(Boolean)).toHaveLength(1);
    expect(next.doc.child(1).attrs.sg).toMatchObject({ id: 's1' });
  });

  it('maps the pilcrows while typing inside a paragraph, and redraws them when blocks change', () => {
    const sg = { id: 's1', k: 'ins', by: 'k', n: 'Sam', at: 1 };
    const blocks = Array.from({ length: 2000 }, (_, i) => ({
      id: `b${i}`,
      type: 'paragraph' as const,
      runs: [{ text: 'The quick brown fox jumps over the lazy dog.' }],
      ...(i % 10 === 0 ? { sg: { ...sg, id: `s${i}` } } : {}),
    }));
    const state = EditorState.create({
      schema: articleSchema,
      doc: blocksToDoc(blocks as never),
      plugins: [blockIdsPlugin, suggestBreaksPlugin],
    });
    const typing = state.tr.insertText('x', 5);
    expect(withinTextblocks(typing)).toBe(true);
    expect(withinTextblocks(state.tr.split(5))).toBe(false);
    expect(withinTextblocks(state.tr.setNodeAttribute(0, 'sg', null))).toBe(false);
    expect(withinTextblocks(state.tr.addMark(1, 4, articleSchema.marks.bold.create()))).toBe(true);
    // 100 keystrokes well under 50 ms of CPU: each maps the pilcrows, never walks the article.
    expect(
      cpuMsOf(() => {
        for (let i = 0; i < 100; i++) state.apply(state.tr.insertText('x', 5));
      }),
    ).toBeLessThan(cpuBudgetMs(50));
    const split = state.apply(state.tr.split(5));
    expect(suggestBreaksPlugin.getState(split)?.find()).toHaveLength(200);
  });
});
