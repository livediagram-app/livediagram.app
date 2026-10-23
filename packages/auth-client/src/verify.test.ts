import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { createPersonVerifier, createVerifier } from './verify';

const ISSUER = 'https://liveworkspace.app/api/auth';
const AUDIENCE = 'https://livediagram.app/api';

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
