// Responses, CORS and request bodies for the subscription API (subscription.md "The subscription Worker").

import { readCappedBody } from '@liveworkspace/api-kit/request-body';
import { json } from '@liveworkspace/index-app/worker-http';
import type { SubscriptionError } from '@liveworkspace/subscription';
import { MAX_BODY_BYTES } from './config';
import type { Env } from './env';
import { isKnownOrigin } from './origins';

export { json };

const STATUS: Record<SubscriptionError, number> = {
  unauthorised: 401,
  bad_request: 400,
  not_found: 404,
  not_team_admin: 403,
  not_team_member: 403,
  already_subscribed: 409,
  not_subscribed: 409,
  invalid_state: 409,
  rate_limited: 429,
  billing_unavailable: 503,
  accounts_unavailable: 503,
};

/** A refusal, as `{ error }` with the status that goes with it. */
export function refusal(error: SubscriptionError, headers?: HeadersInit): Response {
  return json({ error }, { status: STATUS[error], headers });
}

export const notFound = () => refusal('not_found');
export const badRequest = () => refusal('bad_request');
export const methodNotAllowed = (allow: string) =>
  json({ error: 'method_not_allowed' }, { status: 405, headers: { Allow: allow } });

/** A request's JSON body as an object, or null when it is missing, too large or not an object. */
export async function readObject(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.body) return null;
  const bytes = await readCappedBody(request.body, MAX_BODY_BYTES);
  if (!bytes) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}

const ALLOWED_METHODS = 'GET, POST';
const ALLOWED_HEADERS = 'Content-Type, Authorization';

// The CORS headers for a browser route's answer. Only the site's and the apps' own pages are answered: every route
// but the prices is a signed-in person's or a billing session's. No cookies are read, so no credentials are allowed.
export function withCors(request: Request, env: Env, res: Response): Response {
  const origin = request.headers.get('Origin');
  const out = new Response(res.body, res);
  out.headers.append('Vary', 'Origin');
  if (origin && isKnownOrigin(env, origin)) out.headers.set('Access-Control-Allow-Origin', origin);
  return out;
}

/** The answer to a browser's preflight. */
export function preflight(request: Request, env: Env): Response {
  const origin = request.headers.get('Origin');
  const headers = new Headers({
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  });
  if (origin && isKnownOrigin(env, origin)) headers.set('Access-Control-Allow-Origin', origin);
  return new Response(null, { status: 204, headers });
}
