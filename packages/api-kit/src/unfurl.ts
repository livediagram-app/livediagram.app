// Server-side link "unfurl" for every product's link cards: the static editor can't read cross-origin page HTML,
// so the api Worker fetches the page (unfurl-fetch.ts) and extracts title / og:image / site name / favicon. This
// module is the pure part, safe in any runtime: the result's shape, the SSRF guard and the normalising. A
// product's route keeps the routing, its rate limit and its User-Agent.

import { classifyHost } from '@liveworkspace/model-core/private-host';

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

// True for a hostname we must NOT fetch: a private, loopback, link-local, metadata or reserved address, or an
// internal name. The platform's one rule (model-core's private-host), so a host the webhooks or the image upload
// refuse is refused here too. Workers don't sit on a private network, but we still refuse to fetch (or return data
// from) these.
export function isBlockedHost(hostname: string): boolean {
  return classifyHost(hostname).private;
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
