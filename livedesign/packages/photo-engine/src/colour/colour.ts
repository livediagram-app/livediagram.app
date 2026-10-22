// Colour maths for the engine: hex, HSL, HSV, and the luma the blend modes and adjustments use
// (docs/specs/031-photo/blueprints/DEFAULTS.md D6). Channels are 0 to 1 unless a name says bytes.

export type Rgb = [number, number, number];

/** `#rrggbb` as bytes; an unreadable colour is black. */
export function hexToBytes(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function bytesToHex(r: number, g: number, b: number): string {
  const h = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** The W3C blend spec's luminosity: 0.3 R + 0.59 G + 0.11 B. */
export function lum(r: number, g: number, b: number): number {
  return 0.3 * r + 0.59 * g + 0.11 * b;
}

/** Rec. 601 luma of bytes, rounded: the grey a picture reads as. */
export function lumaByte(r: number, g: number, b: number): number {
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

export function rgbToHsl(r: number, g: number, b: number): Rgb {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hueToRgb(p: number, q: number, t: number): number {
  let u = t;
  if (u < 0) u += 1;
  if (u > 1) u -= 1;
  if (u < 1 / 6) return p + (q - p) * 6 * u;
  if (u < 1 / 2) return q;
  if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
  return p;
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hueToRgb(p, q, h + 1 / 3), hueToRgb(p, q, h), hueToRgb(p, q, h - 1 / 3)];
}

export function rgbToHsv(r: number, g: number, b: number): Rgb {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  if (d === 0) return [0, s, max];
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, max];
}

export function hsvToRgb(h: number, s: number, v: number): Rgb {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (((i % 6) + 6) % 6) {
    case 0:
      return [v, t, p];
    case 1:
      return [q, v, p];
    case 2:
      return [p, v, t];
    case 3:
      return [p, q, v];
    case 4:
      return [t, p, v];
    default:
      return [v, p, q];
  }
}

// The W3C non-separable helpers (Compositing and Blending Level 1, section 9.2).
function clipColour(c: Rgb): Rgb {
  const l = lum(c[0], c[1], c[2]);
  const n = Math.min(c[0], c[1], c[2]);
  const x = Math.max(c[0], c[1], c[2]);
  let [r, g, b] = c;
  if (n < 0) {
    const k = l - n;
    r = l + ((r - l) * l) / k;
    g = l + ((g - l) * l) / k;
    b = l + ((b - l) * l) / k;
  }
  if (x > 1) {
    const k = x - l;
    r = l + ((r - l) * (1 - l)) / k;
    g = l + ((g - l) * (1 - l)) / k;
    b = l + ((b - l) * (1 - l)) / k;
  }
  return [r, g, b];
}

export function setLum(c: Rgb, l: number): Rgb {
  const d = l - lum(c[0], c[1], c[2]);
  return clipColour([c[0] + d, c[1] + d, c[2] + d]);
}

export function sat(c: Rgb): number {
  return Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
}

export function setSat(c: Rgb, s: number): Rgb {
  const out: Rgb = [0, 0, 0];
  const idx = [0, 1, 2].sort((a, b) => c[a]! - c[b]!);
  const [iMin, iMid, iMax] = idx as [number, number, number];
  const cMax = c[iMax]!;
  const cMin = c[iMin]!;
  if (cMax > cMin) {
    out[iMid] = ((c[iMid]! - cMin) * s) / (cMax - cMin);
    out[iMax] = s;
  }
  out[iMin] = 0;
  return out;
}
