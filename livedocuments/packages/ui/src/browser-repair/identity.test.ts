import { describe, expect, it } from 'vitest';
import {
  formatBrowserIdentity,
  readBrowserIdentity,
  signedInFromCookie,
  type BrowserIdentity,
} from './identity';

// docs/specs/007-editor/load-recovery.md "Diagnostics": who this browser is, without a full guest id.

function storage(entries: Record<string, string>): Storage {
  return {
    getItem: (k: string) => entries[k] ?? null,
  } as Storage;
}

const GUEST = '6f1c2d3e-aaaa-bbbb-cccc-123456789abc';
// A guest token as liveworkspace issues it; only its claims are read.
const TOKEN = `h.${btoa(JSON.stringify({ sub: `guest_${GUEST}`, kind: 'guest' })).replace(/=+$/, '')}.s`;

describe('signedInFromCookie', () => {
  it('reads the signed-in hint cookie', () => {
    expect(signedInFromCookie('a=1; ldoc_signed_in=1')).toBe(true);
    expect(signedInFromCookie('ldoc_signed_in=0')).toBe(false);
    expect(signedInFromCookie('theme=dark')).toBeNull();
    expect(signedInFromCookie('')).toBeNull();
  });
});

describe('readBrowserIdentity', () => {
  it('reads the guest identity and keeps only the id prefix', () => {
    const id = readBrowserIdentity({
      localStorage: storage({
        'livedocuments:v2:guest-token': TOKEN,
      }),
      document: { cookie: 'ldoc_signed_in=0' },
    });
    expect(id).toEqual({
      signedIn: false,
      guestIdPrefix: '6f1c2d3e',
    });
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
    expect(id).toEqual({
      signedIn: null,
      guestIdPrefix: null,
    });
  });

  it('reads no guest from a token it cannot parse', () => {
    const id = readBrowserIdentity({
      localStorage: storage({ 'livedocuments:v2:guest-token': 'not-a-token' }),
      document: { cookie: '' },
    });
    expect(id.guestIdPrefix).toBeNull();
  });
});

describe('formatBrowserIdentity', () => {
  const guest: BrowserIdentity = {
    signedIn: false,
    guestIdPrefix: '6f1c2d3e',
  };

  it('describes a guest', () => {
    expect(formatBrowserIdentity(guest)).toEqual([
      'Signed in: no',
      'Guest id in this browser: 6f1c2d3e…',
    ]);
  });

  it('names the account when the caller knows it, and flags guest documents not yet moved', () => {
    expect(formatBrowserIdentity(guest, 'user_2abc')).toEqual([
      'Signed in: yes (user_2abc)',
      'Guest id in this browser: 6f1c2d3e…',
      'Guest documents moved to the account: NOT YET (guest token still present)',
    ]);
  });

  it('reads signed in from the cookie alone, and says unknown without one', () => {
    const none: BrowserIdentity = { ...guest, guestIdPrefix: null };
    expect(formatBrowserIdentity({ ...none, signedIn: true })[0]).toBe('Signed in: yes');
    expect(formatBrowserIdentity({ ...none, signedIn: null })).toEqual([
      'Signed in: unknown',
      'Guest id in this browser: none',
    ]);
  });
});
