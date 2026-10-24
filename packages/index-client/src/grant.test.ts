import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { GRANT_ISSUER } from './constants';
import { createGrantVerifier } from './grant';

let privateKey: CryptoKey;
let otherKey: CryptoKey;
let verify: ReturnType<typeof createGrantVerifier>;
let publicJwk: JWK;

beforeAll(async () => {
  const pair = await generateKeyPair('ES256');
  privateKey = pair.privateKey;
  otherKey = (await generateKeyPair('ES256')).privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'g1', alg: 'ES256' };
  publicJwk = jwk;
  verify = createGrantVerifier({
    jwksUrl: 'https://liveworkspace.app/api/index/jwks',
    audience: 'liveplanner',
    issuer: GRANT_ISSUER,
    keys: createLocalJWKSet({ keys: [jwk] }),
  });
});

const claims = {
  item: 'item-1',
  level: 'edit',
  tab: null,
  team: null,
};

function grant(
  extra: Record<string, unknown> = {},
  opts: { aud?: string; iss?: string; exp?: string; key?: CryptoKey; kid?: string } = {},
) {
  return new SignJWT({ ...claims, ...extra })
    .setProtectedHeader({ alg: 'ES256', kid: opts.kid ?? 'g1' })
    .setIssuer(opts.iss ?? GRANT_ISSUER)
    .setAudience(opts.aud ?? 'liveplanner')
    .setSubject('user_1')
    .setIssuedAt()
    .setJti('j1')
    .setExpirationTime(opts.exp ?? '10m')
    .sign(opts.key ?? privateKey);
}

describe('createGrantVerifier', () => {
  it('reads a valid grant', async () => {
    const out = await verify(await grant({ tab: 'tab-2', team: 'team-1', level: 'view' }));
    expect(out).toMatchObject({
      iss: GRANT_ISSUER,
      aud: 'liveplanner',
      sub: 'user_1',
      item: 'item-1',
      level: 'view',
      tab: 'tab-2',
      team: 'team-1',
      jti: 'j1',
    });
    expect(out!.exp - out!.iat).toBe(600);
  });

  it("reads the item's owner, and a grant signed before it was named", async () => {
    expect(await verify(await grant({ owner: 'user_9' }))).toMatchObject({ owner: 'user_9' });
    const before = await verify(await grant());
    expect(before).not.toBeNull();
    expect(before).not.toHaveProperty('owner');
    await expect(verify(await grant({ owner: 7 }))).resolves.toBeNull();
    await expect(verify(await grant({ owner: '' }))).resolves.toBeNull();
  });

  it('reads an item in the Trash, and nothing else as one', async () => {
    expect(await verify(await grant({ trashed: true }))).toMatchObject({ trashed: true });
    expect(await verify(await grant({ trashed: 'yes' }))).not.toHaveProperty('trashed');
    expect(await verify(await grant())).not.toHaveProperty('trashed');
  });

  it("refuses another app's grant", async () => {
    await expect(verify(await grant({}, { aud: 'livediagram' }))).resolves.toBeNull();
  });

  it('refuses another issuer, an expired grant and a forged signature', async () => {
    await expect(verify(await grant({}, { iss: 'https://evil.example' }))).resolves.toBeNull();
    await expect(verify(await grant({}, { exp: '-1m' }))).resolves.toBeNull();
    await expect(verify(await grant({}, { key: otherKey }))).resolves.toBeNull();
  });

  it('refuses a grant with a malformed level or item, and garbage', async () => {
    await expect(verify(await grant({ level: 'owner' }))).resolves.toBeNull();
    await expect(verify(await grant({ item: '' }))).resolves.toBeNull();
    await expect(verify(await grant({ tab: 7 }))).resolves.toBeNull();
    await expect(verify('not-a-jwt')).resolves.toBeNull();
    await expect(verify('')).resolves.toBeNull();
  });

  it('refuses an HS256 token even when it names a known kid', async () => {
    const hs = await new SignJWT({ ...claims })
      .setProtectedHeader({ alg: 'HS256', kid: 'g1' })
      .setIssuer(GRANT_ISSUER)
      .setAudience('liveplanner')
      .setSubject('user_1')
      .setIssuedAt()
      .setJti('j1')
      .setExpirationTime('10m')
      .sign(new TextEncoder().encode('x'.repeat(32)));
    await expect(verify(hs)).resolves.toBeNull();
  });

  it('skips the issuer check when none is configured', async () => {
    const loose = createGrantVerifier({
      jwksUrl: 'http://localhost:8793/api/index/jwks',
      audience: 'liveplanner',
      keys: createLocalJWKSet({ keys: [publicJwk] }),
    });
    await expect(
      loose(await grant({}, { iss: 'http://localhost:3000/api/index' })),
    ).resolves.not.toBeNull();
  });
});
