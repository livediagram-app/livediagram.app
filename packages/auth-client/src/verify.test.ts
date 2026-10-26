import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { createPersonVerifier, createVerifier } from './verify';

const ISSUER = 'https://liveworkspace.app/api/auth';
const AUDIENCE = 'https://livediagram-router.liveworkspace-easing509.workers.dev/api';

let privateKey: CryptoKey;
let verify: ReturnType<typeof createVerifier>;
let verifyPerson: ReturnType<typeof createPersonVerifier>;
let keys: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const pair = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  privateKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'EdDSA' };
  keys = createLocalJWKSet({ keys: [jwk] });
  verify = createVerifier({ issuer: ISSUER, audience: AUDIENCE, keys });
  verifyPerson = createPersonVerifier({
    issuer: ISSUER,
    audience: [AUDIENCE, 'https://liveplanner.app/api'],
    keys,
  });
});

function token(
  claims: Record<string, unknown>,
  overrides: { aud?: string; iss?: string; exp?: string } = {},
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'EdDSA', kid: 'k1' })
    .setIssuer(overrides.iss ?? ISSUER)
    .setAudience(overrides.aud ?? AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(overrides.exp ?? '5m')
    .sign(privateKey);
}

describe('createVerifier', () => {
  it('reads the account from a valid token', async () => {
    const jwt = await token({
      sub: 'user_2abc',
      email: 'ada@example.com',
      email_verified: true,
      scope: 'openid email',
    });
    await expect(verify(jwt)).resolves.toEqual({
      userId: 'user_2abc',
      email: 'ada@example.com',
      emailVerified: true,
      scopes: ['openid', 'email'],
      teams: null,
    });
  });

  it('reads the teams the token carries, dropping malformed entries', async () => {
    const jwt = await token({
      sub: 'user_2abc',
      teams: [
        { id: 't1', name: 'Design', role: 'admin' },
        { id: 't2', name: 'Ops', role: 'owner' },
        'nonsense',
      ],
    });
    await expect(verify(jwt)).resolves.toMatchObject({
      teams: [{ id: 't1', name: 'Design', role: 'admin' }],
    });
  });

  it('refuses a token minted for another app', async () => {
    const jwt = await token({ sub: 'user_2abc' }, { aud: 'https://liveplanner.app/api' });
    await expect(verify(jwt)).resolves.toBeNull();
  });

  it('refuses a token from another issuer', async () => {
    const jwt = await token({ sub: 'user_2abc' }, { iss: 'https://evil.example' });
    await expect(verify(jwt)).resolves.toBeNull();
  });

  it('refuses an expired token', async () => {
    const jwt = await token({ sub: 'user_2abc' }, { exp: '-1m' });
    await expect(verify(jwt)).resolves.toBeNull();
  });

  it('refuses a token with no subject', async () => {
    await expect(verify(await token({}))).resolves.toBeNull();
  });

  it('refuses garbage', async () => {
    await expect(verify('not.a.jwt')).resolves.toBeNull();
  });

  it('treats a missing email as unverified', async () => {
    await expect(verify(await token({ sub: 'user_x' }))).resolves.toMatchObject({
      email: null,
      emailVerified: false,
      scopes: [],
    });
  });
});

describe('guest tokens and several audiences', () => {
  it('refuses a guest token where only accounts are let in', async () => {
    const jwt = await token({ sub: 'guest_0b7a2b6e-3f1c', kind: 'guest' });
    await expect(verify(jwt)).resolves.toBeNull();
  });

  it('reads a guest, and an account for any listed audience', async () => {
    const guest = await token({ sub: 'guest_0b7a2b6e-3f1c', kind: 'guest' });
    await expect(verifyPerson(guest)).resolves.toEqual({
      kind: 'guest',
      guestId: 'guest_0b7a2b6e-3f1c',
    });
    const account = await token(
      { sub: 'user_1', teams: [{ id: 't1', name: 'Ops', role: 'member' }] },
      { aud: 'https://liveplanner.app/api' },
    );
    await expect(verifyPerson(account)).resolves.toMatchObject({
      kind: 'account',
      userId: 'user_1',
      teams: [{ id: 't1', name: 'Ops', role: 'member' }],
    });
  });

  it('refuses an unlisted audience and a guest token without a guest id', async () => {
    const other = await token({ sub: 'user_1' }, { aud: 'https://livedesign.app/api' });
    await expect(verifyPerson(other)).resolves.toBeNull();
    const bad = await token({ sub: 'user_1', kind: 'guest' });
    await expect(verifyPerson(bad)).resolves.toBeNull();
  });
});

