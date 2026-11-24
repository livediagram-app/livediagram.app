// Markdown for agents, the request side (liveworkspace/docs/specs/010-site/markdown-for-agents.md): whether a request
// prefers Markdown, where a page's Markdown file is, and the response either way. Dependency-free, so the site's
// Worker, the help centre's Worker and every product's router run this one copy.

/** The Content-Type every Markdown answer carries. */
export const MARKDOWN_CONTENT_TYPE = 'text/markdown; charset=utf-8';

/** How much of an Accept header is read. Real ones are under 300 characters; a longer one is cut, never parsed whole. */
export const ACCEPT_READ_LIMIT = 2048;

/** A q-value: 0 to 1 with up to three decimals (RFC 9110 "Quality Values"). Anything else is not one. */
function qValue(text: string): number | null {
  if (text.length === 0 || text.length > 5 || (text[0] !== '0' && text[0] !== '1')) return null;
  for (const char of text) if ((char < '0' || char > '9') && char !== '.') return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

/** One media range of an Accept header (`text/markdown;q=0.9`): its type, lower case, and its q, or null when the q
 *  is not a q-value (the range is then ignored). Read left to right, one split per separator, no regex. */
function mediaRange(part: string): { type: string; q: number } | null {
  const params = part.split(';');
  const type = params[0]!.trim().toLowerCase();
  let q = 1;
  for (let i = 1; i < params.length; i++) {
    const param = params[i]!.trim();
    const eq = param.indexOf('=');
    if (eq < 0 || param.slice(0, eq).trim().toLowerCase() !== 'q') continue;
    const parsed = qValue(param.slice(eq + 1).trim());
    if (parsed === null) return null;
    q = parsed;
  }
  return { type, q };
}

/**
 * Whether a request's Accept header prefers Markdown over HTML. Only an explicit `text/markdown` counts, never `*\/*`
 * or `text/*`, so a browser (which never names it) always gets HTML. Markdown wins when its q is above 0 and at least
 * the q HTML gets from its most specific range (`text/html`, else `text/*`, else `*\/*`): an agent that names both at
 * the same weight asked for Markdown by naming it at all.
 *
 * The fast path: a header without the word "markdown" in it is HTML at once, with no parsing.
 */
export function prefersMarkdown(accept: string | null | undefined): boolean {
  if (!accept) return false;
  const header = accept.length > ACCEPT_READ_LIMIT ? accept.slice(0, ACCEPT_READ_LIMIT) : accept;
  if (!/markdown/i.test(header)) return false;
  let markdown = 0;
  let html: number | null = null;
  let textAny: number | null = null;
  let any: number | null = null;
  for (const part of header.split(',')) {
    const range = mediaRange(part);
    if (!range) continue;
    if (range.type === 'text/markdown') markdown = Math.max(markdown, range.q);
    else if (range.type === 'text/html') html = Math.max(html ?? 0, range.q);
    else if (range.type === 'text/*') textAny = Math.max(textAny ?? 0, range.q);
    else if (range.type === '*/*') any = Math.max(any ?? 0, range.q);
  }
  return markdown > 0 && markdown >= (html ?? textAny ?? any ?? 0);
}

/** Whether a path names a page (its last segment has no file extension): the only paths that negotiate. */
export function isPagePath(pathname: string): boolean {
  return !pathname.slice(pathname.lastIndexOf('/') + 1).includes('.');
}

/**
 * Where a page's Markdown sits beside its HTML: `/` → `/index.md`, `/pricing` → `/pricing.md`, and on a site whose
 * pages end in a slash (`trailingSlash`, the help centre) `/tabs/using-tabs/` → `/tabs/using-tabs/index.md`.
 */
export function markdownPathOf(pathname: string, { trailingSlash = false } = {}): string {
  if (pathname.endsWith('/')) return `${pathname}index.md`;
  return trailingSlash ? `${pathname}/index.md` : `${pathname}.md`;
}

function hasVaryAccept(vary: string | null): boolean {
  if (!vary) return false;
  return vary.split(',').some((name) => {
    const n = name.trim().toLowerCase();
    return n === 'accept' || n === '*';
  });
}

/** `response` with `Vary: Accept` added (kept once), so no cache hands one form to a request that asked for the
 *  other. A WebSocket upgrade is returned as it is: rebuilding it would drop its socket. */
export function withVaryAccept(response: Response): Response {
  if (response.status === 101 || hasVaryAccept(response.headers.get('Vary'))) return response;
  const out = new Response(response.body, response);
  out.headers.append('Vary', 'Accept');
  return out;
}

/** A Markdown file's response as the page's Markdown answer: the Markdown type with its charset, and Vary: Accept. */
export function markdownResponse(file: Response): Response {
  const out = new Response(file.body, file);
  out.headers.set('Content-Type', MARKDOWN_CONTENT_TYPE);
  out.headers.delete('Content-Length');
  return withVaryAccept(out);
}

/** A request for another file of the same site: `path` in place of the request's path, the method and headers kept
 *  (so a conditional request stays conditional). */
export function requestFor(request: Request, path: string): Request {
  const url = new URL(request.url);
  url.pathname = path;
  return new Request(url.toString(), { method: request.method, headers: request.headers });
}

export type NegotiateOptions = {
  /** The site's pages end in a slash (the help centre): their Markdown is `<page>/index.md`. */
  trailingSlash?: boolean;
};

/**
 * A page's answer: its Markdown when the request prefers it and the site has the file, else what `html` answers.
 * Both carry `Vary: Accept`. A path that is not a page, a method other than GET or HEAD, and a request that does not
 * prefer Markdown go straight to `html` (the fast path: one header test, no extra fetch). A missing or failed Markdown
 * file falls back to the HTML, never a 406.
 *
 * `pathname` is the page's path inside the site (after any prefix a router strips); `file` fetches a path of the
 * same site.
 */
export async function negotiatePage(
  request: Request,
  pathname: string,
  file: (path: string) => Promise<Response>,
  html: () => Response | Promise<Response>,
  options: NegotiateOptions = {},
): Promise<Response> {
  if (!isPagePath(pathname)) return html();
  if (
    (request.method === 'GET' || request.method === 'HEAD') &&
    prefersMarkdown(request.headers.get('Accept'))
  ) {
    const markdown = await file(markdownPathOf(pathname, options)).catch(() => null);
    if (markdown && (markdown.status === 200 || markdown.status === 304))
      return markdownResponse(markdown);
    await markdown?.body?.cancel();
  }
  return withVaryAccept(await html());
}
