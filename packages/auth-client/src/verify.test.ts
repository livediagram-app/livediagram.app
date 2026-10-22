import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { createVerifier } from './verify';

const ISSUER = 'https://liveworkspace.app/api/auth';
const AUDIENCE = 'https://livediagram.app/api';

let privateKey: CryptoKey;
let verify: ReturnType<typeof createVerifier>;

beforeAll(async () => {
  const pair = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  privateKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'EdDSA' };
  verify = createVerifier({
    issuer: ISSUER,
    audience: AUDIENCE,
    keys: createLocalJWKSet({ keys: [jwk] }),
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