// The move to www. (liveworkspace/docs/specs/003-accounts/accounts.md "The move to www."): a token minted under the bare issuer before the
// move keeps validating once a check is configured with the www. one, and the other way round, for the transition.
describe('the move to www.', () => {
  const BARE_ISSUER = 'https://liveworkspace.app/api/auth';
  const WWW_ISSUER = 'https://www.liveworkspace.app/api/auth';
  const PLANNER = 'https://liveplanner.app/api';
  const account = { sub: 'user_2abc', email: 'ada@example.com', email_verified: true };

  it('a check on the www. issuer accepts an access token minted under the bare one', async () => {
    const onWww = createVerifier({ issuer: WWW_ISSUER, audience: PLANNER, keys });
    const old = await token(account, { iss: BARE_ISSUER, aud: PLANNER });
    await expect(onWww(old)).resolves.toMatchObject({ userId: 'user_2abc' });
    const fresh = await token(account, { iss: WWW_ISSUER, aud: PLANNER });
    await expect(onWww(fresh)).resolves.toMatchObject({ userId: 'user_2abc' });
  });

  it('a check still on the bare issuer accepts a token minted under www., so deploy order signs nobody out', async () => {
    const onBare = createVerifier({ issuer: BARE_ISSUER, audience: PLANNER, keys });
    const fresh = await token(account, { iss: WWW_ISSUER, aud: PLANNER });
    await expect(onBare(fresh)).resolves.toMatchObject({ userId: 'user_2abc' });
  });

  it('a year-long guest token minted under the bare issuer still names its guest', async () => {
    const people = createPersonVerifier({ issuer: WWW_ISSUER, audience: [PLANNER], keys });
    const guest = await token(
      { sub: 'guest_0f8c1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b', kind: 'guest' },
      { iss: BARE_ISSUER, aud: PLANNER, exp: '365d' },
    );
    await expect(people(guest)).resolves.toEqual({
      kind: 'guest',
      guestId: 'guest_0f8c1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b',
    });
  });

  it('accepts the www. twin of an audience, and still refuses another app or a stranger issuer', async () => {
    const onBare = createVerifier({ issuer: BARE_ISSUER, audience: PLANNER, keys });
    await expect(
      onBare(await token(account, { aud: 'https://www.liveplanner.app/api' })),
    ).resolves.toMatchObject({ userId: 'user_2abc' });
    await expect(
      onBare(await token(account, { aud: 'https://www.livedesign.app/api' })),
    ).resolves.toBeNull();
    for (const iss of [
      'https://staging.liveworkspace.app/api/auth',
      'https://www.liveworkspace.app/api/index',
      'https://evil.example/api/auth',
    ]) {
      await expect(onBare(await token(account, { iss, aud: PLANNER })), iss).resolves.toBeNull();
    }
  });

  it('staging and stand-in names get no twin', async () => {
    const staging = createVerifier({
      issuer: 'https://staging.liveworkspace.app/api/auth',
      audience: AUDIENCE,
      keys,
    });
    await expect(staging(await token(account, { iss: BARE_ISSUER }))).resolves.toBeNull();
    await expect(
      staging(await token(account, { iss: 'https://staging.liveworkspace.app/api/auth' })),
    ).resolves.toMatchObject({ userId: 'user_2abc' });
  });
});
