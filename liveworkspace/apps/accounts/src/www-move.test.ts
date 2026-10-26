import { makeSignature } from 'better-auth/crypto';
import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { authOptions } from './auth-options.ts';
import type { Auth } from './auth.ts';
import { clearedCookies, cookieDomain, domainAttribute } from './cookie-scope.ts';
import { GUEST_COOKIE, signGuestCookie } from './guests.ts';
import { introspectWithLegacy, legacyIssuer } from './legacy-issuer.ts';
import { withOwnCookies } from './own-cookies.ts';
import { RESOURCES } from './resources.ts';

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
});

describe('an access token minted under the bare issuer', () => {
  const env = { BASE_URL: 'https://www.liveworkspace.app', ENVIRONMENT: 'production' as const };
  const BARE_ISSUER = 'https://liveworkspace.app/api/auth';
  const AUDIENCE = RESOURCES.production[1]!;
  let privateKey: CryptoKey;
  let jwk: JWK;
  let strangerKey: CryptoKey;
  const sessions = new Map<string, { expiresAt: Date }>();
  const auth = {
    api: { getJwks: async () => ({ keys: [jwk] }) },
    $context: Promise.resolve({
      adapter: {
        findOne: async ({ where }: { where: { value: string }[] }) =>
          sessions.get(where[0]!.value) ?? null,
      },
    }),
  } as unknown as Auth;

  beforeAll(async () => {
    const pair = await generateKeyPair('EdDSA', { extractable: true });
    privateKey = pair.privateKey;
    jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'EdDSA' };
    strangerKey = (await generateKeyPair('EdDSA')).privateKey;
    sessions.set('live', { expiresAt: new Date(Date.now() + 60_000) });
    sessions.set('ended', { expiresAt: new Date(Date.now() - 60_000) });
  });

  const mint = (claims: Record<string, unknown>, key = privateKey, issuer = BARE_ISSUER) =>
    new SignJWT({ azp: 'planner', sid: 'live', ...claims })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'k1' })
      .setIssuer(issuer)
      .setAudience(AUDIENCE)
      .setSubject('user_1')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(key);

  // Better Auth's own answer for any token not under its issuer.
  const inactive = async () => Response.json({ active: false });
  const check = (token: string, introspect = inactive, clientId = 'planner') =>
    introspectWithLegacy(introspect, token, clientId, env, auth);

  it('names the bare issuer as the legacy one, and none where there is no twin', () => {
    expect(legacyIssuer(env)).toBe(BARE_ISSUER);
    expect(legacyIssuer({ BASE_URL: 'https://staging.liveworkspace.app/' })).toBeNull();
  });

  it('is still vouched for after the move, as the provider would have', async () => {
    expect(await check(await mint({}))).toEqual({
      status: 200,
      result: { active: true, sub: 'user_1', client_id: 'planner' },
    });
    expect((await check(await mint({ sid: undefined }))).result.active).toBe(true);
  });

  it('stays refused when anything else is wrong', async () => {
    const refused = [
      await mint({}, strangerKey),
      await mint({}, privateKey, 'https://evil.example/api/auth'),
      await mint({ azp: 'another-client' }),
      await mint({ sid: 'ended' }),
      await mint({ sid: 'gone' }),
      'not-a-jwt',
    ];
    for (const token of refused) {
      expect((await check(token)).result.active).toBe(false);
    }
  });

  it('never second-guesses a wrong client secret, nor an active answer', async () => {
    const token = await mint({});
    expect(await check(token, async () => Response.json({ error: 'x' }, { status: 401 }))).toEqual({
      status: 401,
      result: { error: 'x' },
    });
    const active = { active: true, sub: 'user_2' };
    expect(await check(token, async () => Response.json(active))).toEqual({
      status: 200,
      result: active,
    });
  });

  it('is never checked on staging, which has no twin', async () => {
    const token = await mint({});
    const staging = {
      BASE_URL: 'https://staging.liveworkspace.app',
      ENVIRONMENT: 'staging' as const,
    };
    expect(
      (await introspectWithLegacy(inactive, token, 'planner', staging, auth)).result.active,
    ).toBe(false);
  });
});
