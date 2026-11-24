import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AI_EDITING,
  aiEditUnverifies,
  aiEditingOf,
  aiWriteReach,
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

  it('keeps the labels beside the period, stored when there are any', () => {
    const labels = [{ id: 'lbl_a', name: 'Engineering', colour: 'blue' }];
    expect(parseKnowledgeSettings({ reviewEvery: 90, labels })).toEqual({
      reviewEvery: 90,
      labels,
    });
    expect(parseKnowledgeSettings({ reviewEvery: 90, labels: [] })).toEqual({ reviewEvery: 90 });
    const stored = storedKnowledgeSettings({ reviewEvery: 90, labels });
    expect(stored).not.toBeNull();
    expect(parseKnowledgeSettings(stored)).toEqual({ reviewEvery: 90, labels });
    expect(storedKnowledgeSettings({ reviewEvery: 30, labels: [] })).toBe('{"reviewEvery":30}');
  });
});

// AI Editing (docs/specs/030-knowledgebase/ai-editing.md).
describe('AI Editing', () => {
  it('is Suggest Edits Only until an Editor chooses, and stores nothing for it', () => {
    expect(DEFAULT_AI_EDITING).toBe('suggest');
    expect(aiEditingOf(parseKnowledgeSettings(null))).toBe('suggest');
    for (const aiEditing of ['write', 'Any', 3, null])
      expect(parseKnowledgeSettings({ reviewEvery: 30, aiEditing })).toEqual({ reviewEvery: 30 });
    expect(parseKnowledgeSettings({ reviewEvery: 30, aiEditing: 'suggest' })).toEqual({
      reviewEvery: 30,
    });
    expect(storedKnowledgeSettings({ reviewEvery: 90, aiEditing: 'suggest' })).toBeNull();
  });

  it('round-trips each level and the option, the option only when true', () => {
    for (const aiEditing of ['unverified', 'any'] as const) {
      const stored = storedKnowledgeSettings({ reviewEvery: 90, aiEditing });
      expect(parseKnowledgeSettings(stored)).toEqual({ reviewEvery: 90, aiEditing });
    }
    const on = storedKnowledgeSettings({ reviewEvery: 90, aiEditUnverifies: true });
    expect(parseKnowledgeSettings(on)).toEqual({ reviewEvery: 90, aiEditUnverifies: true });
    expect(parseKnowledgeSettings({ reviewEvery: 90, aiEditUnverifies: 'yes' })).toEqual({
      reviewEvery: 90,
    });
  });

  it('takes verification away only under Edit Any Page with the option on', () => {
    expect(aiEditUnverifies({ aiEditing: 'any', aiEditUnverifies: true })).toBe(true);
    expect(aiEditUnverifies({ aiEditing: 'any' })).toBe(false);
    expect(aiEditUnverifies({ aiEditing: 'unverified', aiEditUnverifies: true })).toBe(false);
    expect(aiEditUnverifies({ aiEditUnverifies: true })).toBe(false);
  });

  it('lets a connection write only as far as the lower of its scopes and the level', () => {
    expect(aiWriteReach('any', ['read', 'suggest'])).toBe('none');
    expect(aiWriteReach('suggest', ['read', 'suggest', 'write'])).toBe('none');
    expect(aiWriteReach('unverified', ['read', 'suggest', 'write'])).toBe('unverified');
    expect(aiWriteReach('any', ['read', 'suggest', 'write'])).toBe('any');
  });
});
