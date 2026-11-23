// docs/specs/026-plan email-to-board.md, public-roadmap.md and 030-forms/forms.md "Tiers": liveplanner's own
// sentences are worded for who is reading. The owner hears the tier and the tier above, a team's member the tier, a
// collaborator neither; the numbers in a sentence are the ones handed in (the api's), and only the tier above's come
// from the contract.
import { describe, expect, it } from 'vitest';
import { PLAIN_VOICE, type TierVoice } from './plan-tier';
import { emailsSpentWords, formMonthFullWords, roadmapsFullWords } from './tier-words';

const OWNER: TierVoice = { tier: 'Free', offer: { tier: 'pro', name: 'Pro' }, whose: 'yours' };
const ADMIN: TierVoice = {
  tier: 'Free',
  offer: { tier: 'team', name: 'Pro for Teams' },
  whose: 'team',
};
const MEMBER: TierVoice = { tier: 'Free', offer: null, whose: 'team' };
const ON_PRO: TierVoice = { tier: 'Pro', offer: null, whose: 'yours' };
const NOVEMBER = Date.UTC(2026, 10, 20, 12);

describe('email to board', () => {
  it('says the owner’s month in the limit the read answered, and when it starts again', () => {
    expect(emailsSpentWords(500, OWNER, NOVEMBER, 'en-GB')).toEqual({
      sentence:
        'This month’s 500 emails to your boards have become cards. More are turned away until 1 December, and the sender is told.',
      offer: 'Pro takes 10,000 a month.',
    });
    expect(emailsSpentWords(15_000, MEMBER, NOVEMBER, 'en-GB')).toEqual({
      sentence:
        'This month’s 15,000 emails to this team’s boards have become cards. More are turned away until 1 December, and the sender is told.',
      offer: '',
    });
    expect(emailsSpentWords(500, PLAIN_VOICE, NOVEMBER, 'en-GB').sentence).toBe(
      'This plan’s owner has used this month’s emails to boards. More are turned away until 1 December, and the sender is told.',
    );
  });
});

describe('form responses', () => {
  it('names the tier and the tier above to the owner', () => {
    expect(formMonthFullWords(500, OWNER, NOVEMBER, 'en-GB')).toBe(
      'Your forms have taken Free’s 500 responses for the month. This form takes responses again on 1 December, or now with 10,000 a month on Pro.',
    );
    expect(formMonthFullWords(1500, ADMIN, NOVEMBER, 'en-GB')).toBe(
      'This team’s forms have taken Free’s 1,500 responses for the month. This form takes responses again on 1 December, or now with 5,000 a member on Pro for Teams.',
    );
  });

  it('names no number or tier and offers nothing to anyone else', () => {
    expect(formMonthFullWords(500, PLAIN_VOICE, NOVEMBER, 'en-GB')).toBe(
      'This plan’s owner has used this month’s form responses. This form takes responses again on 1 December.',
    );
  });
});

describe('public roadmaps', () => {
  it('names the roadmap of this plan that holds the place', () => {
    expect(roadmapsFullWords(1, { where: 'here', title: 'Product Roadmap' }, OWNER)).toEqual({
      sentence: 'Free publishes 1 roadmap, and “Product Roadmap” is using it.',
      offer: 'Pro publishes 10.',
    });
  });

  it('says so plainly when another plan holds it, with the way on by hand', () => {
    expect(roadmapsFullWords(1, { where: 'elsewhere' }, OWNER).sentence).toBe(
      'Free publishes 1 roadmap, and a board in another plan is using it. Unpublish it there to publish this board.',
    );
  });

  it('counts a higher tier’s roadmaps, and offers a team no limit', () => {
    expect(roadmapsFullWords(10, { where: 'here-many' }, ON_PRO)).toEqual({
      sentence:
        'Pro publishes 10 roadmaps, and all 10 are published. Unpublish one to publish this board.',
      offer: '',
    });
    expect(roadmapsFullWords(1, { where: 'elsewhere' }, ADMIN).offer).toBe(
      'Pro for Teams publishes as many as you like.',
    );
  });

  it('names no tier before the owner is known', () => {
    expect(roadmapsFullWords(1, { where: 'elsewhere' }, PLAIN_VOICE).sentence).toMatch(
      /^This plan’s owner publishes 1 roadmap/,
    );
  });
});
