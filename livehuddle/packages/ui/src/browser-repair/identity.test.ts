import { describe, expect, it } from 'vitest';
import {
  formatBrowserIdentity,
  readBrowserIdentity,
  signedInFromCookie,
  type BrowserIdentity,
} from './identity';

// docs/specs/007-editor/load-recovery.md "Diagnostics": who this browser is, without the guest token.

function storage(entries: Record<string, string>): Storage {
  return {
    getItem: (k: string) => entries[k] ?? null,
  } as Storage;
}

const b64url = (v: unknown) =>
  btoa(JSON.stringify(v)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const EXP = 2_000_000_000;
const TOKEN = `${b64url({ alg: 'EdDSA' })}.${b64url({
  sub: 'guest_6f1c2d3eaaaabbbbcccc',
  kind: 'guest',
  exp: EXP,
})}.sig`;

describe('signedInFromCookie', () => {
  it('reads the signed-in hint cookie', () => {
    expect(signedInFromCookie('a=1; ld_signed_in=1')).toBe(true);
    expect(signedInFromCookie('ld_signed_in=0')).toBe(false);
    expect(signedInFromCookie('theme=dark')).toBeNull();
    expect(signedInFromCookie('')).toBeNull();
  });
});

describe('readBrowserIdentity', () => {
  it('reads the guest token and keeps only the id prefix', () => {
    const id = readBrowserIdentity({
      localStorage: storage({ 'livehuddle:v2:guest-token': TOKEN }),
      document: { cookie: 'ld_signed_in=0' },
    });
    expect(id).toEqual({ signedIn: false, guestIdPrefix: '6f1c2d3e', guestExpiresAt: EXP * 1000 });
  });

  it('reads no guest from something that is not a guest token', () => {
    const id = readBrowserIdentity({
      localStorage: storage({ 'livehuddle:v2:guest-token': 'not-a-token' }),
      document: { cookie: '' },
    });
    expect(id.guestIdPrefix).toBeNull();
  });

  it('copes with blocked storage and cookies', () => {
    const id = readBrowserIdentity({
      get localStorage(): Storage {
        throw new Error('blocked');
      },
      document: {
        get cookie(): string {
          throw new Error('blocked');
        },
      },
    });
    expect(id).toEqual({ signedIn: null, guestIdPrefix: null, guestExpiresAt: null });
  });
});

describe('formatBrowserIdentity', () => {
  const guest: BrowserIdentity = {
    signedIn: false,
    guestIdPrefix: '6f1c2d3e',
    guestExpiresAt: EXP * 1000,
  };
  const NOW = EXP * 1000 - 1;

  it('describes a guest', () => {
    expect(formatBrowserIdentity(guest, null, NOW)).toEqual([
      'Signed in: no',
      'Guest in this browser: guest_6f1c2d3e… (current)',
    ]);
  });

  it('says when the guest token has run out', () => {
    expect(formatBrowserIdentity(guest, null, EXP * 1000)[1]).toBe(
      'Guest in this browser: guest_6f1c2d3e… (expired)',
    );
  });

  it('names the account when the caller knows it', () => {
    expect(formatBrowserIdentity(guest, 'user_2abc', NOW)[0]).toBe('Signed in: yes (user_2abc)');
  });

  it('reads signed in from the cookie alone, and says unknown without one', () => {
    const none: BrowserIdentity = { ...guest, guestIdPrefix: null };
    expect(formatBrowserIdentity({ ...none, signedIn: true })[0]).toBe('Signed in: yes');
    expect(formatBrowserIdentity({ ...none, signedIn: null })).toEqual([
      'Signed in: unknown',
      'Guest in this browser: none',
    ]);
  });
});
