// A share link's sign-in rule for an API client (the MCP server's share_* tools, the CLI's `share`, any script with an
// `lwt_` token): `POST /api/<collection>/:id/share` takes `requireSignIn` (accounts only, no guests) and `domains`
// (only accounts with a verified email at these, which implies sign-in) beside the link's role and expiry, and sets
// the item's one rule before the link is made (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Sharing
// and access"). The rule holds every pass on the item, as the Share dialog's Sign In card does. Neither named: the
// rule is left as it is.

import {
  parseShareDomains,
  type IndexClient,
  type ShareSignInRule,
} from '@liveworkspace/index-client';

export type ShareSignInAsked =
  | { rule: ShareSignInRule | null }
  | { error: 'invalid_sign_in' | 'too_many_domains' }
  | { error: 'invalid_domain'; domain: string };

/** The rule a share body asks for: null when it names neither field, else the rule or why it can't be set. */
export function shareSignInAskedOf(body: Record<string, unknown>): ShareSignInAsked {
  const { requireSignIn, domains } = body;
  if (requireSignIn === undefined && domains === undefined) return { rule: null };
  if (requireSignIn !== undefined && typeof requireSignIn !== 'boolean')
    return { error: 'invalid_sign_in' };
  let list: string[] = [];
  if (domains !== undefined && domains !== null) {
    const typed =
      typeof domains === 'string'
        ? domains
        : Array.isArray(domains) && domains.every((d) => typeof d === 'string')
          ? (domains as string[])
          : null;
    if (typed === null) return { error: 'invalid_sign_in' };
    const parsed = parseShareDomains(typed);
    if (!parsed.ok) {
      return 'tooMany' in parsed
        ? { error: 'too_many_domains' }
        : { error: 'invalid_domain', domain: parsed.invalid };
    }
    list = parsed.domains;
  }
  // Domains imply sign-in; asking for domains with sign-in off is a contradiction, not a request.
  if (requireSignIn === false && list.length > 0) return { error: 'invalid_sign_in' };
  return { rule: { requireAccount: requireSignIn === true || list.length > 0, domains: list } };
}

/** Sets the item's rule when the body asked for one; answers the rule now in force, or null when untouched. */
export async function applyShareSignIn(
  client: Pick<IndexClient, 'setShareSignIn'>,
  itemId: string,
  rule: ShareSignInRule | null,
): Promise<ShareSignInRule | null> {
  if (!rule) return null;
  return (await client.setShareSignIn(itemId, rule)).signIn;
}
