// Who writes in the Forum (liveworkspace/docs/specs/007-community/community.md "Forum routes"): a signed-in account,
// by its access token, checked offline against accounts' published keys exactly as the index and the Drive service
// check it (issuer `${ACCOUNTS_URL}/api/auth`, any app API audience). A guest token is refused, and so is anything
// else: an API token, an expired, forged or misaddressed one.

import { createVerifier } from '@liveworkspace/auth-client';
import { accountsUrl, audiences, type Env } from '../env';

type Verify = ReturnType<typeof createVerifier>;

// One verifier per issuer and audience list for the life of the isolate: it caches accounts' key set.
const verifiers = new Map<string, Verify>();

function verifierFor(env: Env): Verify | null {
  const list = audiences(env);
  if (list.length === 0) return null;
  const issuer = `${accountsUrl(env)}/api/auth`;
  const key = `${issuer} ${list.join(',')}`;
  let verify = verifiers.get(key);
  if (!verify) {
    verify = createVerifier({ issuer, audience: list, keysFrom: env.ACCOUNTS });
    verifiers.set(key, verify);
  }
  return verify;
}

/** The bearer token a request carries, or null. A split rather than a pattern, so a long header costs one pass. */
export function bearerOf(request: Request): string | null {
  const header = request.headers.get('Authorization')?.trim() ?? '';
  const space = header.indexOf(' ');
  if (space < 0 || header.slice(0, space).toLowerCase() !== 'bearer') return null;
  const token = header.slice(space + 1).trim();
  return token && !token.includes(' ') ? token : null;
}

/** The account id a request's access token names, or null. */
export async function forumAccountOf(request: Request, env: Env): Promise<string | null> {
  const token = bearerOf(request);
  if (!token) return null;
  const verify = verifierFor(env);
  if (!verify) return null;
  return (await verify(token))?.userId ?? null;
}
