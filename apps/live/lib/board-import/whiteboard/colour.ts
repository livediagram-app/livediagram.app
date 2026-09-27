// Colours in Whiteboard markup (docs/specs/020-import-export/blueprints/whiteboard-import.md "Ink"):
// ink fills are `rgba(r,g,b,a)`; HTML items use `rgb()` and hex. A livediagram
// element keeps the colour as a hex and the translucency as its opacity.

export type Colour = { hex: string; alpha: number };

const KEYWORDS: Record<string, Colour> = {
  black: { hex: '#000000', alpha: 1 },
  white: { hex: '#ffffff', alpha: 1 },
  transparent: { hex: '#000000', alpha: 0 },
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const hex2 = (n: number) =>
  Math.round(clamp(n, 0, 255))
    .toString(16)
    .padStart(2, '0');

function alphaOf(raw: string | undefined): number | null {
  if (raw === undefined) return 1;
  const text = raw.trim();
  const n = text.endsWith('%') ? Number(text.slice(0, -1)) / 100 : Number(text);
  return Number.isFinite(n) ? clamp(n, 0, 1) : null;
}

function fromHex(text: string): Colour | null {
  const body = text.slice(1);
  if (!/^[0-9a-f]+$/i.test(body) || ![3, 4, 6, 8].includes(body.length)) return null;
  const full = body.length <= 4 ? [...body].map((c) => c + c).join('') : body;
  const alpha = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1;
  return { hex: `#${full.slice(0, 6).toLowerCase()}`, alpha };
}

const RGB = /^rgba?\(\s*([^)]*)\)$/i;

function fromRgb(text: string): Colour | null {
  const m = RGB.exec(text);
  if (!m) return null;
  const [channels, slashAlpha] = m[1]!.split('/');
  const parts = channels!
    .trim()
    .split(/\s*,\s*|\s+/)
    .filter((p) => p !== '');
  if (parts.length < 3 || parts.length > 4 || (parts.length === 4 && slashAlpha !== undefined)) {
    return null;
  }
  const rgb = parts.slice(0, 3).map(Number);
  if (rgb.some((n) => !Number.isFinite(n))) return null;
  const alpha = alphaOf(parts[3] ?? slashAlpha);
  if (alpha === null) return null;
  return { hex: `#${rgb.map(hex2).join('')}`, alpha };
}

/** A CSS colour as a hex plus alpha, or null when it is not a plain colour. */
export function readColour(value: string | null | undefined): Colour | null {
  const text = (value ?? '').trim().toLowerCase();
  if (text.startsWith('#')) return fromHex(text);
  if (text.startsWith('rgb')) return fromRgb(text);
  return KEYWORDS[text] ?? null;
}
