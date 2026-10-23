// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readSignedInHint } from './signed-in-hint';

describe('readSignedInHint', () => {
  it('reads no cookie at all as a guest', () => {
    expect(readSignedInHint('')).toBe(false);
  });

  it('reads the hint the api sets as probably signed in', () => {
    expect(readSignedInHint('other=1; ld_signed_in=1')).toBe(true);
  });

  it('reads a signed-out hint as a guest', () => {
    expect(readSignedInHint('ld_signed_in=0')).toBe(false);
  });

  it('ignores other cookies that merely contain the name, and malformed parts', () => {
    expect(readSignedInHint('xld_signed_in=1; ld_signed_inx=1; junk')).toBe(false);
  });

  it('reads document.cookie by default', () => {
    document.cookie = 'ld_signed_in=1';
    expect(readSignedInHint()).toBe(true);
    document.cookie = 'ld_signed_in=';
    expect(readSignedInHint()).toBe(false);
  });
});
