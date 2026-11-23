import { describe, expect, it } from 'vitest';
import { aiCreditsOf, creditsLine, noteAiCredits, noteAiCreditsUsed } from './knowledge-credits';

// docs/specs/030-knowledgebase/tiers.md "Built-in AI on AI credits": the owner's month as the last answer told it.
describe('the AI credits store', () => {
  it('keeps the month an answer told, and says what is left', () => {
    noteAiCredits('kb-1', { used: 38, limit: 1000 });
    expect(aiCreditsOf('kb-1')).toEqual({ used: 38, limit: 1000, usedUp: false });
    expect(creditsLine(aiCreditsOf('kb-1'))).toBe('Uses 1 AI credit · 962 left this month');
  });

  it('marks the month used with the owner’s figures, or without any for someone else', () => {
    noteAiCreditsUsed('kb-2', 50, 50);
    expect(aiCreditsOf('kb-2')).toEqual({ used: 50, limit: 50, usedUp: true });
    // A collaborator is sent no figures (019 "What a collaborator is told"): still used up.
    noteAiCreditsUsed('kb-3', undefined, undefined);
    expect(aiCreditsOf('kb-3')?.usedUp).toBe(true);
  });
});
