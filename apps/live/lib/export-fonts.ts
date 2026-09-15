import { googleFontsHref } from '@livediagram/diagram';

// Webfonts, EMBEDDED, for an image export (spec/28).
//
// An exported file leaves the browser that made it, so a `font-family` alone
// is a promise the reader can't keep: nobody has Permanent Marker installed,
// and the `@import` a headless export writes is dead the moment the SVG is
// opened offline or used as an `<img>` src (which blocks external resources —
// exactly how the PNG path rasterises its fragments). So the browser export
// fetches the font files it needs and inlines them as base64 `@font-face`
// rules: the file then paints the real face anywhere, with no network.
//
// Best-effort by design. Google Fonts blocked, offline, a self-host that
// opted out — any failure resolves to an empty string and the export falls
// back to the stack's system face, which is the same deal the canvas makes.

// Only the Latin subsets are embedded. Google serves a `@font-face` per
// script (latin, latin-ext, cyrillic, greek, vietnamese...); taking all of
// them multiplies an export's weight for coverage a diagram almost never
// uses. Text outside these ranges still renders — in the fallback face.
const EMBEDDED_SUBSETS = ['latin', 'latin-ext'];

// Keyed by the id list, because a second export of the same board should
// not re-download a font we already hold.
const cache = new Map<string, Promise<string>>();

type FetchLike = typeof fetch;

// The @font-face blocks for the wanted subsets, with every url() swapped for
// a data URL. Empty when nothing is wanted or anything goes wrong.
export async function embeddedFontFaceCss(
  fontIds: readonly string[],
  fetchImpl?: FetchLike,
): Promise<string> {
  if (fontIds.length === 0) return '';
  const key = [...fontIds].sort().join(',');
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = buildCss(fontIds, fetchImpl ?? fetch).catch(() => '');
  cache.set(key, pending);
  return pending;
}

async function buildCss(fontIds: readonly string[], doFetch: FetchLike): Promise<string> {
  const res = await doFetch(googleFontsHref(fontIds));
  if (!res.ok) return '';
  const css = await res.text();
  const blocks = latinFaceBlocks(css);
  const inlined = await Promise.all(blocks.map((block) => inlineUrls(block, doFetch)));
  return inlined.filter(Boolean).join('\n');
}

// Google's stylesheet labels each @font-face with a `/* subset */` comment.
// Split on those and keep the Latin ones.
export function latinFaceBlocks(css: string): string[] {
  const out: string[] = [];
  const parts = css.split(/\/\*\s*([a-z0-9-]+)\s*\*\//i);
  // parts: [preamble, name1, body1, name2, body2, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const name = parts[i]!.toLowerCase();
    const body = parts[i + 1] ?? '';
    if (EMBEDDED_SUBSETS.includes(name) && body.includes('@font-face')) out.push(body.trim());
  }
  return out;
}

async function inlineUrls(block: string, doFetch: FetchLike): Promise<string> {
  const urls = [...block.matchAll(/url\((https:\/\/[^)]+)\)/g)].map((m) => m[1]!);
  let out = block;
  for (const url of urls) {
    const data = await fetchAsDataUrl(url, doFetch);
    if (!data) return '';
    out = out.replace(url, data);
  }
  return out;
}

async function fetchAsDataUrl(url: string, doFetch: FetchLike): Promise<string | null> {
  const res = await doFetch(url);
  if (!res.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  const mime = url.endsWith('.woff2') ? 'font/woff2' : 'font/woff';
  return `data:${mime};base64,${base64(bytes)}`;
}

// Chunked so a font file (tens of thousands of bytes) can't blow the
// argument limit of String.fromCharCode.
function base64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
