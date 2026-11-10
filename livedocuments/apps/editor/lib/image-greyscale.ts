// A picture drawn without colour on a 2D canvas (docs/specs/009-elements/picture-crop-and-mask.md "Export and
// preview"): the canvas's own `grayscale` filter where the browser has one, else a grey copy of the picture's
// pixels made once per picture (Rec. 709 luminance, as the SVG export's colour matrix).

/** Whether this context applies CSS filters (a Safari without `ctx.filter` keeps 'none' after a write). */
export function canvasFilters(ctx: CanvasRenderingContext2D): boolean {
  if (typeof ctx.filter !== 'string') return false;
  const before = ctx.filter;
  ctx.filter = 'grayscale(1)';
  const ok = ctx.filter === 'grayscale(1)';
  ctx.filter = before;
  return ok;
}

/** RGBA pixels turned to their luminance in place; alpha kept. */
export function greyPixels(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const y = 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
    data[i] = y;
    data[i + 1] = y;
    data[i + 2] = y;
  }
}

const copies = new WeakMap<CanvasImageSource, HTMLCanvasElement>();

/** A grey copy of a picture, made once per picture (kept while the picture is). */
export function greyCopy(img: HTMLImageElement): HTMLCanvasElement | null {
  const hit = copies.get(img);
  if (hit) return hit;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  if (!c) return null;
  c.drawImage(img, 0, 0);
  const pixels = c.getImageData(0, 0, w, h);
  greyPixels(pixels.data);
  c.putImageData(pixels, 0, 0);
  copies.set(img, canvas);
  return canvas;
}
