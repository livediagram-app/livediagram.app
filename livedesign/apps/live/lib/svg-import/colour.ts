// An SVG paint's colour as six-digit hex plus its alpha (docs/specs/020-import-export/svg-import.md "Style"): hex of
// 3, 4, 6 or 8 digits, rgb()/rgba(), hsl()/hsla() (commas or spaces, `/` alpha, percentages), the named colours and
// `transparent`. Read by hand, character by character; no regular expressions.
import { namedColour } from './named-colours';
import { NumberScanner } from './number-scan';

export type Rgba = { hex: string; alpha: number };

const HEX = '0123456789abcdef';
const byte = (n: number) => {
  const v = Math.round(Math.max(0, Math.min(255, n)));
  return HEX[v >> 4]! + HEX[v & 15]!;
};
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function fromHex(h: string): Rgba | null {
  for (const c of h) if (!HEX.includes(c)) return null;
  if (h.length === 3 || h.length === 4) {
    const hex = `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    return { hex, alpha: h.length === 4 ? parseInt(h[3]! + h[3]!, 16) / 255 : 1 };
  }
  if (h.length === 6 || h.length === 8) {
    return { hex: `#${h.slice(0, 6)}`, alpha: h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1 };
  }
  return null;
}

// The numbers inside a colour function, each with whether it was a percentage; null when malformed.
function functionArgs(body: string): { v: number; pct: boolean }[] | null {
  const scan = new NumberScanner(body);
  const out: { v: number; pct: boolean }[] = [];
  for (;;) {
    scan.skipSeparators();
    if (scan.peek() === '/') {
      scan.take();
      scan.skipSpaces();
    }
    if (scan.done) break;
    const v = scan.number();
    if (v === null || out.length >= 4) return null;
    let pct = false;
    if (scan.peek() === '%') {
      scan.take();
      pct = true;
    } else {
      // A unit on a hue (deg) is skipped; turn and rad are not used by real files and read as degrees.
      while (scan.peek() >= 'a' && scan.peek() <= 'z') scan.take();
    }
    out.push({ v, pct });
  }
  return out.length === 3 || out.length === 4 ? out : null;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = (((h % 360) + 360) % 360) / 60;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((hue % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    hue < 1
      ? [c, x, 0]
      : hue < 2
        ? [x, c, 0]
        : hue < 3
          ? [0, c, x]
          : hue < 4
            ? [0, x, c]
            : hue < 5
              ? [x, 0, c]
              : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** The colour, or null for `none`, a `url()`, `currentColor` (the caller resolves those) or anything unreadable. */
export function parseColour(raw: string): Rgba | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (s[0] === '#') return fromHex(s.slice(1));
  if (s === 'transparent') return { hex: '#000000', alpha: 0 };
  const open = s.indexOf('(');
  if (open > 0 && s[s.length - 1] === ')') {
    const name = s.slice(0, open).trim();
    const args = functionArgs(s.slice(open + 1, -1));
    if (!args) return null;
    const alpha = args[3] ? clamp01(args[3].pct ? args[3].v / 100 : args[3].v) : 1;
    if (name === 'rgb' || name === 'rgba') {
      const ch = (a: { v: number; pct: boolean }) => (a.pct ? (a.v / 100) * 255 : a.v);
      return { hex: `#${byte(ch(args[0]!))}${byte(ch(args[1]!))}${byte(ch(args[2]!))}`, alpha };
    }
    if (name === 'hsl' || name === 'hsla') {
      const [r, g, b] = hslToRgb(args[0]!.v, clamp01(args[1]!.v / 100), clamp01(args[2]!.v / 100));
      return { hex: `#${byte(r)}${byte(g)}${byte(b)}`, alpha };
    }
    return null;
  }
  const hex = namedColour(s);
  return hex ? { hex, alpha: 1 } : null;
}
