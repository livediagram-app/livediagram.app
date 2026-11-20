import { describe, expect, it } from 'vitest';
import {
  DEFAULT_KNOWLEDGE_SETTINGS,
  DEFAULT_REVIEW_EVERY,
  isReviewEvery,
  parseKnowledgeSettings,
  storedKnowledgeSettings,
} from './knowledge-settings';

describe("a knowledgebase's settings", () => {
  it('reviews every 90 days unless it says otherwise', () => {
    expect(DEFAULT_REVIEW_EVERY).toBe(90);
    expect(DEFAULT_KNOWLEDGE_SETTINGS).toEqual({ reviewEvery: 90 });
    for (const stored of [undefined, null, 7, 'nonsense', '{', '[]', {}, { reviewEvery: 45 }])
      expect(parseKnowledgeSettings(stored)).toEqual({ reviewEvery: 90 });
  });

  it('keeps a period it knows, from an object or the JSON a column holds', () => {
    expect(parseKnowledgeSettings({ reviewEvery: 30, extra: 1 })).toEqual({ reviewEvery: 30 });
    expect(parseKnowledgeSettings('{"reviewEvery":"never"}')).toEqual({ reviewEvery: 'never' });
    expect(parseKnowledgeSettings('{"reviewEvery":365}')).toEqual({ reviewEvery: 365 });
    expect([30, 90, 180, 365, 'never'].every(isReviewEvery)).toBe(true);
    expect([0, 45, '90', null, undefined].some(isReviewEvery)).toBe(false);
  });

  it('stores nothing for the default, and reads back what it stored', () => {
    expect(storedKnowledgeSettings({ reviewEvery: 90 })).toBeNull();
    for (const reviewEvery of [30, 180, 365, 'never'] as const)
      expect(parseKnowledgeSettings(storedKnowledgeSettings({ reviewEvery }))).toEqual({
        reviewEvery,
      });
  });
});
