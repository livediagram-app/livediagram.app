import { bytesToBase64 } from '@livedesign/api-schema';
import { DISPLAY_FONTS, FONTS, googleFontsHref } from '@livedesign/design';

// Webfonts, EMBEDDED, for an image export (docs/specs/004-interface-design/fonts.md).
//
// An exported file leaves the browser that made it, so a `font-family` alone
// is a promise the reader can't keep: nobody has Shantell Sans installed,
// and the `@import` a headless export writes is dead the moment the SVG is
// opened offline or used as an `<img>` src (which blocks external resources —
// exactly how the PNG path rasterises its fragments). So the browser export
// fetches the font files it needs and inlines them as base64 `@font-face`
// rules: the file then paints the real face anywhere, with no network.
//
// Best-effort by design. Google Fonts blocked, offline, a deployment that
// opted out — any failure resolves to an empty string and the export falls
// back to the stack's system face, which is the same deal the canvas makes.

// Only the Latin subsets are embedded. Google serves a `@font-face` per
// script (latin, latin-ext, cyrillic, greek, vietnamese...); taking all of
// them multiplies an export's weight for coverage a canvas almost never
// uses. Text outside these ranges still renders — in the fallback face.
const EMBEDDED_SUBSETS = ['latin', 'latin-ext'];

// Keyed by the id list, because a second export of the same canvas should
// not re-download a font we already hold.
const cache = new Map<string, Promise<EmbeddedFaces>>();

type FetchLike = typeof fetch;

/** The embedded `@font-face` css, and the label of each wanted face it holds no file of. */
export type EmbeddedFaces = { css: string; missing: string[] };

// An id's family as Google names it in the stylesheet (its `family=` spec up to the axes), and its label.
function familyOf(id: string): { family: string; label: string } | null {
  const font = FONTS.find((f) => f.id === id) ?? DISPLAY_FONTS.find((f) => f.id === id);
  if (!font) return null;
  return { family: font.google.split(':')[0]!.replace(/\+/g, ' '), label: font.label };
}

// The @font-face blocks for the wanted subsets, with every url() swapped for
// a data URL. Empty when nothing is wanted or anything goes wrong.
export async function embeddedFontFaceCss(
  fontIds: readonly string[],
  fetchImpl?: FetchLike,
): Promise<string> {
  return (await embeddedFontFaces(fontIds, fetchImpl)).css;
}

/** As `embeddedFontFaceCss`, also naming each face it couldn't fetch (docs/specs/007-editor/logo-pages.md
 *  "Outlined text": the Logo Kit can't outline a face it holds no file of). */
export async function embeddedFontFaces(
  fontIds: readonly string[],
  fetchImpl?: FetchLike,
): Promise<EmbeddedFaces> {
  if (fontIds.length === 0) return { css: '', missing: [] };
  const key = [...fontIds].sort().join(',');
  const hit = cache.get(key);
  if (hit) return hit;
  const everyLabel = () => fontIds.flatMap((id) => familyOf(id)?.label ?? []);
  const pending = buildFaces(fontIds, fetchImpl ?? fetch).catch(() => ({
    css: '',
    missing: everyLabel(),
  }));
  cache.set(key, pending);
  // A face that didn't come is asked for again next time (the connection may be back).
  void pending.then((r) => {
    if (r.missing.length > 0 && cache.get(key) === pending) cache.delete(key);
  });
  return pending;
}

async function buildFaces(fontIds: readonly string[], doFetch: FetchLike): Promise<EmbeddedFaces> {
  const families = fontIds.flatMap((id) => familyOf(id) ?? []);
  const res = await doFetch(googleFontsHref(fontIds));
  if (!res.ok) return { css: '', missing: families.map((f) => f.label) };
  const blocks = latinFaceBlocks(await res.text());
  const inlined = (await Promise.all(blocks.map((block) => inlineUrls(block, doFetch)))).filter(
    Boolean,
  );
  const holds = (family: string) => (block: string) =>
    block.includes(`font-family: '${family}'`) || block.includes(`font-family: "${family}"`);
  const missing = families.filter((f) => !inlined.some(holds(f.family))).map((f) => f.label);
  return { css: inlined.join('\n'), missing };
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
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}
