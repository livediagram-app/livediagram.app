// Visitors' addresses, for the platform's per-network limits and counts: the address a request came from, as the
// app's router names it when it forwarded the request, and the range around an address that one person
// typically holds.

import { WORKSPACE_CLIENT_IP_HEADER, WORKSPACE_PROXY_HEADER } from './workspace-proxy';

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/;

/**
 * The visitor's address: the one an app's router names (WORKSPACE_CLIENT_IP_HEADER, beside WORKSPACE_PROXY_HEADER)
 * when it forwarded the request, else the connection's own. A request through a router comes from the router, so
 * without this every visitor of an app's address would share one limit. `via` says it was named by a router; a
 * caller can name any address there, so a limit keyed on it should keep the two apart.
 */
export function visitorAddress(request: Request): { address: string; via: boolean } {
  const client = request.headers.get(WORKSPACE_CLIENT_IP_HEADER);
  if (client && request.headers.has(WORKSPACE_PROXY_HEADER)) return { address: client, via: true };
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
