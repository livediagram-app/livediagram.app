import { describe, expect, it } from 'vitest';
import { AI_CREDIT_COSTS, aiCreditsWords, photoReadCredits, usesAiCredits } from './ai-costs';

describe('AI operation costs', () => {
  it('holds the spec’s costs', () => {
    expect(AI_CREDIT_COSTS).toEqual({
      knowledgeAsk: 1,
      knowledgeConflictCheck: 1,
      knowledgeSetup: 2,
      automationSummary: 1,
      automationRuleDraft: 1,
      planDraft: 1,
    });
  });

  it('charges a photo by its notes, one credit at least', () => {
    expect([0, -3, 1, 24, 25, 48, 60].map(photoReadCredits)).toEqual([1, 1, 1, 1, 2, 2, 3]);
  });

  it('words a cost', () => {
    expect(aiCreditsWords(1)).toBe('1 AI credit');
    expect(aiCreditsWords(1200)).toBe('1,200 AI credits');
    expect(usesAiCredits(2)).toBe('Uses 2 AI credits');
  });
});
