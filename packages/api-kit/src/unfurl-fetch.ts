// The Workers half of the link unfurl (unfurl.ts): fetch a public page, bounded in time and bytes, and read its
// <head> with HTMLRewriter. Every hop, the first and each redirect (followed by hand), goes through the same check as
// the image upload's (public-fetch.ts checkPublicHop, http variant), so neither a name resolving to a private address
// nor a redirect can reach one (liveworkspace/docs/specs/002-architecture/architecture.md "Fetching a URL someone gave").

import { dohResolve, type Resolve } from './public-address';
import { checkPublicHop, discard, isRedirect } from './public-fetch';
import { buildUnfurlResult, type CollectedMeta, type UnfurlResult } from './unfurl';

export const UNFURL_FETCH_TIMEOUT_MS = 8000;
export const UNFURL_MAX_HTML_BYTES = 512 * 1024; // only the <head> is needed
export const UNFURL_MAX_REDIRECTS = 5;

export type UnfurlOptions = {
  resolve?: Resolve;
  fetch?: (request: Request) => Promise<Response>;
};

async function collectMeta(res: Response, maxBytes: number): Promise<CollectedMeta> {
  const collected: CollectedMeta = {};
  let titleBuf = '';
  // The document's <title> is the first one: the reader runs on past </head>, where an inline SVG's own <title>
  // elements (an icon's "Menu", "Close") would otherwise be glued onto it.
  let titles = 0;
  const rewriter = new HTMLRewriter()
    .on('title', {
      element() {
        titles += 1;
      },
      text(t) {
        if (titles === 1) titleBuf += t.text;
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
  // A response body streams bytes; the Workers types leave its chunks untyped.
  const reader: ReadableStreamDefaultReader<Uint8Array> | undefined = transformed.body?.getReader();
  if (reader) {
    let read = 0;
    while (read < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      read += value.byteLength;
    }
    await reader.cancel().catch(() => {});
  }
  collected.title = titleBuf.trim() || undefined;
  return collected;
}

// The unfurl of a public http(s) URL (already parsePublicHttpUrl'd): the page's card fields, or `disallowed` when a
// hop (the URL itself or a redirect) is or resolves to a host it must not read. A name that won't resolve, a network
// failure, a timeout, a broken redirect or too many of them answers the bare URL, so the card still renders. The
// deadline covers the lookups and the body as well as the headers: a page that sends its headers and then trickles its
// <head> a byte at a time is cut off at UNFURL_FETCH_TIMEOUT_MS like one that never answers.
export async function unfurl(
  target: URL,
  userAgent: string,
  options: UnfurlOptions = {},
): Promise<{ result: UnfurlResult } | { disallowed: true }> {
  const { resolve = dohResolve, fetch: doFetch = (request) => fetch(request) } = options;
  const bare = { result: { url: target.toString() } };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UNFURL_FETCH_TIMEOUT_MS);
  try {
    let current = target.toString();
    let res: Response;
    for (let hop = 0; ; hop += 1) {
      const check = await checkPublicHop(current, resolve, 'http');
      if (!check.ok) return check.reason === 'private_address' ? { disallowed: true } : bare;
      // The lookups ran the clock out: no request after the deadline.
      if (controller.signal.aborted) return bare;
      current = check.url.toString();
      try {
        res = await doFetch(
          new Request(current, {
            method: 'GET',
            redirect: 'manual',
            signal: controller.signal,
            headers: { 'User-Agent': userAgent, Accept: 'text/html,application/xhtml+xml' },
          }),
        );
      } catch {
        return bare;
      }
      if (!isRedirect(res.status)) break;
      await discard(res);
      const location = res.headers.get('Location');
      if (!location || hop >= UNFURL_MAX_REDIRECTS) return bare;
      try {
        current = new URL(location, current).toString();
      } catch {
        return bare;
      }
    }
    const finalUrl = current;

    if (!(res.headers.get('content-type') ?? '').includes('html')) {
      // Not an HTML page (PDF, image, …): no metadata, but still offer a favicon. Its body is never read.
      await discard(res);
      return { result: buildUnfurlResult({}, finalUrl) };
    }
    try {
      return { result: buildUnfurlResult(await collectMeta(res, UNFURL_MAX_HTML_BYTES), finalUrl) };
    } catch {
      // The body failed or ran out of time part way: the card still renders, from the final URL alone.
      return { result: buildUnfurlResult({}, finalUrl) };
    }
  } finally {
    clearTimeout(timer);
  }
}
