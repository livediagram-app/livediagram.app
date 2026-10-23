// Who is asking (liveworkspace/docs/one-explorer-contracts.md "Reaching the index"):
//   - a person, by an accounts access token or a guest token, checked offline against accounts' keys;
//   - a link visitor, by a share code (and its password), with or without a person;
//   - an app's server, by its key and X-Index-App;
//   - accounts, by the merge key.

import { createPersonVerifier } from '@liveworkspace/auth-client';
import {
  INDEX_APP_HEADER,
  isApp,
  SHARE_CODE_HEADER,
  SHARE_PASSWORD_HEADER,
  type App,
} from '@liveworkspace/index-client';
import { isShareCode } from './codec';
import { accountsUrl, appKey, audiences, type Env } from './env';
import { timingSafeEqual } from './timing-safe';

export type Person = {
  id: string;
  kind: 'account' | 'guest';
  // The teams the person has joined, from their token's claim. A guest has none.
  teams: string[];
};

export type ShareCredentials = { code: string; password: string | null };

export type Caller = { person: Person | null; share: ShareCredentials | null };

type Verify = ReturnType<typeof createPersonVerifier>;

// One verifier per issuer and audience list for the life of the isolate: it caches accounts' key set.
const verifiers = new Map<string, Verify>();

function verifierFor(env: Env): Verify | null {
  const list = audiences(env);
  if (list.length === 0) return null;
  const issuer = `${accountsUrl(env)}/api/auth`;
  const key = `${issuer} ${list.join(',')}`;
  let verify = verifiers.get(key);
  if (!verify) {
    verify = createPersonVerifier({ issuer, audience: list });
    verifiers.set(key, verify);
  }
  return verify;
}

export const bearerOf = (request: Request): string | null =>
  request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;

// The person a request's bearer token names, or null for none (or one that doesn't check out).
export async function personOf(request: Request, env: Env): Promise<Person | null> {
  const token = bearerOf(request);
  if (!token) return null;
  const verify = verifierFor(env);
  if (!verify) return null;
  const claims = await verify(token);
  if (!claims) return null;
  if (claims.kind === 'guest') return { id: claims.guestId, kind: 'guest', teams: [] };
  return {
    id: claims.userId,
    kind: 'account',
    teams: (claims.teams ?? []).map((team) => team.id),
  };
}

export function shareOf(request: Request): ShareCredentials | null {
  const code = request.headers.get(SHARE_CODE_HEADER);
  if (!isShareCode(code)) return null;
  const password = request.headers.get(SHARE_PASSWORD_HEADER);
  return { code: code.toUpperCase(), password: password || null };
}

export async function callerOf(request: Request, env: Env): Promise<Caller> {
  return { person: await personOf(request, env), share: shareOf(request) };
}

// The app this request speaks for, or null when it doesn't carry that app's key.
export async function callerApp(request: Request, env: Env): Promise<App | null> {
  const app = request.headers.get(INDEX_APP_HEADER);
  if (!isApp(app)) return null;
  const expected = appKey(env, app);
  const token = bearerOf(request);
  if (!expected || !token) return null;
  return (await timingSafeEqual(token, expected)) ? app : null;
}

export async function isMergeCaller(request: Request, env: Env): Promise<boolean> {
  const expected = env.MERGE_KEY?.trim();
  const token = bearerOf(request);
  if (!expected || !token) return false;
  return timingSafeEqual(token, expected);
}

// The spaces a person's own things live in: theirs, and each team they have joined.
export const personalScope = (personId: string) => `p:${personId}`;
export const teamScope = (teamId: string) => `t:${teamId}`;
export const scopeOf = (ownerId: string, teamId: string | null) =>
  teamId ? teamScope(teamId) : personalScope(ownerId);

export function scopesOf(person: Person): string[] {
  return [personalScope(person.id), ...person.teams.map(teamScope)];
}
