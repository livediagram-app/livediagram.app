// The Automations sentences where a tier's limit shows, in every app (liveworkspace/docs/specs/018-automations/
// automations.md "Runs, limits and loops"; 019-subscription "What people see"): every sentence is worded for who is
// reading and in the item's own word. The owner hears the tier and the tier above, a team's member the tier, a
// collaborator neither; the numbers are the ones handed in (the api's), and only the tier above's come from the
// contract. The item's own fixed bounds offer no upgrade.
import { describe, expect, it } from 'vitest';
import { PLAIN_VOICE, type TierVoice } from '@liveworkspace/subscription-ui/item-tier';
import {
  addRuleOffWords,
  duplicateOffWords,
  guestRulesWords,
  MESSAGE_RUN_COST,
  ruleOnOffWords,
  rulesFullWords,
  runsNearWords,
  runsSpentToast,
  runsUsedWords,
} from './tier-words';

const OWNER: TierVoice = { tier: 'Free', offer: { tier: 'pro', name: 'Pro' }, whose: 'yours' };
const ADMIN: TierVoice = {
  tier: 'Free',
  offer: { tier: 'team', name: 'Pro for Teams' },
  whose: 'team',
};
const MEMBER: TierVoice = { tier: 'Free', offer: null, whose: 'team' };
const ON_PRO: TierVoice = { tier: 'Pro', offer: null, whose: 'yours' };

// 22 November, in the month that turns on 1 December.
const NOW = Date.UTC(2026, 10, 22, 12);

describe('runs a month', () => {
  it('says a used month and when it turns, offering the tier above only to someone who may move to it', () => {
    expect(runsUsedWords(OWNER, NOW, 'en-GB')).toEqual({
      sentence: 'This month’s automation runs are used. Rules run again on 1 December.',
      offer: 'Pro has 10,000 a month.',
    });
    expect(runsUsedWords(ADMIN, NOW, 'en-GB').offer).toBe(
      'Pro for Teams has 5,000 a member a month.',
    );
    expect(runsUsedWords(MEMBER, NOW).offer).toBe('');
    expect(runsUsedWords(PLAIN_VOICE, NOW).offer).toBe('');
  });

  it('counts what is left as the month runs low', () => {
    expect(runsNearWords(45, OWNER)).toEqual({
      sentence: '45 automation runs left this month.',
      offer: 'Pro gives you 10,000 a month.',
    });
    expect(runsNearWords(1, PLAIN_VOICE)).toEqual({
      sentence: '1 automation run left this month.',
      offer: '',
    });
  });

  it('says a refused Run Rule: the owner’s month, else the item’s fixed day', () => {
    expect(runsSpentToast('automation_runs_used', 'plan', NOW, 'en-GB')).toBe(
      'This month’s automation runs are used. Rules run again on 1 December.',
    );
    expect(runsSpentToast('automation_budget_spent', 'Space', NOW)).toBe(
      'This Space has used today’s 1,000 runs. Rules run again tomorrow.',
    );
  });

  it('says what a message costs', () => {
    expect(MESSAGE_RUN_COST).toBe('Each message this step sends counts as one automation run.');
  });
});

describe('rules over the owner’s total', () => {
  it('names the tier and the tier above to the owner, and the team to an admin', () => {
    expect(rulesFullWords(25, 25, OWNER, 'plan', true)).toBe(
      'You have 25 rules, the most Free holds. Delete one to add another, or hold 500 with Pro.',
    );
    expect(rulesFullWords(25, 25, ADMIN, 'plan', true)).toBe(
      'This team has 25 rules, the most Free holds. Delete one to add another, or hold 250 a member with Pro for Teams.',
    );
  });

  it('names the tier alone to a team’s member and to an owner with nowhere higher to go', () => {
    expect(rulesFullWords(25, 25, MEMBER, 'plan', true)).toBe(
      'This team has 25 rules, the most Free holds. Delete one to add another.',
    );
    expect(rulesFullWords(1, 1, ON_PRO, 'plan', true)).toBe(
      'You have 1 rule, the most Pro holds. Delete one to add another.',
    );
    expect(rulesFullWords(25, 25, PLAIN_VOICE, 'plan', true)).toBe(
      'Its owner has 25 rules, the most allowed. Delete one to add another.',
    );
  });

  it('says how far over the owner is once their tier dropped', () => {
    expect(rulesFullWords(30, 25, OWNER, 'plan', true)).toBe(
      'You have 30 rules, and Free holds 25. Another can be added once there are fewer than 25, or hold 500 with Pro.',
    );
    expect(rulesFullWords(30, 25, PLAIN_VOICE, 'plan', true)).toContain('more than the 25 allowed');
  });

  it('says why New Rule, Duplicate and a switch are off', () => {
    expect(addRuleOffWords(25, 'plan', 'yours')).toBe(
      'You have used all 25 rules. Delete one to add another.',
    );
    expect(duplicateOffWords(25, 'plan', 'team')).toBe(
      'This team has used all 25 rules. Delete one to duplicate this.',
    );
    expect(addRuleOffWords(25, 'plan', 'owner')).toContain('Its owner has used all 25');
    expect(ruleOnOffWords(27, 25, 'plan', 'yours')).toBe(
      'You have 27 rules, more than the 25 allowed. Delete 2 to switch this one on.',
    );
  });
});

describe('the item’s own 50', () => {
  it('names no tier and offers nothing, in every app’s word', () => {
    expect(rulesFullWords(50, 50, OWNER, 'plan')).toBe(
      'This plan has 50 rules, the most a plan can hold. Delete one to add another.',
    );
    expect(rulesFullWords(1, 1, PLAIN_VOICE, 'document')).toBe(
      'This document has 1 rule, the most a document can hold. Delete one to add another.',
    );
    expect(rulesFullWords(52, 50, PLAIN_VOICE, 'document')).toBe(
      'This document has 52 rules, more than the 50 a document can hold. It can add another once it has fewer than 50.',
    );
  });

  it('says why New Rule, Duplicate and a switch are off', () => {
    expect(addRuleOffWords(50, 'plan')).toBe(
      'This plan holds all 50 of its rules. Delete one to add another.',
    );
    expect(duplicateOffWords(50, 'plan')).toBe(
      'This plan holds all 50 of its rules. Delete one to duplicate this.',
    );
    expect(ruleOnOffWords(52, 50, 'plan')).toBe(
      'This plan has 52 rules, more than the 50 allowed. Delete 2 to switch this one on.',
    );
  });
});

describe('a guest’s plan', () => {
  it('says to sign in, never to upgrade', () => {
    const words = guestRulesWords(25, 'plan');
    expect(words).toBe(
      'This plan holds 25 rules, the most a plan holds before you sign in. Sign in to keep this plan as your own.',
    );
    expect(words).not.toMatch(/pro|upgrade/i);
  });
});
