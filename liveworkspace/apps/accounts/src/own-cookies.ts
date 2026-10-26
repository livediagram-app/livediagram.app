// Two cookies of one name, and only one of them ours (liveworkspace/docs/specs/003-accounts/accounts.md "The move to www."). Production's
// cookies are on `Domain=liveworkspace.app`, so they reach staging.liveworkspace.app beside staging's own, under the
// same names; and on the bare domain a host-only copy from before the move can sit beside the domain one. Better
// Auth reads the first cookie of a name and the browser sends the older first, so the wrong one could win. Before
// anything reads a request, a name that comes more than once keeps only its first copy signed with this Worker's
// secret. A request without a doubled name passes untouched, at the cost of one split.

import { makeSignature } from 'better-auth/crypto';
import { GUEST_COOKIE, readGuestCookie } from './guests.ts';

// Better Auth's signed cookies, with or without the secure prefix.
const SIGNED_AUTH_COOKIE = /^(?:__Secure-)?better-auth\.(?:session_token|dont_remember)$/;

const nameOf = (pair: string) => pair.slice(0, Math.max(pair.indexOf('='), 0)).trim();
const valueOf = (pair: string) => pair.slice(pair.indexOf('=') + 1).trim();

const isChecked = (name: string) => name === GUEST_COOKIE || SIGNED_AUTH_COOKIE.test(name);

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

/** `request` with each doubled signed cookie narrowed to its first copy signed here (none, when no copy is). */
export async function withOwnCookies(request: Request, secret: string): Promise<Request> {
  const header = request.headers.get('cookie');
  if (!header) return request;
  const pairs = header
    .split(';')
    .map((pair) => pair.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const doubled = new Set<string>();
  for (const pair of pairs) {
    const name = nameOf(pair);
    if (seen.has(name) && isChecked(name)) doubled.add(name);
    seen.add(name);
  }
  if (doubled.size === 0) return request;

  const kept: string[] = [];
  const chosen = new Set<string>();
  for (const pair of pairs) {
    const name = nameOf(pair);
    if (!doubled.has(name)) kept.push(pair);
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
