// Who is asking (liveworkspace/docs/drive.md "Who and what", "The service"):
//   - a person, by an accounts access token, checked offline against accounts' keys exactly as the index checks it
//     (issuer `${ACCOUNTS_URL}/api/auth`, any app API audience). A guest token is refused: a guest has no lasting
//     identity to attach a Google account to. So is anything else, an API token included;
//   - the index and accounts, each by its own key (DRIVE_KEY_INDEX, DRIVE_KEY_ACCOUNTS), compared in constant time.

import { createPersonVerifier } from '@liveworkspace/auth-client';
import { timingSafeEqual } from '@liveworkspace/index-app/timing-safe';
import { accountsUrl, audiences, setting, type Env } from './env';

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

/** The account id a request's access token names, or null: no token, a guest's, or one that doesn't check out. */
export async function accountOf(request: Request, env: Env): Promise<string | null> {
  const token = bearerOf(request);
  if (!token) return null;
  const verify = verifierFor(env);
  if (!verify) return null;
  const claims = await verify(token);
  return claims?.kind === 'account' ? claims.userId : null;
}

/** Whether a request carries `key` (unset: nobody does). */
export async function carriesKey(request: Request, key: string | undefined): Promise<boolean> {
  const expected = setting(key);
  const token = bearerOf(request);
  if (!expected || !token) return false;
  return timingSafeEqual(token, expected);
}
