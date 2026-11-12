// Whether a reload would bring a newer editor (docs/specs/016-platform/new-version-prompt.md "When the
// prompt shows", in each product): the api and the pages deploy as separate jobs, so for minutes the
// server can serve a newer format while the page still serves this same editor. One GET of the page
// itself, read only as far as its build meta (`<meta name="<product>-build" content="…">`), says which
// editor a reload would load. Text scanning, not a parser: the head is fixed markup the layout writes,
// and nothing here is ever put into the page.

/** What a reload would bring: a different build, this same one, or unknown (no ids, no answer). */
export type LiveEditor = 'newer' | 'same' | 'unknown';

/** How long the page request may take before the answer is unknown. */
export const LIVE_BUILD_TIMEOUT_MS = 5_000;
/** How far into the page it reads at most, when no `</head>` stops it first (the head is about 13 KB). */
export const LIVE_BUILD_READ_LIMIT = 256 * 1024;

/** The `content` of the first `<meta name="<metaName>">` in `html`, or null when it has none. */
export function readBuildMeta(html: string, metaName: string): string | null {
  const nameAttr = `name="${metaName}"`;
  let from = 0;
  for (;;) {
    const start = html.indexOf('<meta', from);
    if (start === -1) return null;
    const end = html.indexOf('>', start);
    if (end === -1) return null;
    const tag = html.slice(start, end);
    from = end;
    if (!tag.includes(nameAttr)) continue;
    const open = tag.indexOf('content="');
    if (open === -1) return null;
    const close = tag.indexOf('"', open + 9);
    return close > open + 9 ? tag.slice(open + 9, close) : null;
  }
}

// Reads the page as it streams, stopping at the meta or the end of the head, so a check costs the
// head's bytes rather than the whole page's.
async function readMetaFromResponse(res: Response, metaName: string): Promise<string | null> {
  const reader = res.body?.getReader();
  if (!reader) return readBuildMeta(await res.text(), metaName);
  const decoder = new TextDecoder();
  let html = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (value) html += decoder.decode(value, { stream: true });
      const found = readBuildMeta(html, metaName);
      if (
        found !== null ||
        done ||
        html.includes('</head>') ||
        html.length > LIVE_BUILD_READ_LIMIT
      ) {
        return found;
      }
    }
  } finally {
    await reader.cancel();
  }
}

/**
 * Asks the page itself which build it serves now and compares it with this editor's. No own build id
 * (local development) answers unknown without a request; so does a failed, slow or meta-less page.
 */
export async function checkLiveEditor(opts: {
  metaName: string;
  ownBuild: string | null;
  url?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<LiveEditor> {
  const { metaName, ownBuild, fetchImpl = fetch, timeoutMs = LIVE_BUILD_TIMEOUT_MS } = opts;
  if (ownBuild === null) return 'unknown';
  const url = opts.url ?? `${window.location.pathname}${window.location.search}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    });
    if (!res.ok) return 'unknown';
    const live = await readMetaFromResponse(res, metaName);
    if (live === null) return 'unknown';
    return live === ownBuild ? 'same' : 'newer';
  } catch {
    return 'unknown';
  } finally {
    clearTimeout(timer);
  }
}
