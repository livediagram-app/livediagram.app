// Share-password guesses (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Sharing and access"): each try at
// an item's password that this isolate hasn't already found right is counted at Cloudflare's edge, so the counts hold
// across isolates. Over a limit the answer is 429 `rate_limited`, with Retry-After.
//   - A visitor's try counts against their network (SHARE_GUESS_VISITOR_LIMITER, 10 a minute) before the password is
//     checked (guessRefusal), so no network can make the index derive more than that many PBKDF2 hashes a minute.
//   - Then it is checked. The right password opens the item, however many wrong ones others have sent, so a stranger
//     with the link can't lock its real visitors out. A wrong one counts against the item, whatever the network
//     (SHARE_GUESS_ITEM_LIMITER, 30 a minute), and over that is 429 rather than 403 (wrongGuessRefusal).
//   - A try that names no visitor (an app's server) counts against the item before it is checked: its only bound.
// A visit without a password, or with one already checked here, spends nothing, so a visitor already in isn't counted
// again on every grant renewal.

import { addressRateKey, clientRateKey } from '@liveworkspace/api-kit/client-ip';
import { trustedClientAddress } from '@liveworkspace/sites/network';
import { SHARE_GUESS_RETRY_AFTER_S } from './config';
import type { Env } from './env';
import { fail, json } from './http';

/**
 * Whose network a guess comes from, or null when the request can't say:
 *   - through an app's router, the visitor's address the router names (`X-Liveworkspace-Client-IP`) beside the
 *     routers' secret (`WORKSPACE_PROXY_SECRET`; unset, as named), kept apart from direct callers (`via:`). Named
 *     without the secret, it is ignored, so a direct caller can't rotate made-up addresses past the visitor's limit;
 *   - from an app's server asking for a visitor (a Worker's subrequest, which Cloudflare marks `CF-Worker`), null: its
 *     address is Cloudflare's, shared by every visitor of every app, so only the item's limit applies;
 *   - otherwise the connection's own, as every api keys its limits (api-kit's clientRateKey).
 * IPv4 keeps the exact address and IPv6 its /64 (an IPv4-mapped IPv6 address is its IPv4 address).
 */
export function guessVisitorOf(
  request: Request,
  env: Pick<Env, 'WORKSPACE_PROXY_SECRET'>,
): string | null {
  const named = trustedClientAddress(request, env.WORKSPACE_PROXY_SECRET);
  if (named) return `via:${addressRateKey(named)}`;
  if (request.headers.has('CF-Worker')) return null;
  return clientRateKey(request);
}

const rateLimited = (): Response =>
  json(
    { error: 'rate_limited' },
    { status: 429, headers: { 'Retry-After': String(SHARE_GUESS_RETRY_AFTER_S) } },
  );

/** The refusal for a guess over its limit before it is checked, or null when it may be checked. Counts the try: a
 *  visitor's against their network, one with no visitor against the item. */
export async function guessRefusal(
  env: Env,
  itemId: string,
  visitor: string | null,
): Promise<Response | null> {
  const outcome = visitor
    ? await env.SHARE_GUESS_VISITOR_LIMITER?.limit({ key: visitor })
    : await env.SHARE_GUESS_ITEM_LIMITER?.limit({ key: `item:${itemId}` });
  return outcome?.success === false ? rateLimited() : null;
}

/** The answer to a wrong guess: a visitor's counts against the item now (one with no visitor already has), and over
 *  the item's limit is 429; otherwise 403 `password_invalid`. */
export async function wrongGuessRefusal(
  env: Env,
  itemId: string,
  visitor: string | null,
): Promise<Response> {
  if (visitor) {
    const outcome = await env.SHARE_GUESS_ITEM_LIMITER?.limit({ key: `item:${itemId}` });
    if (outcome?.success === false) return rateLimited();
  }
  return fail(403, 'password_invalid');
}
