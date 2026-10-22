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

describe('signedInFromCookie', () => {
  it('reads the signed-in hint cookie', () => {
    expect(signedInFromCookie('a=1; lp_signed_in=1')).toBe(true);
    expect(signedInFromCookie('lp_signed_in=0')).toBe(false);
    expect(signedInFromCookie('theme=dark')).toBeNull();
    expect(signedInFromCookie('')).toBeNull();
  });
});

describe('readBrowserIdentity', () => {
  it('reads the guest identity and keeps only the id prefix', () => {
    const id = readBrowserIdentity({
      localStorage: storage({
        'liveplanner:v2:self-id': GUEST,
        'liveplanner:v2:self-sig': 'sig',
      }),
      document: { cookie: 'lp_signed_in=0' },
    });
    expect(id).toEqual({
      signedIn: false,
      guestIdPrefix: '6f1c2d3e',
      guestSigned: true,
      pendingUpgrade: false,
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
      guestSigned: false,
      pendingUpgrade: false,
    });
  });
});

describe('formatBrowserIdentity', () => {
  const guest: BrowserIdentity = {
    signedIn: false,
    guestIdPrefix: '6f1c2d3e',
    guestSigned: true,
    pendingUpgrade: false,
  };

  it('describes a guest', () => {
    expect(formatBrowserIdentity(guest)).toEqual([
      'Signed in: no',
      'Guest id in this browser: 6f1c2d3e… (signed: yes)',
      'Identity upgrade pending: no',
    ]);
  });

  it('names the account when the caller knows it, and flags guest documents not yet moved', () => {
    expect(formatBrowserIdentity(guest, 'user_2abc')).toEqual([
      'Signed in: yes (user_2abc)',
      'Guest id in this browser: 6f1c2d3e… (signed: yes)',
      'Identity upgrade pending: no',
      'Guest documents moved to the account: NOT YET (guest id still present)',
    ]);
  });

  it('reads signed in from the cookie alone, and says unknown without one', () => {
    const none: BrowserIdentity = { ...guest, guestIdPrefix: null };
    expect(formatBrowserIdentity({ ...none, signedIn: true })[0]).toBe('Signed in: yes');
    expect(formatBrowserIdentity({ ...none, signedIn: null })).toEqual([
      'Signed in: unknown',
      'Guest id in this browser: none',
      'Identity upgrade pending: no',
    ]);
  });
});
