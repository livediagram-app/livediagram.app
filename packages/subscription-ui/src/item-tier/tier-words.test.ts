// The words every app says of a tier's limit (liveworkspace/docs/specs/019-subscription/subscription.md "What people
// see"): a meter's numbers, the day a month starts again, and the AI credits an ask spends, worded for who is reading.
import { describe, expect, it } from 'vitest';
import { PLAIN_VOICE, type TierVoice } from './item-tier';
import { creditsLeftLine, creditsUsedWords, monthResetDay, tierAbove, usedOf } from './tier-words';

const OWNER: TierVoice = { tier: 'Free', offer: { tier: 'pro', name: 'Pro' }, whose: 'yours' };
const ADMIN: TierVoice = {
  tier: 'Free',
  offer: { tier: 'team', name: 'Pro for Teams' },
  whose: 'team',
};
const MEMBER: TierVoice = { tier: 'Free', offer: null, whose: 'team' };
const NOVEMBER = Date.UTC(2026, 10, 20, 12);

describe('numbers', () => {
  it('writes a meter’s count, and what the tier above allows', () => {
    expect(usedOf(205, 1000)).toBe('205 of 1,000');
    expect(tierAbove('automationRules', 'pro')).toBe('500');
    expect(tierAbove('aiCreditsPerMonth', 'team')).toBe('500 a member');
    expect(tierAbove('ownAiKey', 'pro')).toBeNull();
  });
});

describe('AI credits', () => {
  it('counts what is left, naming the credits', () => {
    expect(creditsLeftLine(12, 50)).toBe('38 of 50 AI credits left this month');
    expect(creditsLeftLine(60, 50)).toBe('0 of 50 AI credits left this month');
  });

  it('says when the month starts again, and what the tier above has to someone who may move to it', () => {
    expect(creditsUsedWords(OWNER, NOVEMBER, false, 'en-GB')).toEqual({
      sentence: 'This month’s AI credits are used. They start again on 1 December.',
      offer: 'Pro has 1,000 a month.',
    });
    expect(creditsUsedWords(ADMIN, NOVEMBER, false, 'en-GB').offer).toBe(
      'Pro for Teams has 500 a member a month.',
    );
    expect(creditsUsedWords(PLAIN_VOICE, NOVEMBER, false, 'en-GB').offer).toBe('');
  });

  it('says an AI step is skipped meanwhile', () => {
    expect(creditsUsedWords(MEMBER, NOVEMBER, true, 'en-GB').sentence).toBe(
      'This month’s AI credits are used. They start again on 1 December. Until then this step is skipped and the rest of the rule runs.',
    );
  });

  it('starts a month on the first of the next UTC month, in the reader’s locale', () => {
    expect(monthResetDay(Date.UTC(2026, 11, 31, 23, 59), 'en-GB')).toBe('1 January');
    expect(monthResetDay(NOVEMBER, 'en-US')).toBe('December 1');
  });
});
