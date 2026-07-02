// GET /api/unfurl?url=<encoded> — server-side link "unfurl" for the link-card
// element (spec/40). The static client can't read cross-origin page HTML, so
// the worker fetches the page and extracts title / og:image / site name /
// favicon. PUBLIC + self-hostable repo, so the target URL is validated for
// SSRF before any fetch and the read is bounded. Always returns 200 with at
// least the resolved url (the card falls back to the bare URL on a miss).

import type { UnfurlResult } from '@livediagram/api-schema';
import { badRequest, json, notFound, rateLimited } from '../responses';
import { clientIp } from '../client-ip';
import type { RouteContext } from './context';

const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 512 * 1024; // only the <head> is needed
const USER_AGENT = 'livediagram-unfurl/1.0 (+https://livediagram.app)';

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

// The raw <head> fields HTMLRewriter collects; everything optional.
type CollectedMeta = {
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

// --- Handler --------------------------------------------------------------

async function collectMeta(res: Response, maxBytes: number): Promise<CollectedMeta> {
  const collected: CollectedMeta = {};
  let titleBuf = '';
  const rewriter = new HTMLRewriter()
    .on('title', {
      text(t) {
        titleBuf += t.text;
      },
    })
    .on('meta', {
      element(el) {
        const prop = (el.getAttribute('property') ?? el.getAttribute('name') ?? '').toLowerCase();
        const content = el.getAttribute('content');
        if (!prop || !content) return;
        if (prop === 'og:title') collected.ogTitle ??= content;
        else if (prop === 'og:site_name') collected.ogSiteName ??= content;
        else if (prop === 'og:image' || prop === 'og:image:url') collected.ogImage ??= content;
        else if (prop === 'og:description') collected.ogDescription ??= content;
        else if (prop === 'description') collected.metaDescription ??= content;
      },
    })
    .on('link', {
      element(el) {
        const rel = (el.getAttribute('rel') ?? '').toLowerCase();
        if (!collected.iconHref && rel.includes('icon')) {
          const href = el.getAttribute('href');
          if (href) collected.iconHref = href;
        }
      },
    });
  const transformed = rewriter.transform(res);
  const reader = transformed.body?.getReader();
  if (reader) {
    let read = 0;
    while (read < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      read += value?.byteLength ?? 0;
    }
    await reader.cancel().catch(() => {});
  }
  collected.title = titleBuf.trim() || undefined;
  return collected;
}

export async function handleUnfurl(ctx: RouteContext): Promise<Response> {
  const { request, env, url } = ctx;
  if (request.method !== 'GET') return notFound();

  // Per-IP throttle: it's an unauthenticated outbound fetch, so bound abuse.
  if (env.UNFURL_RATE_LIMITER) {
    const ip = clientIp(request);
    if (!(await env.UNFURL_RATE_LIMITER.limit({ key: ip })).success) return rateLimited();
  }

  const target = url.searchParams.get('url');
  if (!target) return badRequest('missing url');
  const parsed = parsePublicHttpUrl(target);
  if (!parsed) return badRequest('invalid or disallowed url');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
    });
  } catch {
    clearTimeout(timer);
    // Network error / timeout: hand back the bare URL so the card still renders.
    return json({ url: parsed.toString() } satisfies UnfurlResult);
  }
  clearTimeout(timer);

  // Re-validate the FINAL url after any redirects, so a redirect to a private
  // host can't leak data back through the card.
  const finalParsed = parsePublicHttpUrl(res.url || parsed.toString());
  if (!finalParsed) return badRequest('redirected to a disallowed url');
  const finalUrl = finalParsed.toString();

  const ctype = res.headers.get('content-type') ?? '';
  if (!ctype.includes('html')) {
    // Not an HTML page (PDF, image, …): no metadata, but still offer a favicon.
    return json(buildUnfurlResult({}, finalUrl));
  }
  const collected = await collectMeta(res, MAX_HTML_BYTES);
  return json(buildUnfurlResult(collected, finalUrl));
}
