// Two cookies of one name, and only one of them ours (liveworkspace/docs/specs/003-accounts/accounts.md "The move to www."). Production's
// cookies are on `Domain=liveworkspace.app`, so they reach staging.liveworkspace.app beside staging's own, under the
// same names; and on the bare domain a host-only copy from before the move can sit beside the domain one. Better
// Auth reads the first cookie of a name and the browser sends the older first, so the wrong one could win. Before
// anything reads a request, a name that comes more than once keeps only its first copy signed with this Worker's
// secret. A request without a doubled name passes untouched, at the cost of one split.
//
// Outside production ("Staging never takes production's cookies"), a signed cookie not signed here goes whether or
// not it is doubled, and production's hand-off nonce (unsigned, so it can't be told apart) goes outright: staging's
// own nonce has another name (handoff.ts handoffNonceCookie). So nothing on staging ever reads a production cookie.

import { makeSignature } from 'better-auth/crypto';
import type { Env } from './env.ts';
import { GUEST_COOKIE, readGuestCookie } from './guests.ts';
import { HANDOFF_NONCE_COOKIE } from './handoff.ts';

// Better Auth's session and dont_remember, with or without the secure prefix: what production ever sends doubled.
const SIGNED_AUTH_COOKIE = /^(?:__Secure-)?better-auth\.(?:session_token|dont_remember)$/;
// Every Better Auth cookie, outside production: each one it sets here is signed.
const ANY_AUTH_COOKIE = /^(?:__Secure-)?better-auth\./;

const nameOf = (pair: string) => pair.slice(0, Math.max(pair.indexOf('='), 0)).trim();
const valueOf = (pair: string) => pair.slice(pair.indexOf('=') + 1).trim();

const isChecked = (name: string) => name === GUEST_COOKIE || SIGNED_AUTH_COOKIE.test(name);
const isSignedOutsideProduction = (name: string) =>
  name === GUEST_COOKIE || ANY_AUTH_COOKIE.test(name);

async function signedHere(name: string, value: string, secret: string): Promise<boolean> {
  if (name === GUEST_COOKIE) return (await readGuestCookie(value, secret)) !== null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return false;
  }
  const dot = decoded.lastIndexOf('.');
  if (dot <= 0) return false;
  return (await makeSignature(decoded.slice(0, dot), secret)) === decoded.slice(dot + 1);
}

/** `request` with each doubled signed cookie narrowed to its first copy signed here (none, when no copy is); outside
 *  production, with every signed cookie not signed here, and production's hand-off nonce, gone as well. */
export async function withOwnCookies(
  request: Request,
  secret: string,
  environment: Env['ENVIRONMENT'] = 'production',
): Promise<Request> {
  const header = request.headers.get('cookie');
  if (!header) return request;
  const pairs = header
    .split(';')
    .map((pair) => pair.trim())
    .filter(Boolean);
  const strict = environment !== 'production';
  const seen = new Set<string>();
  const doubled = new Set<string>();
  let foreign = false;
  for (const pair of pairs) {
    const name = nameOf(pair);
    if (seen.has(name) && isChecked(name)) doubled.add(name);
    if (strict && (name === HANDOFF_NONCE_COOKIE || isSignedOutsideProduction(name)))
      foreign = true;
    seen.add(name);
  }
  if (doubled.size === 0 && !foreign) return request;

  const kept: string[] = [];
  const chosen = new Set<string>();
  for (const pair of pairs) {
    const name = nameOf(pair);
    if (strict && name === HANDOFF_NONCE_COOKIE) continue;
    const verify = doubled.has(name) || (strict && isSignedOutsideProduction(name));
    if (!verify) kept.push(pair);
    else if (!chosen.has(name) && (await signedHere(name, valueOf(pair), secret))) {
      kept.push(pair);
      chosen.add(name);
    }
  }
  const headers = new Headers(request.headers);
  if (kept.length > 0) headers.set('cookie', kept.join('; '));
  else headers.delete('cookie');
  return new Request(request, { headers });
}
