import { describe, expect, it } from 'vitest';
import {
  NO_REVIEW,
  parseReviewSettings,
  parseStoredReview,
  suggestOnlyFor,
  SUGGEST_ONLY_MAX_LINKS,
  SUGGEST_ONLY_MAX_PEOPLE,
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
});
