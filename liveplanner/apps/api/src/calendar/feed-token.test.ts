// The calendar feed's token (docs/specs/026-plan/calendar-feed.md "The feed link"): its shape and its hash.
import { describe, expect, it } from 'vitest';
import { FEED_TOKEN_PATTERN, FEED_TOKEN_PREFIX, feedTokenHash, newFeedToken } from './feed-token';

describe('newFeedToken', () => {
  it('is lpf_ and 43 base64url characters', () => {
    const token = newFeedToken();
    expect(token.startsWith(FEED_TOKEN_PREFIX)).toBe(true);
    expect(token).toHaveLength(FEED_TOKEN_PREFIX.length + 43);
    expect(FEED_TOKEN_PATTERN.test(token)).toBe(true);
  });

  it('never repeats', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => newFeedToken()));
    expect(tokens.size).toBe(50);
  });
});

describe('FEED_TOKEN_PATTERN', () => {
  it('turns away other shapes', () => {
    expect(FEED_TOKEN_PATTERN.test('lwt_' + 'a'.repeat(43))).toBe(false);
    expect(FEED_TOKEN_PATTERN.test('lpf_' + 'a'.repeat(42))).toBe(false);
    expect(FEED_TOKEN_PATTERN.test('lpf_' + 'a'.repeat(44))).toBe(false);
    expect(FEED_TOKEN_PATTERN.test('lpf_' + 'a'.repeat(42) + '+')).toBe(false);
  });
});

describe('feedTokenHash', () => {
  it('is the SHA-256 of the token as lowercase hex', async () => {
    expect(await feedTokenHash('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('differs per token and is stable for one', async () => {
    const a = newFeedToken();
    expect(await feedTokenHash(a)).toBe(await feedTokenHash(a));
    expect(await feedTokenHash(a)).not.toBe(await feedTokenHash(newFeedToken()));
  });
});
