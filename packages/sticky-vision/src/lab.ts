import type { ImageBuffer } from './colour';

// CIELAB (D65 white, sRGB primaries): the colour space where a distance is a
// difference a person sees (spec/139 Phase 9).
//
// HSV saturation is the wrong ruler for pale paper on a white wall: a pale
// yellow aggregate and a white wall differ by a sliver of saturation that the
// wall's own noise matches, but by ΔE≈20 in CIELAB, almost all of it on b*.
// Lightness (L*) is also perceptual, so "a third darker than the wall" means
// the same thing on kraft and on a whiteboard.

export type Lab = { l: number; a: number; b: number };

// The three planes of a whole image, one float per pixel each.
export type LabImage = {
  width: number;
  height: number;
  l: Float32Array;
  a: Float32Array;
  b: Float32Array;
};

// D65 reference white.
const XN = 0.95047;
const YN = 1;
const ZN = 1.08883;
// The CIE's linear segment near black, where a cube root would be infinitely
// steep.
const EPSILON = 216 / 24389;
const KAPPA = 24389 / 27;

// sRGB's transfer curve, undone once per possible byte rather than per pixel.
const LINEAR = new Float64Array(256);
for (let v = 0; v < 256; v += 1) {
  const c = v / 255;
  LINEAR[v] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function f(t: number): number {
  return t > EPSILON ? Math.cbrt(t) : (KAPPA * t + 16) / 116;
}

// Writable planes: a caller's scratch arrays or a whole image's.
type Planes = { l: Record<number, number>; a: Record<number, number>; b: Record<number, number> };

// Writes into three planes at `p`, so the whole-image pass allocates nothing
// per pixel.
function convertInto(r: number, g: number, b: number, out: Planes, p: number): void {
  const lr = LINEAR[r]!;
  const lg = LINEAR[g]!;
  const lb = LINEAR[b]!;
  const x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / XN;
  const y = (0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb) / YN;
  const z = (0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb) / ZN;
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  out.l[p] = 116 * fy - 16;
  out.a[p] = 500 * (fx - fy);
  out.b[p] = 200 * (fy - fz);
}

export function rgbToLab(r: number, g: number, b: number): Lab {
  const out = { l: [0], a: [0], b: [0] };
  convertInto(r | 0, g | 0, b | 0, out, 0);
  return { l: out.l[0]!, a: out.a[0]!, b: out.b[0]! };
}

// CIE76: plain Euclidean distance. The refinements (CIE94, CIEDE2000) matter
// for telling near-identical swatches apart, not for paper against a wall.
export function deltaE(p: Lab, q: Lab): number {
  return Math.hypot(p.l - q.l, p.a - q.a, p.b - q.b);
}

export function labImageOf(image: ImageBuffer): LabImage {
  const n = image.width * image.height;
  const out = {
    width: image.width,
    height: image.height,
    l: new Float32Array(n),
    a: new Float32Array(n),
    b: new Float32Array(n),
  };
  const { data } = image;
  for (let p = 0, i = 0; p < n; p += 1, i += 4) {
    convertInto(data[i]!, data[i + 1]!, data[i + 2]!, out, p);
  }
  return out;
}
