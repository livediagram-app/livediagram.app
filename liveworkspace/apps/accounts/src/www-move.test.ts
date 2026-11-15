import { makeSignature } from 'better-auth/crypto';
import { describe, expect, it } from 'vitest';
import { authOptions } from './auth-options.ts';
import { clearedCookies, cookieDomain, domainAttribute } from './cookie-scope.ts';
import { GUEST_COOKIE, signGuestCookie } from './guests.ts';
import { withOwnCookies } from './own-cookies.ts';

// liveworkspace/docs/specs/003-accounts/accounts.md "The move to www.": nobody is signed out by the move.

const SECRET = 's'.repeat(32);
const OTHER_SECRET = 'o'.repeat(32);

function options(baseUrl: string, cookieDomainValue?: string) {
  return authOptions(
    {
      baseUrl,
      secret: SECRET,
      resources: [],
      turnstileSecretKey: 't',
      adminToken: 'a',
      google: null,
      appOrigins: ['https://www.liveplanner.app'],
      cookieDomain: cookieDomainValue,
      sendCode: async () => {},
    },
    undefined,
  );
}

describe('the session is valid on both hosts', () => {
  it('scopes production cookies to liveworkspace.app, and keeps staging and development host-only', () => {
    expect(cookieDomain('production')).toBe('liveworkspace.app');
    expect(cookieDomain('staging')).toBeUndefined();
    expect(cookieDomain('development')).toBeUndefined();
    expect(domainAttribute('liveworkspace.app')).toBe('; Domain=liveworkspace.app');
    expect(domainAttribute(undefined)).toBe('');
  });

  it('gives Better Auth the cookie domain in production only', () => {
    expect(options('https://www.liveworkspace.app', 'liveworkspace.app').advanced).toMatchObject({
      crossSubDomainCookies: { enabled: true, domain: 'liveworkspace.app' },
    });
    expect(options('https://staging.liveworkspace.app').advanced).not.toHaveProperty(
      'crossSubDomainCookies',
    );
  });

  it('trusts both of its own hosts, and only its own twin', () => {
    expect(options('https://www.liveworkspace.app').trustedOrigins).toEqual([
      'https://www.liveplanner.app',
      'https://liveworkspace.app',
    ]);
    expect(options('https://liveworkspace.app').trustedOrigins).toContain(
      'https://www.liveworkspace.app',
    );
    expect(options('https://staging.liveworkspace.app').trustedOrigins).toEqual([
      'https://www.liveplanner.app',
    ]);
    expect(options('not a url').trustedOrigins).toEqual(['https://www.liveplanner.app']);
  });

  it('clears a cookie on the domain and host-only, so a copy from before the move goes too', () => {
    expect(clearedCookies('lw_guest', '; Path=/', 'liveworkspace.app')).toEqual([
      'lw_guest=; Max-Age=0; Path=/; Domain=liveworkspace.app',
      'lw_guest=; Max-Age=0; Path=/',
    ]);
    expect(clearedCookies('lw_guest', '; Path=/', undefined)).toEqual([
      'lw_guest=; Max-Age=0; Path=/',
    ]);
  });
});

