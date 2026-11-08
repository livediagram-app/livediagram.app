// Visitors' addresses, for the platform's per-network limits and counts: the address a request came from, as the
// app's router names it when it forwarded the request, and the range around an address that one person
// typically holds.

import {
  WORKSPACE_CLIENT_IP_HEADER,
  WORKSPACE_PROXY_HEADER,
  WORKSPACE_PROXY_SECRET_HEADER,
} from './workspace-proxy';

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/;

// Whether `sent` is the secret, in time that depends on the secret's length alone: no early exit, and a wrong
// length still walks the whole secret.
function sameProxySecret(sent: string, secret: string): boolean {
  let diff = sent.length ^ secret.length;
  for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ (sent.charCodeAt(i) || 0);
  return diff === 0;
}

/**
 * The address an app's router names (WORKSPACE_CLIENT_IP_HEADER), when it may be believed, else null. accounts and
 * the index are publicly routed, so anyone can send the header: it counts only beside the routers' shared secret
 * (WORKSPACE_PROXY_SECRET_HEADER matching `proxySecret`, the receiver's `WORKSPACE_PROXY_SECRET`). A receiver with no
 * secret set believes it as named, so the secret can reach the routers before the receivers without every app's
 * visitors counting as their router's one address meanwhile.
 */
export function trustedClientAddress(
  request: Request,
  proxySecret: string | undefined,
): string | null {
  const named = request.headers.get(WORKSPACE_CLIENT_IP_HEADER)?.trim();
  if (!named) return null;
  const secret = proxySecret?.trim();
  if (!secret) return named;
  const sent = request.headers.get(WORKSPACE_PROXY_SECRET_HEADER);
  return sent !== null && sameProxySecret(sent, secret) ? named : null;
}

/**
 * The visitor's address: the one an app's router names (trustedClientAddress, beside WORKSPACE_PROXY_HEADER) when it
 * forwarded the request, else the connection's own. A request through a router comes from the router, so without
 * this every visitor of an app's address would share one limit. `via` says it was named by a router, so a limit keyed
 * on it keeps the two apart.
 */
export function visitorAddress(
  request: Request,
  proxySecret: string | undefined,
): { address: string; via: boolean } {
  const client = request.headers.has(WORKSPACE_PROXY_HEADER)
    ? trustedClientAddress(request, proxySecret)
    : null;
  if (client) return { address: client, via: true };
  return { address: request.headers.get('CF-Connecting-IP') ?? 'unknown', via: false };
}

/** An address's range: its IPv4 /24 or IPv6 /48, so one machine can't dodge a limit by changing address. Anything
 *  unparseable is its own range. */
export function addressRange(ip: string): string {
  const v4 = IPV4.exec(ip.trim());
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`;
  const hextets = expandIpv6(ip.trim());
  return hextets ? `${hextets.slice(0, 3).join(':')}::/48` : ip.trim();
}

// The eight four-digit hextets of an IPv6 address (an embedded IPv4 tail counts as two), or null when it
// is not one.
export function expandIpv6(ip: string): string[] | null {
  if (!ip.includes(':')) return null;
  let address = ip.toLowerCase().split('%')[0]!;
  const tail = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
  if (tail) {
    const [a, b, c, d] = tail.slice(1).map(Number) as [number, number, number, number];
    const hex = (hi: number, lo: number) => ((hi << 8) | lo).toString(16);
    address = `${address.slice(0, tail.index)}${hex(a, b)}:${hex(c, d)}`;
  }
  const halves = address.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const all = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...rest];
  if (!all.every((h) => /^[0-9a-f]{1,4}$/.test(h))) return null;
  return all.map((h) => h.padStart(4, '0'));
}
