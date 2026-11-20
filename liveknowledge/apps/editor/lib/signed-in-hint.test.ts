// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readSignedInHint } from './signed-in-hint';

describe('readSignedInHint', () => {
  it('reads no cookie at all as a guest', () => {
    expect(readSignedInHint('')).toBe(false);
  });

  it('reads the hint the api sets as probably signed in', () => {
    expect(readSignedInHint('other=1; ldoc_signed_in=1')).toBe(true);
  });

  it('reads a signed-out hint as a guest', () => {
    expect(readSignedInHint('ldoc_signed_in=0')).toBe(false);
  });

  it('ignores other cookies that merely contain the name, and malformed parts', () => {
    expect(readSignedInHint('xldoc_signed_in=1; ldoc_signed_inx=1; junk')).toBe(false);
  });

  it('reads document.cookie by default', () => {
    document.cookie = 'ldoc_signed_in=1';
    expect(readSignedInHint()).toBe(true);
    document.cookie = 'ldoc_signed_in=';
    expect(readSignedInHint()).toBe(false);
  });
});
