import { describe, expect, it } from 'vitest';
import { createSignedInHintReader } from './signed-in-hint';

const signedInHintOf = createSignedInHintReader('xx_signed_in');

describe('createSignedInHintReader', () => {
  it('reads the hint the api sets', () => {
    expect(signedInHintOf('a=1; xx_signed_in=1')).toBe(true);
    expect(signedInHintOf('xx_signed_in=0')).toBe(false);
    expect(signedInHintOf('xx_signed_in=junk')).toBe(false);
  });

  it('is null without the hint, ignoring look-alike names and malformed parts', () => {
    expect(signedInHintOf('')).toBeNull();
    expect(signedInHintOf('theme=dark; junk; xxx_signed_in=1; xx_signed_inx=1')).toBeNull();
  });
});
