// Who a browser route's caller is (subscription.md "The subscription Worker"): a signed-in account, by its access
// token, checked offline against accounts' published keys exactly as the index, Drive and the Forum check it (issuer
// `${ACCOUNTS_URL}/api/auth`, any app API audience). A guest's token is refused, and so is anything else.

import { createPersonVerifier, type TeamClaim } from '@liveworkspace/auth-client';
import { accountsUrl, audiences, type Env } from './env';

type Verify = ReturnType<typeof createPersonVerifier>;

// One verifier per issuer and audience list for the life of the isolate: it caches accounts' key set. Kept with the
// binding it was built over, so an env with another binding (a test's) builds its own.
const verifiers = new Map<string, { via: Env['ACCOUNTS']; verify: Verify }>();

function verifierFor(env: Env): Verify | null {
  const list = audiences(env);
  if (list.length === 0) return null;
  const issuer = `${accountsUrl(env)}/api/auth`;
  const key = `${issuer} ${list.join(',')}`;
  const held = verifiers.get(key);
  if (held && held.via === env.ACCOUNTS) return held.verify;
  const verify = createPersonVerifier({ issuer, audience: list, keysFrom: env.ACCOUNTS });
  verifiers.set(key, { via: env.ACCOUNTS, verify });
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

/** The signed-in account behind a request. Its teams are the token's claim, up to 15 minutes old. */
export type Caller = { userId: string; email: string | null; teams: TeamClaim[] };

export async function callerOf(request: Request, env: Env): Promise<Caller | null> {
  const token = bearerOf(request);
  if (!token) return null;
  const verify = verifierFor(env);
  if (!verify) return null;
  const person = await verify(token);
  if (!person || person.kind !== 'account') return null;
  return { userId: person.userId, email: person.email, teams: person.teams ?? [] };
}
