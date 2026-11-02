// Where a webhook may send (liveworkspace/docs/specs/004-index/webhooks.md "Security"): HTTPS on 443 to a host name
// that resolves only to public addresses, never a private, loopback, link-local or reserved one (SSRF). Checked
// when a webhook is added and again before each send; redirects are never followed (dispatch.ts), so an endpoint
// can't bounce a delivery inward.

import { WEBHOOK_URL_MAX, type WebhookKind } from '@liveworkspace/index-client';
import { expandIpv6 } from '@liveworkspace/sites/network';

export type UrlRefusal = 'webhook_url_invalid' | 'webhook_url_private';

// Names that only mean something inside a network.
const INTERNAL_SUFFIXES = ['.local', '.localhost', '.internal', '.lan', '.home.arpa', '.intranet'];

// Each destination's hosts: Slack's incoming webhooks, Teams' Workflows (Power Automate) webhooks.
const SLACK_HOST = 'hooks.slack.com';
const TEAMS_SUFFIXES = ['.logic.azure.com', '.powerplatform.com'];

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** The URL a webhook may be added with, or why not: its shape only (resolving is `resolvesPublic`). */
export function parseWebhookUrl(
  raw: unknown,
  kind: WebhookKind,
): { ok: true; url: URL; host: string } | { ok: false; error: UrlRefusal } {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > WEBHOOK_URL_MAX) {
    return { ok: false, error: 'webhook_url_invalid' };
  }
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, error: 'webhook_url_invalid' };
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    return { ok: false, error: 'webhook_url_invalid' };
  }
  if (url.port !== '' && url.port !== '443') return { ok: false, error: 'webhook_url_invalid' };
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  // An address rather than a name, or a name that never leaves a network.
  if (IPV4.test(host) || host.startsWith('[') || host.includes(':')) {
    return { ok: false, error: 'webhook_url_private' };
  }
  if (
    !host.includes('.') ||
    host === 'localhost' ||
    INTERNAL_SUFFIXES.some((s) => host.endsWith(s))
  ) {
    return { ok: false, error: 'webhook_url_private' };
  }
  if (kind === 'slack' && (host !== SLACK_HOST || !url.pathname.startsWith('/services/'))) {
    return { ok: false, error: 'webhook_url_invalid' };
  }
  if (kind === 'teams' && !TEAMS_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, error: 'webhook_url_invalid' };
  }
  return { ok: true, url, host };
}

// [first address, prefix length] of each IPv4 range no webhook may reach: this network, private, carrier NAT,
// loopback, link-local, IETF protocol assignments, the documentation ranges, benchmarking, multicast and reserved.
const V4_BLOCKED: readonly [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

const v4Number = (ip: string): number | null => {
  if (!IPV4.test(ip)) return null;
  const parts = ip.split('.').map(Number);
  if (parts.some((p) => p > 255)) return null;
  return parts.reduce((n, p) => n * 256 + p, 0);
};

function v4Blocked(n: number): boolean {
  return V4_BLOCKED.some(([first, bits]) => {
    const size = 2 ** (32 - bits);
    const start = v4Number(first)!;
    return n >= start && n < start + size;
  });
}

/** Whether an IPv4 or IPv6 address is one no webhook may reach. Anything that isn't an address counts as one. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = v4Number(ip);
  if (v4 !== null) return v4Blocked(v4);
  const hextets = expandIpv6(ip);
  if (!hextets) return true;
  const words = hextets.map((h) => parseInt(h, 16));
  const [a, b] = words as [number, number];
  // An IPv4 address carried in IPv6 (mapped ::ffff:0:0/96, the NAT64 prefix 64:ff9b::/96): judged as that address.
  const mapped = words.slice(0, 5).every((w) => w === 0) && words[5] === 0xffff;
  const nat64 = a === 0x64 && b === 0xff9b && words.slice(2, 6).every((w) => w === 0);
  if (mapped || nat64) return v4Blocked(words[6]! * 65536 + words[7]!);
  // Unspecified, loopback and IPv4-compatible (::/96).
  if (words.slice(0, 6).every((w) => w === 0)) return true;
  // Unique local fc00::/7, link-local fe80::/10, site-local fec0::/10, multicast ff00::/8.
  if ((a & 0xfe00) === 0xfc00 || (a & 0xffc0) === 0xfe80 || (a & 0xffc0) === 0xfec0) return true;
  if ((a & 0xff00) === 0xff00) return true;
  // Documentation 2001:db8::/32, discard 100::/64, and 6to4 2002::/16 (whose embedded IPv4 could be anything).
  if ((a === 0x2001 && b === 0x0db8) || a === 0x2002) return true;
  if (a === 0x0100 && words.slice(1, 4).every((w) => w === 0)) return true;
  return false;
}

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
        const body = (await res.json()) as { Answer?: { type?: unknown; data?: unknown }[] };
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

/** `public` when the host resolves, and only to public addresses; `private` when any answer is one no webhook may
 *  reach; `unresolved` when it has no answer or the resolver failed. */
export async function resolvesPublic(
  host: string,
  resolve: Resolve,
): Promise<'public' | 'private' | 'unresolved'> {
  const addresses = await resolve(host);
  if (!addresses || addresses.length === 0) return 'unresolved';
  return addresses.some(isPrivateAddress) ? 'private' : 'public';
}
