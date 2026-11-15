// How an image element's picture sits in its box (docs/specs/009-elements/picture-crop-and-mask.md): the part of
// the picture it keeps (its crop), the shape it is cut to (its mask) and where the picture lands for a fit. Pure,
// shared by the canvas, the SVG export, the PNG / PDF drawer and the crop overlay, so all of them draw the same.

// The kept part, as fractions of the picture's own width and height from its top-left corner.
export type ImageCrop = { x: number; y: number; width: number; height: number };

export const IMAGE_MASKS = [
  'circle',
  'rounded',
  'arch',
  'hexagon',
  'diamond',
  'triangle',
  'star',
  'blob',
] as const;
export type ImageMask = (typeof IMAGE_MASKS)[number];

// The smallest side a crop keeps, as a fraction of the picture.
export const IMAGE_CROP_MIN = 0.02;
// A rounded mask's corners: a fifth of the box's shorter side.
export const MASK_ROUNDED_RATIO = 0.2;
// A star's inner points, as a share of its outer radius.
export const MASK_STAR_INNER = 0.4;

const EPS = 1e-6;
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Whether a stored value is a crop every reader may draw. */
export function isImageCrop(v: unknown): v is ImageCrop {
  if (!v || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  if (!fin(c.x) || !fin(c.y) || !fin(c.width) || !fin(c.height)) return false;
  return (
    c.x >= 0 &&
    c.y >= 0 &&
    c.width >= IMAGE_CROP_MIN - EPS &&
    c.height >= IMAGE_CROP_MIN - EPS &&
    c.x + c.width <= 1 + EPS &&
    c.y + c.height <= 1 + EPS
  );
}

export function isImageMask(v: unknown): v is ImageMask {
  return typeof v === 'string' && (IMAGE_MASKS as readonly string[]).includes(v);
}

const r4 = (n: number) => Math.round(n * 10000) / 10000;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** A crop as it is stored: four decimals, kept inside the picture; undefined for the whole picture. */
export function cleanImageCrop(c: ImageCrop): ImageCrop | undefined {
  const width = clamp(r4(c.width), IMAGE_CROP_MIN, 1);
  const height = clamp(r4(c.height), IMAGE_CROP_MIN, 1);
  const x = clamp(r4(c.x), 0, r4(1 - width));
  const y = clamp(r4(c.y), 0, r4(1 - height));
  const whole = x < 0.001 && y < 0.001 && width > 0.999 && height > 0.999;
  return whole ? undefined : { x, y, width, height };
}

type Rect = { x: number; y: number; width: number; height: number };
type Size = { width: number; height: number };

/**
 * Where the kept part (`part`) and the whole picture (`picture`) sit in a box of `box`'s size, in box px: the part
 * fitted (contain) or covering (cover) the box and centred, the picture around it at the same scale. `natural` is
 * the picture's own size; without one the box's proportions stand in, so a crop still keeps its fractions.
 */
export function imageLayout(
  box: Size,
  natural: Size | null | undefined,
  crop: ImageCrop | null | undefined,
  fit: 'cover' | 'contain',
): { part: Rect; picture: Rect } {
  const nw = natural && natural.width > 0 ? natural.width : box.width;
  const nh = natural && natural.height > 0 ? natural.height : box.height;
  const c = crop && isImageCrop(crop) ? crop : { x: 0, y: 0, width: 1, height: 1 };
  const pw = c.width * nw;
  const ph = c.height * nh;
  const s =
    pw > 0 && ph > 0
      ? fit === 'cover'
        ? Math.max(box.width / pw, box.height / ph)
        : Math.min(box.width / pw, box.height / ph)
      : 1;
  const part = {
    x: (box.width - pw * s) / 2,
    y: (box.height - ph * s) / 2,
    width: pw * s,
    height: ph * s,
  };
  const picture = {
    x: part.x - c.x * nw * s,
    y: part.y - c.y * nh * s,
    width: nw * s,
    height: nh * s,
  };
  return { part, picture };
}

/** Whether a picture fills its box: always under a mask, else when it is set to cover. */
export function imageDrawsCover(el: { mask?: unknown; objectFit?: 'cover' | 'contain' }): boolean {
  return isImageMask(el.mask) || el.objectFit === 'cover';
}

/** Whether a picture needs the laid-out draw (a crop or a mask) rather than a plain fit. */
export function imageIsShaped(el: { crop?: unknown; mask?: unknown }): boolean {
  return isImageCrop(el.crop) || isImageMask(el.mask);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

// The blob in unit space: four anchor points, each with the two control points either side of it, going round
// clockwise from the top. Fixed, so every blob is the same blob.
const BLOB: readonly (readonly [number, number])[] = [
  [0.5, 0.02],
  [0.78, 0.02],
  [0.99, 0.22],
  [0.97, 0.5],
  [0.95, 0.8],
  [0.72, 0.99],
  [0.46, 0.97],
  [0.2, 0.95],
  [0.01, 0.76],
  [0.03, 0.46],
  [0.05, 0.18],
  [0.24, 0.02],
];

function polygon(points: readonly (readonly [number, number])[]): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${r2(x)} ${r2(y)}`).join('') + 'Z';
}

/**
 * The mask as an SVG path `d` in a box of `w` x `h` px placed at (`ox`, `oy`): the clip the canvas puts in
 * `clip-path: path()`, the SVG export in a `<clipPath>` and the PNG drawer in a `Path2D`. Numbers only.
 */
export function imageMaskPath(mask: ImageMask, w: number, h: number, ox = 0, oy = 0): string {
  const P = (x: number, y: number) => [ox + x, oy + y] as const;
  switch (mask) {
    case 'circle': {
      const rx = w / 2;
      const ry = h / 2;
      return (
        `M${r2(ox)} ${r2(oy + ry)}` +
        `A${r2(rx)} ${r2(ry)} 0 1 0 ${r2(ox + w)} ${r2(oy + ry)}` +
        `A${r2(rx)} ${r2(ry)} 0 1 0 ${r2(ox)} ${r2(oy + ry)}Z`
      );
    }
    case 'rounded': {
      const r = Math.min(w, h) * MASK_ROUNDED_RATIO;
      return (
        `M${r2(ox + r)} ${r2(oy)}H${r2(ox + w - r)}` +
        `A${r2(r)} ${r2(r)} 0 0 1 ${r2(ox + w)} ${r2(oy + r)}V${r2(oy + h - r)}` +
        `A${r2(r)} ${r2(r)} 0 0 1 ${r2(ox + w - r)} ${r2(oy + h)}H${r2(ox + r)}` +
        `A${r2(r)} ${r2(r)} 0 0 1 ${r2(ox)} ${r2(oy + h - r)}V${r2(oy + r)}` +
        `A${r2(r)} ${r2(r)} 0 0 1 ${r2(ox + r)} ${r2(oy)}Z`
      );
    }
    case 'arch': {
      const ry = Math.min(h, w / 2);
      return (
        `M${r2(ox)} ${r2(oy + h)}V${r2(oy + ry)}` +
        `A${r2(w / 2)} ${r2(ry)} 0 0 1 ${r2(ox + w)} ${r2(oy + ry)}` +
        `V${r2(oy + h)}Z`
      );
    }
    case 'hexagon':
      return polygon([
        P(0, h / 2),
        P(w / 4, 0),
        P((3 * w) / 4, 0),
        P(w, h / 2),
        P((3 * w) / 4, h),
        P(w / 4, h),
      ]);
    case 'diamond':
      return polygon([P(w / 2, 0), P(w, h / 2), P(w / 2, h), P(0, h / 2)]);
    case 'triangle':
      return polygon([P(w / 2, 0), P(w, h), P(0, h)]);
    case 'star': {
      const pts: (readonly [number, number])[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const k = i % 2 === 0 ? 1 : MASK_STAR_INNER;
        pts.push(P(w / 2 + Math.cos(a) * (w / 2) * k, h / 2 + Math.sin(a) * (h / 2) * k));
      }
      return polygon(pts);
    }
    case 'blob': {
      const at = (i: number) => {
        const [x, y] = BLOB[i % BLOB.length]!;
        return `${r2(ox + x * w)} ${r2(oy + y * h)}`;
      };
      // Anchors at 0, 3, 6, 9; the points between are their control points.
      let d = `M${at(0)}`;
      for (let i = 0; i < 4; i++) d += `C${at(i * 3 + 1)} ${at(i * 3 + 2)} ${at(i * 3 + 3)}`;
      return d + 'Z';
    }
  }
}