describe('withOwnCookies', () => {
  const SESSION = '__Secure-better-auth.session_token';
  const signed = async (token: string, secret: string) =>
    encodeURIComponent(`${token}.${await makeSignature(token, secret)}`);
  const cookieOf = async (cookie: string) =>
    (
      await withOwnCookies(
        new Request('https://staging.liveworkspace.app/', { headers: { cookie } }),
        SECRET,
      )
    ).headers.get('cookie');

  it('passes a request without a doubled name through as it came', async () => {
    const request = new Request('https://www.liveworkspace.app/', {
      headers: { cookie: `${SESSION}=a.b; theme=dark; theme=light` },
    });
    expect(await withOwnCookies(request, SECRET)).toBe(request);
    const bare = new Request('https://www.liveworkspace.app/');
    expect(await withOwnCookies(bare, SECRET)).toBe(bare);
  });

  it("keeps staging's own session when production's arrives first under the same name", async () => {
    const production = await signed('prodtoken', OTHER_SECRET);
    const staging = await signed('stagingtoken', SECRET);
    expect(await cookieOf(`${SESSION}=${production}; theme=dark; ${SESSION}=${staging}`)).toBe(
      `theme=dark; ${SESSION}=${staging}`,
    );
  });

  it('keeps the first copy signed here when both are, and none when neither is', async () => {
    const older = await signed('older', SECRET);
    const newer = await signed('newer', SECRET);
    expect(await cookieOf(`${SESSION}=${older}; ${SESSION}=${newer}`)).toBe(`${SESSION}=${older}`);
    expect(await cookieOf(`${SESSION}=x.y; ${SESSION}=%E0%A4%A; ${SESSION}=nodot`)).toBeNull();
  });

  it('checks guest cookies with their own signature', async () => {
    const ours = await signGuestCookie(`guest_${crypto.randomUUID()}`, SECRET);
    const theirs = await signGuestCookie(`guest_${crypto.randomUUID()}`, OTHER_SECRET);
    expect(await cookieOf(`${GUEST_COOKIE}=${theirs}; ${GUEST_COOKIE}=${ours}; a=1`)).toBe(
      `${GUEST_COOKIE}=${ours}; a=1`,
    );
  });

  // accounts.md "Staging never takes production's cookies".
  describe('outside production', () => {
    const onStaging = async (cookie: string) =>
      (
        await withOwnCookies(
          new Request('https://staging.liveworkspace.app/', { headers: { cookie } }),
          SECRET,
          'staging',
        )
      ).headers.get('cookie');

    it("drops production's session, guest and every other Better Auth cookie even when it comes alone", async () => {
      const production = await signed('prodtoken', OTHER_SECRET);
      const theirGuest = await signGuestCookie(`guest_${crypto.randomUUID()}`, OTHER_SECRET);
      expect(
        await onStaging(
          `${SESSION}=${production}; ${GUEST_COOKIE}=${theirGuest}; better-auth.state=${production}; theme=dark`,
        ),
      ).toBe('theme=dark');
      expect(await onStaging(`${SESSION}=${production}`)).toBeNull();
    });

    it("drops production's hand-off nonce outright, and keeps staging's own", async () => {
      expect(await onStaging(`lw_handoff=prodnonce; lw_handoff_staging=ournonce`)).toBe(
        'lw_handoff_staging=ournonce',
      );
    });

    it("keeps staging's own signed cookies, the first of each name", async () => {
      const ours = await signed('stagingtoken', SECRET);
      const ourGuest = await signGuestCookie(`guest_${crypto.randomUUID()}`, SECRET);
      const production = await signed('prodtoken', OTHER_SECRET);
      expect(
        await onStaging(
          `${SESSION}=${production}; ${SESSION}=${ours}; ${GUEST_COOKIE}=${ourGuest}; ${SESSION}=${ours}`,
        ),
      ).toBe(`${SESSION}=${ours}; ${GUEST_COOKIE}=${ourGuest}`);
    });

    it('passes a request with none of production’s cookies through as it came', async () => {
      const request = new Request('https://staging.liveworkspace.app/', {
        headers: { cookie: 'theme=dark' },
      });
      expect(await withOwnCookies(request, SECRET, 'staging')).toBe(request);
    });

    it('leaves production as it was: a single foreign cookie passes, for Better Auth to refuse', async () => {
      const production = await signed('prodtoken', OTHER_SECRET);
      const request = new Request('https://www.liveworkspace.app/', {
        headers: { cookie: `${SESSION}=${production}; lw_handoff=n` },
      });
      expect(await withOwnCookies(request, SECRET, 'production')).toBe(request);
    });
  });
});
