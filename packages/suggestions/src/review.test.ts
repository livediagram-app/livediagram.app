import { describe, expect, it } from 'vitest';
import {
  NO_REVIEW,
  parseReviewSettings,
  parseStoredReview,
  reviewFromSettings,
  suggestOnlyFor,
  SUGGEST_ONLY_MAX_LINKS,
  SUGGEST_ONLY_MAX_PEOPLE,
  withReviewPinned,
  withReviewSeen,
} from './review';

// Review settings (docs/specs/007-editor/suggestions.md "Suggest Only"): parsed and bounded wherever they come from.
describe('review settings', () => {
  it('reads what an Editor sent, dropping what is not a key and repeats', () => {
    expect(
      parseReviewSettings({
        links: ['a', 'a', '', 3, 'x'.repeat(65), 'b'],
        people: [
          { key: 'k1', name: '  Sam  ' },
          { key: 'k1', name: 'Again' },
          { key: '' },
          null,
          { key: 'k2' },
        ],
        agents: true,
      }),
    ).toEqual({
      links: ['a', 'b'],
      people: [
        { key: 'k1', name: 'Sam' },
        { key: 'k2', name: '' },
      ],
      agents: true,
    });
    expect(parseReviewSettings(null)).toEqual({ links: [], people: [], agents: false });
    expect(parseReviewSettings({ links: 'a', people: 'b', agents: 'yes' })).toEqual({
      links: [],
      people: [],
      agents: false,
    });
  });

  it('bounds the lists', () => {
    const links = Array.from({ length: SUGGEST_ONLY_MAX_LINKS + 5 }, (_, i) => `l${i}`);
    const people = Array.from({ length: SUGGEST_ONLY_MAX_PEOPLE + 5 }, (_, i) => ({
      key: `k${i}`,
    }));
    const out = parseReviewSettings({ links, people });
    expect(out.links).toHaveLength(SUGGEST_ONLY_MAX_LINKS);
    expect(out.people).toHaveLength(SUGGEST_ONLY_MAX_PEOPLE);
  });

  it('reads a stored row, or none', () => {
    expect(parseStoredReview(null)).toBe(NO_REVIEW);
    expect(parseStoredReview('{oops')).toBe(NO_REVIEW);
    expect(
      parseStoredReview(
        JSON.stringify({
          links: ['a'],
          agents: true,
          seen: [
            { key: 'k', name: 'Sam', at: 5 },
            { key: 'j', at: 'x' },
          ],
        }),
      ),
    ).toEqual({
      links: ['a'],
      people: [],
      agents: true,
      seen: [
        { key: 'k', name: 'Sam', at: 5 },
        { key: 'j', name: '', at: 0 },
      ],
      pins: [],
    });
    expect(
      parseStoredReview(
        JSON.stringify({
          links: ['a'],
          lift: ['k'],
          pins: [
            { key: 'k', code: 'a', at: 2 },
            { key: 'k', code: 'b', at: 3 },
            { key: 'j', code: 'a', at: 'x' },
            { key: 'i' },
          ],
        }),
      ),
    ).toEqual({
      links: ['a'],
      people: [],
      agents: false,
      seen: [],
      pins: [
        { key: 'k', code: 'a', at: 2 },
        { key: 'j', code: 'a', at: 0 },
      ],
    });
    expect(parseStoredReview('null').seen).toEqual([]);
  });

  it('notes who joined, most recent first, once per name', () => {
    const once = withReviewSeen(NO_REVIEW, { key: 'k', name: 'Sam' }, 1);
    expect(once.seen).toEqual([{ key: 'k', name: 'Sam', at: 1 }]);
    expect(withReviewSeen(once, { key: 'k', name: 'Sam' }, 2)).toBe(once);
    const renamed = withReviewSeen(
      withReviewSeen(once, { key: 'j', name: 'Kim' }, 3),
      { key: 'k', name: 'Sam L' },
      4,
    );
    expect(renamed.seen.map((s) => s.name)).toEqual(['Sam L', 'Kim']);
    expect(withReviewSeen(once, { key: '', name: 'x' }, 5)).toBe(once);
  });

  it('says whether a session suggests, by its link or its person', () => {
    const review = { links: ['code1'], people: [{ key: 'key1', name: 'Sam' }], agents: false };
    expect(suggestOnlyFor(review, { shareCode: 'code1' })).toBe(true);
    expect(suggestOnlyFor(review, { shareCode: 'code2', collabKey: 'key1' })).toBe(true);
    expect(suggestOnlyFor(review, { shareCode: 'code2', collabKey: 'key2' })).toBe(false);
    expect(suggestOnlyFor(review, {})).toBe(false);
  });

  // A signed-in person or a guest's browser who came through a Suggest Only link once stays on it, whatever link (or
  // none) they open with later: the share code is the client's to send or leave out.
  it('pins a person to the Suggest Only link they came through, until the link or the person is lifted', () => {
    const base = { ...NO_REVIEW, links: ['code1'] };
    const pinned = withReviewPinned(base, 'key1', 'code1', 7);
    expect(pinned.pins).toEqual([{ key: 'key1', code: 'code1', at: 7 }]);
    expect(withReviewPinned(pinned, 'key1', 'code1', 8)).toBe(pinned);
    // Only a link on Suggest Only pins.
    expect(withReviewPinned(base, 'key1', 'code9', 8)).toBe(base);
    expect(withReviewPinned(base, '', 'code1', 8)).toBe(base);
    // Reopened without the code: still suggesting, by the verified key alone.
    expect(suggestOnlyFor(pinned, { shareCode: null, verifiedKey: 'key1' })).toBe(true);
    expect(suggestOnlyFor(pinned, { shareCode: null, collabKey: 'key1' })).toBe(false);
    expect(suggestOnlyFor(pinned, { verifiedKey: 'key2' })).toBe(false);
    // The Editor lifting the person, or the link, frees them.
    const lifted = reviewFromSettings(pinned, {
      links: ['code1'],
      people: [],
      agents: false,
      lift: ['key1'],
    });
    expect(lifted.pins).toEqual([]);
    expect(suggestOnlyFor(lifted, { verifiedKey: 'key1' })).toBe(false);
    const linkOff = reviewFromSettings(pinned, { links: [], people: [], agents: false });
    expect(linkOff.pins).toEqual([]);
    const kept = reviewFromSettings(pinned, { links: ['code1'], people: [], agents: true });
    expect(kept).toEqual({ ...pinned, agents: true });
    expect('lift' in kept).toBe(false);
    // A stale pin (its link off) suggests nothing even before it is cleared.
    expect(suggestOnlyFor({ ...pinned, links: [] }, { verifiedKey: 'key1' })).toBe(false);
    expect(parseReviewSettings({ links: [], lift: ['k', 'k', 3] }).lift).toEqual(['k']);
  });
});

describe('review pins, bounded', () => {
  it('moves a person to the link they came through last, and keeps at most the cap', () => {
    const base = { ...NO_REVIEW, links: ['code1', 'code2'] };
    const first = withReviewPinned(base, 'key1', 'code1', 1);
    const moved = withReviewPinned(withReviewPinned(first, 'key2', 'code1', 2), 'key1', 'code2', 3);
    expect(moved.pins.map((p) => [p.key, p.code])).toEqual([
      ['key1', 'code2'],
      ['key2', 'code1'],
    ]);
    const many = Array.from({ length: SUGGEST_ONLY_MAX_PEOPLE + 5 }, (_, i) => ({
      key: `k${i}`,
      code: 'code1',
      at: i,
    }));
    expect(parseStoredReview(JSON.stringify({ links: ['code1'], pins: many })).pins).toHaveLength(
      SUGGEST_ONLY_MAX_PEOPLE,
    );
  });
});
