import { describe, expect, it } from 'vitest';
import { signedInHintOf } from './signed-in-hint';

describe('signedInHintOf', () => {
  it('reads the hint the api sets', () => {
    expect(signedInHintOf('a=1; lp_signed_in=1')).toBe(true);
    expect(signedInHintOf('lp_signed_in=0')).toBe(false);
    expect(signedInHintOf('lp_signed_in=junk')).toBe(false);
  });

  it('is null without the hint, ignoring look-alike names and malformed parts', () => {
    expect(signedInHintOf('')).toBeNull();
    expect(signedInHintOf('theme=dark; junk; xlp_signed_in=1; lp_signed_inx=1')).toBeNull();
  });
});
