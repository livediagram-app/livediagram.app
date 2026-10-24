// Server-side link "unfurl" for every product's link cards: the static editor can't read cross-origin page HTML,
// so the api Worker fetches the page (unfurl-fetch.ts) and extracts title / og:image / site name / favicon. This
// module is the pure part, safe in any runtime: the result's shape, the SSRF guard and the normalising. A
// product's route keeps the routing, its rate limit and its User-Agent.

// The fields a link card shows; only the resolved url is always there (the card falls back to the bare URL).
export type UnfurlResult = {
  url: string;
  title?: string;
  siteName?: string;
  description?: string;
  image?: string;
  favicon?: string;
};

// --- Pure helpers (unit-tested) -------------------------------------------

// True for a hostname we must NOT fetch: loopback / private / link-local /
// cloud-metadata / *.local. Defence-in-depth — Cloudflare Workers don't sit on
// a private network, but we still refuse to fetch (or return data from) these.
// True for a private / loopback / link-local / metadata IPv4 (from its first
// two octets). Shared by the dotted-quad and IPv4-mapped-IPv6 paths.
function isBlockedIpv4(a: number, b: number): boolean {
  if (a === 0 || a === 10 || a === 127) return true; // this-host / 10·8 / loopback
  if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16·12
  if (a === 192 && b === 168) return true; // 192.168·16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64·10
  return false;
}

export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, ''); // strip ipv6 brackets
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  if (h === '::1' || h === '::' || h === '0.0.0.0') return true; // loopback / unspecified
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (m && isBlockedIpv4(Number(m[1]), Number(m[2]))) return true;
  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1, which WHATWG URL normalises to the
  // hex form ::ffff:7f00:1): unwrap the embedded IPv4 and re-run the checks,
  // else a mapped loopback / metadata address slips past the IPv6 prefixes.
  if (h.startsWith('::ffff:')) {
    const mapped = h.slice('::ffff:'.length);
    const dotted = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(mapped);
    if (dotted && isBlockedIpv4(Number(dotted[1]), Number(dotted[2]))) return true;
    const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(mapped);
    if (hex) {
      const hi = parseInt(hex[1]!, 16);
      if (isBlockedIpv4((hi >> 8) & 0xff, hi & 0xff)) return true;
    }
  }
  if (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true; // ipv6 ULA / link-local
  return false;
}

// Parse + validate a target for SSRF safety. Returns the URL only when it's a
// public http(s) target; null for a bad/non-http/blocked-host URL.
export function parsePublicHttpUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (isBlockedHost(u.hostname)) return null;
  return u;
}

// The raw <head> fields the fetch collects (unfurl-fetch.ts); everything optional.
export type CollectedMeta = {
  title?: string;
  ogTitle?: string;
  ogSiteName?: string;
  ogImage?: string;
  ogDescription?: string;
  metaDescription?: string;
  iconHref?: string;
};

// Normalise collected fields into the public result against the final
// (post-redirect) URL: prefer og:* over the bare tags, resolve relative
// image/favicon to absolute, fall back to /favicon.ico.
export function buildUnfurlResult(collected: CollectedMeta, finalUrl: string): UnfurlResult {
  let base: URL | null = null;
  try {
    base = new URL(finalUrl);
  } catch {
    base = null;
  }
  const abs = (href?: string): string | undefined => {
    if (!href || !base) return undefined;
    try {
      return new URL(href, base).toString();
    } catch {
      return undefined;
    }
  };
  const clean = (s?: string) => {
    const t = s?.trim();
    return t && t.length > 0 ? t : undefined;
  };
  return {
    url: finalUrl,
    title: clean(collected.ogTitle) ?? clean(collected.title),
    siteName: clean(collected.ogSiteName),
    description: clean(collected.ogDescription) ?? clean(collected.metaDescription),
    image: abs(collected.ogImage),
    favicon: abs(collected.iconHref) ?? abs('/favicon.ico'),
  };
}
