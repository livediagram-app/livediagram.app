// A CSS colour as the PDF's DeviceRGB components and an alpha (liveworkspace/docs/specs/013-export/vector-pdf.md "Paint"). A browser's computed
// style gives rgb() and rgba() (and a hex or name written as an attribute where no style is computed); any other form
// (oklch(), color-mix()...) is painted onto a one-pixel canvas and read back, so every colour the browser knows lands.

export type Rgba = { r: number; g: number; b: number; a: number };

const NAMED: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  orange: '#ffa500',
  purple: '#800080',
  navy: '#000080',
};

function hex(s: string): Rgba | null {
  const h = s.slice(1);
  if (!/^[0-9a-f]+$/i.test(h)) return null;
  const pair = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
  const one = (i: number) => parseInt(h[i]! + h[i]!, 16) / 255;
  if (h.length === 3 || h.length === 4)
    return { r: one(0), g: one(1), b: one(2), a: h.length === 4 ? one(3) : 1 };
  if (h.length === 6 || h.length === 8)
    return { r: pair(0), g: pair(2), b: pair(4), a: h.length === 8 ? pair(6) : 1 };
  return null;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// rgb(1, 2, 3), rgba(1, 2, 3, 0.5), rgb(1 2 3 / 50%): split on the separators, no regex over the whole.
function rgbFn(s: string): Rgba | null {
  const open = s.indexOf('(');
  const close = s.lastIndexOf(')');
  if (open === -1 || close < open) return null;
  const parts = s
    .slice(open + 1, close)
    .split(/[\s,/]+/)
    .filter(Boolean);
  if (parts.length < 3) return null;
  const channel = (p: string) =>
    p.endsWith('%') ? clamp01(parseFloat(p) / 100) : clamp01(parseFloat(p) / 255);
  const alpha = (p: string | undefined) =>
    p === undefined ? 1 : p.endsWith('%') ? clamp01(parseFloat(p) / 100) : clamp01(parseFloat(p));
  const c = {
    r: channel(parts[0]!),
    g: channel(parts[1]!),
    b: channel(parts[2]!),
    a: alpha(parts[3]),
  };
  return [c.r, c.g, c.b, c.a].every(Number.isFinite) ? c : null;
}

const cache = new Map<string, Rgba | null>();
// Bounded: an export names a few dozen colours; a pathological one can't grow this past the cap.
const CACHE_CAP = 512;

function viaCanvas(s: string): Rgba | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = '#010203';
  ctx.fillStyle = s;
  // An unknown colour leaves the sentinel; a real #010203 would be read as itself anyway.
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  const a = d[3]! / 255;
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  // getImageData un-premultiplies; read the colour back as drawn.
  return { r: d[0]! / 255, g: d[1]! / 255, b: d[2]! / 255, a };
}

/** The colour, or null for none or one the browser does not know. */
export function parseColor(input: string): Rgba | null {
  const s = input.trim().toLowerCase();
  if (!s || s === 'none') return null;
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (s[0] === '#') return hex(s);
  if (s.startsWith('rgb')) return rgbFn(s);
  const named = NAMED[s];
  if (named) return hex(named);
  if (cache.has(s)) return cache.get(s)!;
  const c = viaCanvas(s);
  if (cache.size >= CACHE_CAP) cache.clear();
  cache.set(s, c);
  return c;
}

/** A paint as an element names it: none, a colour, or a reference to a gradient or pattern (with the colour that
 *  stands in when the reference fails). */
export type Paint =
  | { kind: 'none' }
  | { kind: 'color'; color: Rgba }
  | { kind: 'ref'; id: string; fallback: Rgba | null };

/** `fill` or `stroke` as computed: `none`, a colour, or `url("#id") [fallback]`. */
export function parsePaint(value: string): Paint {
  const v = value.trim();
  if (v.startsWith('url(')) {
    const close = v.indexOf(')');
    const inner = v
      .slice(4, close === -1 ? v.length : close)
      .trim()
      .replace(/^["']|["']$/g, '');
    const hash = inner.indexOf('#');
    const rest = close === -1 ? '' : v.slice(close + 1).trim();
    return {
      kind: 'ref',
      id: hash === -1 ? inner : inner.slice(hash + 1),
      fallback: rest ? parseColor(rest) : null,
    };
  }
  const color = parseColor(v);
  return color && color.a > 0 ? { kind: 'color', color } : { kind: 'none' };
}

/** The colour as DeviceRGB operands. */
export const rgbOperands = (c: Rgba): string =>
  [c.r, c.g, c.b].map((n) => String(Math.round(n * 1000) / 1000)).join(' ');
