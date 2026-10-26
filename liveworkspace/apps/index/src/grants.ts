// Grants (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"): ES256 JWTs saying who may open an item
// at what level, valid for ten minutes, signed with the index's own key. Apps check them offline against
// GET /jwks.

import {
  GRANT_ALG,
  GRANT_LIFETIME_S,
  INDEX_API_PATH,
  type App,
  type GrantResponse,
  type Level,
} from '@liveworkspace/index-client';
import { exportJWK, generateKeyPair, importJWK, SignJWT, type JWK } from 'jose';
import { accountsUrl, type Env } from './env';

type SigningKey = { kid: string; privateKey: CryptoKey; publicJwk: JWK };

// Keyed by the secret's text, so a rotated secret takes effect on the next request.
let loaded: { secret: string; key: Promise<SigningKey> } | null = null;
// Development without a secret: one key per isolate, gone on restart.
let ephemeral: Promise<SigningKey> | null = null;

async function fromSecret(secret: string): Promise<SigningKey> {
  const jwk = JSON.parse(secret) as JWK;
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.d || !jwk.kid) {
    throw new Error('GRANT_SIGNING_KEY must be a private P-256 JWK with a kid');
  }
  const privateKey = (await importJWK(jwk, GRANT_ALG)) as CryptoKey;
  const { kty, crv, x, y, kid } = jwk;
  return { kid, privateKey, publicJwk: { kty, crv, x, y, kid, alg: GRANT_ALG, use: 'sig' } };
}

async function makeEphemeral(): Promise<SigningKey> {
  const pair = await generateKeyPair(GRANT_ALG, { extractable: true });
  const kid = `dev-${crypto.randomUUID().slice(0, 8)}`;
  const publicJwk = { ...(await exportJWK(pair.publicKey)), kid, alg: GRANT_ALG, use: 'sig' };
  console.log(
    `[index] GRANT_SIGNING_KEY is unset: signing grants with an ephemeral key (${kid}) for this isolate only`,
  );
  return { kid, privateKey: pair.privateKey, publicJwk };
}

// The key grants are signed with, or null where there is none (production without the secret).
export async function signingKey(env: Env): Promise<SigningKey | null> {
  const secret = env.GRANT_SIGNING_KEY?.trim();
  if (secret) {
    if (!loaded || loaded.secret !== secret) {
      const key = fromSecret(secret);
      loaded = { secret, key };
      // A bad secret is retried on the next request rather than cached as a failure.
      key.catch(() => {
        if (loaded?.key === key) loaded = null;
      });
    }
    return loaded.key;
  }
  if (env.ENVIRONMENT !== 'development') return null;
  ephemeral ??= makeEphemeral();
  return ephemeral;
}

export function grantIssuer(env: Env): string {
  return `${accountsUrl(env)}${INDEX_API_PATH}`;
}

export type GrantSubject = {
  app: App;
  // `user_…`, `guest_…` or `link:<code>`.
  sub: string;
  itemId: string;
  level: Level;
  tabId: string | null;
  // The item's owner and team as the index has them now: the item's Durable Object takes its copy from these
  // (@liveworkspace/index-app item-head.ts), so a guest's merge or a team move reaches it on the next grant.
  ownerId: string;
  teamId: string | null;
  // The item is in the Trash: its owner's and team's grant says so, so the app answers it as trashed.
  trashed?: boolean;
  // The share code the access came through, or null for the owner and the team: signed in, so an app reads link
  // access from the grant and never from a header the caller may leave off.
  link?: string | null;
};

export async function mintGrant(env: Env, subject: GrantSubject): Promise<GrantResponse | null> {
  const key = await signingKey(env);
  if (!key) return null;
  const now = Math.floor(Date.now() / 1000);
  const exp = now + GRANT_LIFETIME_S;
  const grant = await new SignJWT({
    item: subject.itemId,
    level: subject.level,
    tab: subject.tabId,
    team: subject.teamId,
    owner: subject.ownerId,
    ...(subject.trashed ? { trashed: true } : {}),
    ...(subject.link ? { link: subject.link } : {}),
  })
    .setProtectedHeader({ alg: GRANT_ALG, kid: key.kid, typ: 'JWT' })
    .setIssuer(grantIssuer(env))
    .setAudience(subject.app)
    .setSubject(subject.sub)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setJti(crypto.randomUUID())
    .sign(key.privateKey);
  return {
    grant,
    level: subject.level,
    tabId: subject.tabId,
    expiresAt: exp * 1000,
    ...(subject.trashed ? { trashed: true as const } : {}),
  };
}

export async function publicKeys(env: Env): Promise<{ keys: JWK[] } | null> {
  const key = await signingKey(env);
  return key ? { keys: [key.publicJwk] } : null;
}
