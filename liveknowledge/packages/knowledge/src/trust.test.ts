import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REVIEW_EVERY,
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
      reviewEvery: 180,
      context: true,
    });
    expect(parseKnowledgeFields({ reviewEvery: 'never' })).toEqual({ reviewEvery: 'never' });
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
    expect(trustState({}, NOW)).toEqual({ state: 'never-verified' });
    expect(trustState({ owner: 'acct_1', reviewEvery: 30 }, NOW)).toEqual({
      state: 'never-verified',
    });
  });

  it('is verified until the review is due, 90 days by default', () => {
    expect(DEFAULT_REVIEW_EVERY).toBe(90);
    const verifiedAt = NOW - 89 * DAY;
    expect(trustState({ verifiedAt }, NOW)).toEqual({
      state: 'verified',
      verifiedAt,
      reviewAt: verifiedAt + 90 * DAY,
    });
  });

  it('is due once the interval has passed, to the millisecond', () => {
    const verifiedAt = NOW - 30 * DAY;
    expect(trustState({ verifiedAt, reviewEvery: 30 }, NOW).state).toBe('review-due');
    expect(trustState({ verifiedAt, reviewEvery: 30 }, NOW - 1).state).toBe('verified');
    expect(trustState({ verifiedAt, reviewEvery: 365 }, NOW).state).toBe('verified');
  });

  it('never comes due on a page that does not age', () => {
    const verifiedAt = NOW - 5000 * DAY;
    expect(trustState({ verifiedAt, reviewEvery: 'never' }, NOW)).toEqual({
      state: 'verified',
      verifiedAt,
    });
    expect(reviewDays({ reviewEvery: 'never' })).toBeUndefined();
    expect(reviewDays({})).toBe(90);
  });
});

describe('Verify', () => {
  it('sets when and who, and makes the verifier the owner of a page with none', () => {
    expect(verified({}, 'acct_2', NOW)).toEqual({
      owner: 'acct_2',
      verifiedAt: NOW,
      verifiedBy: 'acct_2',
    });
    expect(verified({ owner: 'acct_1', reviewEvery: 30 }, 'acct_2', NOW)).toEqual({
      owner: 'acct_1',
      reviewEvery: 30,
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
          { verifiedAt: NOW - 31 * DAY, reviewEvery: 30 },
          {},
        ],
        NOW,
      ),
    ).toEqual({ verified: 1, reviewDue: 2, neverVerified: 2, total: 5 });
    expect(knowledgeHealth([], NOW)).toEqual({
      verified: 0,
      reviewDue: 0,
      neverVerified: 0,
      total: 0,
    });
  });
});
