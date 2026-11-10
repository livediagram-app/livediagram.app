// A page picture's Blur on the canvas (docs/specs/007-editor/pages-mode.md "Image backgrounds", Blur): a blurred
// copy made once per picture and strength, drawn small (a blurred picture has no detail to keep), blurred by three
// box passes per axis with its edges held, and painted by the sheet as any picture is. Never a CSS blur filter, so
// a pan or a zoom never blurs again. The exports draw an SVG feGaussianBlur instead (page-frame.ts).

// The copy's long side bounds, in px (D255).
export const BLUR_COPY_MIN = 96;
export const BLUR_COPY_MAX = 1024;
// The copy's blur in its own px aimed for: enough to look smooth when the copy is drawn up to the page.
const BLUR_COPY_SIGMA = 3;
// How many copies are kept once no sheet shows them.
export const BLUR_CACHE_SIZE = 8;
const JPEG_QUALITY = 0.86;

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

type Entry = { url: Promise<string | null>; refs: number };
const cache = new Map<string, Entry>();
let queue: Promise<unknown> = Promise.resolve();

async function makeCopy(
  src: string,
  page: { width: number; height: number },
  sigma: number,
): Promise<string | null> {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  const plan = blurCopyPlan({ width: img.naturalWidth, height: img.naturalHeight }, page, sigma);
  const canvas = document.createElement('canvas');
  canvas.width = plan.width;
  canvas.height = plan.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, plan.width, plan.height);
  const pixels = ctx.getImageData(0, 0, plan.width, plan.height);
  boxBlurRgba(pixels.data, plan.width, plan.height, plan.sigma);
  ctx.putImageData(pixels, 0, 0);
  const blob = await new Promise<Blob | null>((done) =>
    canvas.toBlob(done, 'image/jpeg', JPEG_QUALITY),
  );
  return blob ? URL.createObjectURL(blob) : null;
}

const keyOf = (src: string, page: { width: number; height: number }, sigma: number) =>
  `${Math.round(page.width)}x${Math.round(page.height)}|${Math.round(sigma * 10) / 10}|${src}`;

function evict(): void {
  if (cache.size <= BLUR_CACHE_SIZE) return;
  for (const [key, entry] of cache) {
    if (cache.size <= BLUR_CACHE_SIZE) break;
    if (entry.refs > 0) continue;
    cache.delete(key);
    void entry.url.then((u) => u && URL.revokeObjectURL(u));
  }
}

/**
 * A blurred copy of a picture for a page, as a blob URL (null when it cannot be made: a picture whose pixels the
 * browser will not hand over). Held until `release`; one copy is made at a time.
 */
export function acquireBlurredImage(
  src: string,
  page: { width: number; height: number },
  sigma: number,
): { url: Promise<string | null>; release: () => void } {
  const key = keyOf(src, page, sigma);
  let entry = cache.get(key);
  if (!entry) {
    const url = queue.then(() => makeCopy(src, page, sigma)).catch(() => null);
    queue = url;
    entry = { url, refs: 0 };
    cache.set(key, entry);
  } else {
    // Most recently used last, so eviction takes the oldest first.
    cache.delete(key);
    cache.set(key, entry);
  }
  entry.refs++;
  const held = entry;
  let released = false;
  return {
    url: held.url,
    release: () => {
      if (released) return;
      released = true;
      held.refs--;
      evict();
    },
  };
}

/** Forgets every copy (tests). */
export function clearBlurCache(): void {
  for (const entry of cache.values()) void entry.url.then((u) => u && URL.revokeObjectURL(u));
  cache.clear();
}
