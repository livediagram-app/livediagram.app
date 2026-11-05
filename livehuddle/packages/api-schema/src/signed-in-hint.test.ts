import { describe, expect, it } from 'vitest';
import { SIGNED_IN_HINT_COOKIE, signedInHintOf } from './signed-in-hint';

describe('signedInHintOf', () => {
  it('reads the hint the api sets', () => {
    expect(signedInHintOf('a=1; lh_signed_in=1')).toBe(true);
    expect(signedInHintOf('lh_signed_in=0')).toBe(false);
    expect(signedInHintOf('lh_signed_in=junk')).toBe(false);
  });

  it('is null without the hint, ignoring look-alike names and malformed parts', () => {
    expect(signedInHintOf('')).toBeNull();
    expect(signedInHintOf('theme=dark; junk; xlh_signed_in=1; lh_signed_inx=1')).toBeNull();
  });

  // Cookies ignore the port, so on localhost livediagram's hint sits in the same jar (Work Tracker #374).
  it("never reads livediagram's hint, or any other app's", () => {
    expect(SIGNED_IN_HINT_COOKIE).toBe('lh_signed_in');
    expect(signedInHintOf('ld_signed_in=1')).toBeNull();
    expect(signedInHintOf('ld_signed_in=1; lp_signed_in=1; lh_signed_in=0')).toBe(false);
    expect(signedInHintOf('ld_signed_in=0; lh_signed_in=1')).toBe(true);
  });
});
