// The faces an embedded stylesheet declares (livedesign/docs/specs/007-editor/logo-pages.md "Outlined text"): each
// `@font-face` of the css an SVG download carries (export-fonts.ts), read into what matching and outlining need.
// Read by a scan of the blocks and their declarations, never a backtracking regex over the whole stylesheet.

export type FaceSource = {
  family: string;
  // The weights the face covers (a single weight is [w, w]).
  weight: readonly [number, number];
  style: 'normal' | 'italic' | 'oblique';
  // Code point ranges, inclusive; absent `unicode-range` is everything.
  ranges: readonly (readonly [number, number])[];
  // The face's file, a data: URL in an embedded stylesheet.
  url: string;
};

const EVERYTHING: readonly (readonly [number, number])[] = [[0, 0x10ffff]];

function unquote(value: string): string {
  const v = value.trim();
  const q = v[0];
  return (q === '"' || q === "'") && v.endsWith(q) ? v.slice(1, -1) : v;
}

/** `U+0000-00FF, U+0131, U+02??` as inclusive ranges; malformed tokens are skipped. */
export function parseUnicodeRange(value: string): [number, number][] {
  const out: [number, number][] = [];
  for (const raw of value.split(',')) {
    const token = raw.trim().toUpperCase();
    if (!token.startsWith('U+')) continue;
    const body = token.slice(2);
    const dash = body.indexOf('-');
    if (dash !== -1) {
      const lo = parseInt(body.slice(0, dash), 16);
      const hi = parseInt(body.slice(dash + 1), 16);
      if (Number.isFinite(lo) && Number.isFinite(hi)) out.push([lo, hi]);
    } else if (body.includes('?')) {
      const lo = parseInt(body.replaceAll('?', '0'), 16);
      const hi = parseInt(body.replaceAll('?', 'F'), 16);
      if (Number.isFinite(lo) && Number.isFinite(hi)) out.push([lo, hi]);
    } else {
      const cp = parseInt(body, 16);
      if (Number.isFinite(cp)) out.push([cp, cp]);
    }
  }
  return out;
}

function parseWeight(value: string | undefined): [number, number] {
  const parts = (value ?? '400').trim().split(/\s+/);
  const named = (p: string) => (p === 'bold' ? 700 : p === 'normal' ? 400 : Number(p));
  const lo = named(parts[0]!);
  const hi = parts[1] ? named(parts[1]) : lo;
  return Number.isFinite(lo) && Number.isFinite(hi) ? [lo, hi] : [400, 400];
}

function firstUrl(src: string): string | null {
  const at = src.indexOf('url(');
  if (at === -1) return null;
  const close = src.indexOf(')', at);
  if (close === -1) return null;
  return unquote(src.slice(at + 4, close));
}

// A block's declarations, split on the semicolons outside url(...) and quotes (a data: URL holds one).
function declarations(body: string): Map<string, string> {
  const decls = new Map<string, string>();
  let depth = 0;
  let quote = '';
  let start = 0;
  const take = (end: number) => {
    const decl = body.slice(start, end);
    const colon = decl.indexOf(':');
    if (colon !== -1)
      decls.set(decl.slice(0, colon).trim().toLowerCase(), decl.slice(colon + 1).trim());
    start = end + 1;
  };
  // Only the characters that change state matter, so a native search jumps between them: a data: URL's
  // base64 run is skipped in one step rather than walked a character at a time.
  const special = /[()"';]/g;
  for (let m = special.exec(body); m; m = special.exec(body)) {
    const i = m.index;
    const c = m[0];
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if (c === ';' && depth === 0) take(i);
  }
  take(body.length);
  return decls;
}

/** Every `@font-face` block of `css` with a family and a file. */
export function parseFontFaces(css: string): FaceSource[] {
  const faces: FaceSource[] = [];
  let at = css.indexOf('@font-face');
  while (at !== -1) {
    const open = css.indexOf('{', at);
    const close = open === -1 ? -1 : css.indexOf('}', open);
    if (close === -1) break;
    const decls = declarations(css.slice(open + 1, close));
    const family = decls.get('font-family');
    const url = firstUrl(decls.get('src') ?? '');
    if (family && url) {
      const style = decls.get('font-style')?.split(/\s+/)[0];
      const range = decls.get('unicode-range');
      faces.push({
        family: unquote(family),
        weight: parseWeight(decls.get('font-weight')),
        style: style === 'italic' || style === 'oblique' ? style : 'normal',
        ranges: range ? parseUnicodeRange(range) : EVERYTHING,
        url,
      });
    }
    at = css.indexOf('@font-face', close);
  }
  return faces;
}
