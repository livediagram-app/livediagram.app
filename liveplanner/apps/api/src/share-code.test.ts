import { describe, expect, it } from 'vitest';
import { generateShareCode, SHARE_CODE_LENGTH } from './db';

// `generateShareCode` mints the short codes used as URL params on
// /live/project/shared?s=<code>. Two contracts matter:
//
//   1. Length is exact: callers stamp them into URLs and the share
//      table indexes them. Drift between the requested length and
//      the returned length would silently change URL shape and
//      could collide with old codes in storage.
//   2. The alphabet is a curated set with no ambiguous glyphs
//      (no `I` / `1`, no `O` / `0`). A code that comes out as
//      `1O0lI` is unusable when typed back. Pinning the alphabet
//      stops a future "let's use base64 to be 'efficient'" change
//      from quietly degrading the gesture.
//
// The function uses `crypto.getRandomValues` under the hood, which
// is available in Node 22+ via the Web Crypto API. No mocking
// needed: each call really is random and we assert on the
// invariants instead of the exact bytes.

const ALPHABET = new Set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789');

describe('generateShareCode', () => {
  it('defaults to 14 characters, 70 bits against guessing across every live link (docs/specs/015-api/api.md "Share codes")', () => {
    expect(SHARE_CODE_LENGTH).toBe(14);
    expect(generateShareCode()).toHaveLength(14);
  });

  it('honours the explicit length argument', () => {
    expect(generateShareCode(1)).toHaveLength(1);
    expect(generateShareCode(16)).toHaveLength(16);
    expect(generateShareCode(64)).toHaveLength(64);
  });

  it('only emits characters from the curated alphabet, no ambiguous glyphs (no I/1, no O/0, no L/lowercase)', () => {
    // Hammer it enough times that any out-of-alphabet leak would
    // show up. Each call yields 64 chars so 50 iterations = 3200
    // chars sampled.
    for (let i = 0; i < 50; i++) {
      const code = generateShareCode(64);
      for (const ch of code) {
        expect(ALPHABET.has(ch)).toBe(true);
      }
    }
  });

  it('produces a different code on each call (32^14, about 1.2e21 combinations)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      seen.add(generateShareCode());
    }
    // Collision-free across 1000 calls is the realistic expectation:
    // even the old 8-character codes put the first expected collision
    // around the 10^6 mark, so a single dupe here would be a real
    // signal of a broken RNG / bug, not statistical noise.
    expect(seen.size).toBe(1000);
  });

  it('returns the empty string when asked for length 0 (edge case that callers shouldn’t hit but the bytes loop still tolerates)', () => {
    expect(generateShareCode(0)).toBe('');
  });
});
