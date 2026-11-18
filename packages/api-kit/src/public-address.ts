// Which addresses a server-side fetch may reach (SSRF): never a private, loopback, link-local, reserved or
// metadata one, by the address a host name resolves to, not its spelling. Shared by the index's webhooks
// (liveworkspace/docs/specs/004-index/webhooks.md "Security"), the MCP's image upload by URL and live status
// (public-fetch.ts).

import { isPrivateAddress } from '@liveworkspace/model-core/private-host';

// The address list is the platform's one rule (model-core's private-host), shared with the URL checks.
export { isPrivateAddress };

/** A host's A and AAAA answers, or null when they couldn't be had (a resolver failure, a timeout). */
export type Resolve = (host: string) => Promise<string[] | null>;

const DOH_URL = 'https://cloudflare-dns.com/dns-query';
const DOH_TIMEOUT_MS = 3_000;
// DNS record types: A and AAAA.
const ANSWER_TYPES = new Set([1, 28]);

/** Resolves over DNS over HTTPS (Cloudflare's resolver, JSON), A and AAAA at once. */
export const dohResolve: Resolve = async (host) => {
  try {
    const lookups = await Promise.all(
      ['A', 'AAAA'].map(async (type) => {
        const res = await fetch(`${DOH_URL}?name=${encodeURIComponent(host)}&type=${type}`, {
          headers: { accept: 'application/dns-json' },
          signal: AbortSignal.timeout(DOH_TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`doh ${res.status}`);
        const body: { Answer?: { type?: unknown; data?: unknown }[] } = await res.json();
        return (body.Answer ?? [])
          .filter((a) => typeof a.type === 'number' && ANSWER_TYPES.has(a.type))
          .map((a) => String(a.data));
      }),
    );
    return lookups.flat();
  } catch {
    return null;
  }
};

/** `public` when the host resolves, and only to public addresses; `private` when any answer is one no fetch may
 *  reach; `unresolved` when it has no answer or the resolver failed. */
export async function resolvesPublic(
  host: string,
  resolve: Resolve,
): Promise<'public' | 'private' | 'unresolved'> {
  const addresses = await resolve(host);
  if (!addresses || addresses.length === 0) return 'unresolved';
  return addresses.some(isPrivateAddress) ? 'private' : 'public';
}
