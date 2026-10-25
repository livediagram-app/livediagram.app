import { describe, expect, it } from 'vitest';
import { signedInHintOf } from './signed-in-hint';

describe('signedInHintOf', () => {
  it('reads the hint the api sets', () => {
    expect(signedInHintOf('a=1; ldoc_signed_in=1')).toBe(true);
    expect(signedInHintOf('ldoc_signed_in=0')).toBe(false);
    expect(signedInHintOf('ldoc_signed_in=junk')).toBe(false);
  });

  it('is null without the hint, ignoring look-alike names and malformed parts', () => {
    expect(signedInHintOf('')).toBeNull();
    expect(signedInHintOf('theme=dark; junk; xldoc_signed_in=1; ldoc_signed_inx=1')).toBeNull();
  });
});
