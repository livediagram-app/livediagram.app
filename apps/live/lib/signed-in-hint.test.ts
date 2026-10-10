// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readSignedInHint } from './signed-in-hint';

describe('readSignedInHint', () => {
  it('reads no cookie at all as a guest', () => {
    expect(readSignedInHint('')).toBe(false);
  });

  it('reads a signed-out Clerk browser as a guest', () => {
    expect(readSignedInHint('__clerk_db_jwt=dvb_x; __client_uat_PnruOShC=0; __client_uat=0')).toBe(
      false,
    );
  });

  it('reads a sign-in time as probably signed in', () => {
    expect(readSignedInHint('__client_uat=1760000000')).toBe(true);
  });

  it('reads the key-suffixed twin on its own', () => {
    expect(readSignedInHint('other=1; __client_uat_PnruOShC=1760000000')).toBe(true);
  });

  it('ignores other cookies that merely contain the name', () => {
    expect(readSignedInHint('x__client_uat=17; __client_uatx=17; __client_uat=0')).toBe(false);
  });

  it('ignores an empty value and a malformed part', () => {
    expect(readSignedInHint('__client_uat=; junk; __client_uat_k=0')).toBe(false);
  });

  it('reads document.cookie by default', () => {
    document.cookie = '__client_uat=1760000000';
    expect(readSignedInHint()).toBe(true);
    document.cookie = '__client_uat=0';
    expect(readSignedInHint()).toBe(false);
  });
});
