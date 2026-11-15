// A page picture's Blur (docs/specs/007-editor/pages-mode.md "Image backgrounds", Blur, in livedocuments and
// livedesign): how strong a stored blur is on a page, and the pure half of the blurred copy the canvas paints, its size
// and its own blur, three box passes per axis with the picture's edges held. Shared by both products' page models
// (which re-export the stored value's rules), the worker that makes the copy off the main thread
// (image-blur-worker.ts) and the main-thread fallback (@liveworkspace/workbench/lib/page-image-blur). No DOM but the
// canvas types.

// A Blur of 100%: a Gaussian blur of this share of the page's shorter side.
export const PAGE_IMAGE_BLUR_MAX = 0.04;

/** A stored blur, clamped to 0..1 in steps of 0.05; undefined for none or a non-number. */
export function parsePageImageBlur(v: unknown): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  const b = Math.round(Math.min(1, Math.max(0, v)) * 20) / 20;
  return b > 0 ? b : undefined;
}

/** The blur's standard deviation in page px for a page of `rect`'s size; 0 for a sharp picture. */
export function pageImageBlurSigma(
  fill: { blur?: number },
  rect: { width: number; height: number },
): number {
  const b = parsePageImageBlur(fill.blur);
  return b ? b * PAGE_IMAGE_BLUR_MAX * Math.min(rect.width, rect.height) : 0;
}

/** Make the blurred copy of the picture at `src` for a page of `page` size, blurred by `sigma` page px: what the page
 *  asks the worker. */
export type BlurCopyRequest = {
  id: number;
  src: string;
  page: { width: number; height: number };
  sigma: number;
};

/** The copy as a JPEG, or why it could not be made (the page then makes it itself). */
export type BlurCopyResponse = { id: number; blob: Blob } | { id: number; failed: string };

// The copy's long side bounds, in px (livedocuments' D255, livedesign's D198).
export const BLUR_COPY_MIN = 96;
export const BLUR_COPY_MAX = 1024;
// The copy's blur in its own px aimed for: enough to look smooth when the copy is drawn up to the page.
const BLUR_COPY_SIGMA = 3;
export const BLUR_JPEG_QUALITY = 0.86;

/** Three box widths whose passes together blur as a Gaussian of `sigma` (as radii: a box is 2r + 1 wide). */
export function boxRadiiForSigma(sigma: number): [number, number, number] {
  const n = 3;
  const ideal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(ideal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
  const r = (i: number) => Math.max(0, ((i < m ? wl : wu) - 1) / 2);
  return [r(0), r(1), r(2)];
}

// One box pass along rows (`horizontal`) or columns, edges clamped, RGBA interleaved: a running sum per channel,
// so each pixel costs the same whatever the radius.
function boxPass(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  w: number,
  h: number,
  r: number,
  horizontal: boolean,
): void {
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const step = horizontal ? 4 : w * 4;
  const inv = 1 / (2 * r + 1);
  const last = len - 1;
  for (let line = 0; line < lines; line++) {
    const base = horizontal ? line * w * 4 : line * 4;
    let s0 = src[base]! * (r + 1);
    let s1 = src[base + 1]! * (r + 1);
    let s2 = src[base + 2]! * (r + 1);
    let s3 = src[base + 3]! * (r + 1);
    for (let i = 1; i <= r; i++) {
      const p = base + (i < last ? i : last) * step;
      s0 += src[p]!;
      s1 += src[p + 1]!;
      s2 += src[p + 2]!;
      s3 += src[p + 3]!;
    }
    for (let i = 0; i < len; i++) {
      const o = base + i * step;
      dst[o] = s0 * inv;
      dst[o + 1] = s1 * inv;
      dst[o + 2] = s2 * inv;
      dst[o + 3] = s3 * inv;
      const ai = i + r + 1;
      const di = i - r;
      const a = base + (ai < last ? ai : last) * step;
      const d = base + (di > 0 ? di : 0) * step;
      s0 += src[a]! - src[d]!;
      s1 += src[a + 1]! - src[d + 1]!;
      s2 += src[a + 2]! - src[d + 2]!;
      s3 += src[a + 3]! - src[d + 3]!;
    }
  }
}

/** RGBA pixels blurred in place as a Gaussian of `sigma` px, the picture's edge pixels held past its sides. */
export function boxBlurRgba(data: Uint8ClampedArray, w: number, h: number, sigma: number): void {
  if (sigma <= 0 || w === 0 || h === 0) return;
  const tmp = new Uint8ClampedArray(data.length);
  for (const r of boxRadiiForSigma(sigma)) {
    if (r === 0) continue;
    boxPass(data, tmp, w, h, r, true);
    boxPass(tmp, data, w, h, r, false);
  }
}

/** The copy's size and its own blur, for a picture of `natural` size covering a page of `page` size, blurred by
 *  `sigma` page px. */
export function blurCopyPlan(
  natural: { width: number; height: number },
  page: { width: number; height: number },
  sigma: number,
): { width: number; height: number; sigma: number } {
  const pageLong = Math.max(page.width, page.height);
  const long = Math.min(
    BLUR_COPY_MAX,
    Math.max(BLUR_COPY_MIN, Math.round((pageLong * BLUR_COPY_SIGMA) / sigma)),
  );
  // Copy px per page px, and the picture's page px per its own px when it covers the page.
  const q = long / pageLong;
  const cover = Math.max(page.width / natural.width, page.height / natural.height);
  let width = natural.width * cover * q;
  let height = natural.height * cover * q;
  // A very tall or wide picture never makes a copy past twice the cap on its long side.
  const over = Math.max(width, height) / (BLUR_COPY_MAX * 2);
  const shrink = over > 1 ? 1 / over : 1;
  width = Math.max(1, Math.round(width * shrink));
  height = Math.max(1, Math.round(height * shrink));
  return { width, height, sigma: Math.round(sigma * q * shrink * 10) / 10 };
}
