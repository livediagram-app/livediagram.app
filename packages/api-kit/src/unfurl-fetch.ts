// The Workers half of the link unfurl (unfurl.ts): fetch a public page, bounded in time and bytes, read its <head>
// with HTMLRewriter, and validate the URL again after redirects.

import {
  buildUnfurlResult,
  parsePublicHttpUrl,
  type CollectedMeta,
  type UnfurlResult,
} from './unfurl';

export const UNFURL_FETCH_TIMEOUT_MS = 8000;
export const UNFURL_MAX_HTML_BYTES = 512 * 1024; // only the <head> is needed

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
  // A response body streams bytes; the Workers types leave its chunks untyped.
  const reader: ReadableStreamDefaultReader<Uint8Array> | undefined = transformed.body?.getReader();
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

// The unfurl of a public http(s) URL (already parsePublicHttpUrl'd): the page's card fields, or `disallowed` when
// a redirect ended on a host it must not read. A network failure or timeout answers the bare URL, so the card
// still renders.
export async function unfurl(
  target: URL,
  userAgent: string,
): Promise<{ result: UnfurlResult } | { disallowed: true }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UNFURL_FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(target.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': userAgent, Accept: 'text/html,application/xhtml+xml' },
    });
  } catch {
    clearTimeout(timer);
    return { result: { url: target.toString() } };
  }
  clearTimeout(timer);

  // Re-validate the FINAL url after any redirects, so a redirect to a private
  // host can't leak data back through the card.
  const finalParsed = parsePublicHttpUrl(res.url || target.toString());
  if (!finalParsed) return { disallowed: true };
  const finalUrl = finalParsed.toString();

  if (!(res.headers.get('content-type') ?? '').includes('html')) {
    // Not an HTML page (PDF, image, …): no metadata, but still offer a favicon.
    return { result: buildUnfurlResult({}, finalUrl) };
  }
  return { result: buildUnfurlResult(await collectMeta(res, UNFURL_MAX_HTML_BYTES), finalUrl) };
}
