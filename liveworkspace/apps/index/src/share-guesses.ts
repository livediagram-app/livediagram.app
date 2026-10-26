// Share-password guesses (liveworkspace/docs/one-explorer-contracts.md "Sharing and access"): each try at an item's
// password that this isolate hasn't already found right is counted twice, at Cloudflare's edge so the counts hold
// across isolates: once against the visitor's network (SHARE_GUESS_VISITOR_LIMITER, 10 a minute) and once against
// the item, whatever the network (SHARE_GUESS_ITEM_LIMITER, 30 a minute), so a guesser can't spread tries across
// addresses either. Over either, the try is refused before the password is checked: 429 `rate_limited`, with
// Retry-After. A visit without a password, or with one already checked here, spends nothing, so a visitor already in
// isn't counted again on every grant renewal.

import { clientRateKey } from '@liveworkspace/api-kit/client-ip';
import { expandIpv6 } from '@liveworkspace/sites/network';
import { WORKSPACE_CLIENT_IP_HEADER } from '@liveworkspace/sites/workspace-proxy';
import { SHARE_GUESS_RETRY_AFTER_S } from './config';
import type { Env } from './env';
import { json } from './http';

/**
 * Whose network a guess comes from, or null when the request can't say:
 *   - through an app's router, the visitor's address the router names (`X-Liveworkspace-Client-IP`), kept apart from
 *     direct callers (`via:`) since a caller could name any address there;
 *   - from an app's server asking for a visitor (a Worker's subrequest, which Cloudflare marks `CF-Worker`), null: its
 *     address is Cloudflare's, shared by every visitor of every app, so only the item's limit applies;
 *   - otherwise the connection's own, as every api keys its limits (api-kit's clientRateKey).
 * IPv4 keeps the exact address and IPv6 its /64.
 */
export function guessVisitorOf(request: Request): string | null {
  const named = request.headers.get(WORKSPACE_CLIENT_IP_HEADER)?.trim();
  if (named) {
    const hextets = expandIpv6(named);
    return `via:${hextets ? `${hextets.slice(0, 4).join(':')}::/64` : named}`;
  }
  if (request.headers.has('CF-Worker')) return null;
  return clientRateKey(request);
}

/** The refusal for a guess over either limit, or null when it may be checked. Counts the try. */
export async function guessRefusal(
  env: Env,
  itemId: string,
  visitor: string | null,
): Promise<Response | null> {
  const [byVisitor, byItem] = await Promise.all([
    visitor && env.SHARE_GUESS_VISITOR_LIMITER
      ? env.SHARE_GUESS_VISITOR_LIMITER.limit({ key: visitor })
      : null,
    env.SHARE_GUESS_ITEM_LIMITER
      ? env.SHARE_GUESS_ITEM_LIMITER.limit({ key: `item:${itemId}` })
      : null,
  ]);
  if (byVisitor?.success === false || byItem?.success === false) {
    return json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(SHARE_GUESS_RETRY_AFTER_S) } },
    );
  }
  return null;
}
