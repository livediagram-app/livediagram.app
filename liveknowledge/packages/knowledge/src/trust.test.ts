import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REVIEW_EVERY,
  GUEST_VERIFIER,
  knowledgeHealth,
  parseKnowledgeFields,
  reviewDays,
  trustState,
  verified,
} from './trust';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 20);

describe("a page's knowledge fields", () => {
  it('keeps what is valid', () => {
    expect(
      parseKnowledgeFields({
        owner: 'acct_1',
        verifiedAt: NOW + 0.7,
        verifiedBy: 'acct_2',
        reviewEvery: 180,
        context: true,
        extra: 'dropped',
      }),
    ).toEqual({
      owner: 'acct_1',
      verifiedAt: NOW,
      verifiedBy: 'acct_2',
      context: true,
    });
  });

  it('has no review period of its own: a stored one is dropped', () => {
    expect(parseKnowledgeFields({ reviewEvery: 'never' })).toEqual({});
    expect(parseKnowledgeFields({ owner: 'acct_1', reviewEvery: 30 })).toEqual({ owner: 'acct_1' });
  });

  it('drops what is not', () => {
    expect(parseKnowledgeFields(null)).toEqual({});
    expect(parseKnowledgeFields('verified')).toEqual({});
    expect(
      parseKnowledgeFields({
        owner: '',
        verifiedAt: 'yesterday',
        verifiedBy: 'acct_2',
        reviewEvery: 45,
        context: 'yes',
      }),
    ).toEqual({});
    expect(parseKnowledgeFields({ owner: 'x'.repeat(129), verifiedAt: -1 })).toEqual({});
    expect(parseKnowledgeFields({ verifiedAt: Number.NaN })).toEqual({});
    expect(parseKnowledgeFields({ verifiedAt: NOW, verifiedBy: 7 })).toEqual({ verifiedAt: NOW });
  });
});

describe("a page's state", () => {
  it('is never verified without a verification', () => {
    expect(trustState({}, 90, NOW)).toEqual({ state: 'never-verified' });
    expect(trustState({ owner: 'acct_1' }, 30, NOW)).toEqual({ state: 'never-verified' });
  });

  it('is verified until the review is due, 90 days by default', () => {
    const verifiedAt = NOW - 89 * DAY;
    expect(trustState({ verifiedAt }, DEFAULT_REVIEW_EVERY, NOW)).toEqual({
      state: 'verified',
      verifiedAt,
      reviewAt: verifiedAt + 90 * DAY,
    });
  });

  it('is due once the interval has passed, to the millisecond', () => {
    const verifiedAt = NOW - 30 * DAY;
    expect(trustState({ verifiedAt }, 30, NOW).state).toBe('review-due');
    expect(trustState({ verifiedAt }, 30, NOW - 1).state).toBe('verified');
    expect(trustState({ verifiedAt }, 365, NOW).state).toBe('verified');
  });

  it("follows the knowledgebase's period, whatever the page once stored", () => {
    const fields = parseKnowledgeFields({ verifiedAt: NOW - 100 * DAY, reviewEvery: 365 });
    expect(trustState(fields, 90, NOW).state).toBe('review-due');
    expect(trustState(fields, 180, NOW).state).toBe('verified');
  });

  it('never comes due in a knowledgebase whose pages do not age', () => {
    const verifiedAt = NOW - 5000 * DAY;
    expect(trustState({ verifiedAt }, 'never', NOW)).toEqual({ state: 'verified', verifiedAt });
    expect(reviewDays('never')).toBeUndefined();
    expect(reviewDays(90)).toBe(90);
  });
});

describe('Verify', () => {
  it('sets when and who, and makes the verifier the owner of a page with none', () => {
    expect(verified({}, 'acct_2', NOW)).toEqual({
      owner: 'acct_2',
      verifiedAt: NOW,
      verifiedBy: 'acct_2',
    });
    expect(verified({ owner: 'acct_1', context: true }, 'acct_2', NOW)).toEqual({
      owner: 'acct_1',
      context: true,
      verifiedAt: NOW,
      verifiedBy: 'acct_2',
    });
  });
});

describe('Knowledge Health', () => {
  it('counts the pages in each state', () => {
    expect(
      knowledgeHealth(
        [
          {},
          { verifiedAt: NOW - DAY },
          { verifiedAt: NOW - 400 * DAY },
          { verifiedAt: NOW - 31 * DAY },
          {},
        ],
        30,
        NOW,
      ),
    ).toEqual({ verified: 1, reviewDue: 2, neverVerified: 2, total: 5 });
    const pages = [{ verifiedAt: NOW - 31 * DAY }, { verifiedAt: NOW - 400 * DAY }];
    expect(knowledgeHealth(pages, 90, NOW).reviewDue).toBe(1);
    expect(knowledgeHealth(pages, 'never', NOW)).toMatchObject({ verified: 2, reviewDue: 0 });
    expect(knowledgeHealth([], 90, NOW)).toEqual({
      verified: 0,
      reviewDue: 0,
      neverVerified: 0,
      total: 0,
    });
  });
});

describe('a guest verifies', () => {
  it('as "guest", and never becomes the owner', () => {
    expect(verified({}, GUEST_VERIFIER, 5)).toEqual({ verifiedAt: 5, verifiedBy: 'guest' });
    expect(verified({ owner: 'u1' }, GUEST_VERIFIER, 5)).toEqual({
      owner: 'u1',
      verifiedAt: 5,
      verifiedBy: 'guest',
    });
  });
});
