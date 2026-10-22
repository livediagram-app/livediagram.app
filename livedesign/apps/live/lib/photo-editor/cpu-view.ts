// The photo drawn without WebGL 2 (docs/specs/031-photo/blueprints/photo-engine.md "The GPU
// compositor" fallback, DEFAULTS D7, D9): the CPU composite of the visible part, at a resolution kept
// to about a megapixel, onto a 2D canvas over the checkerboard. Exact, slower; throttled by the caller.
import {
  compositePhoto,
  type CompositeOptions,
  type Photo,
  type PixelsLookup,
} from '@livedesign/photo-engine';
import type { ViewRect } from './gl/gl-compositor';

// The most pixels a CPU frame composites.
const CPU_FRAME_PIXELS = 1_000_000;

export function renderCpuView(
  canvas: HTMLCanvasElement,
  photo: Photo,
  pixels: PixelsLookup,
  view: ViewRect,
  opts: CompositeOptions & { dark?: boolean } = {},
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  // Photo px a frame draws: the view, shrunk to the budget.
  const scale = Math.min(1, Math.sqrt(CPU_FRAME_PIXELS / Math.max(1, view.width * view.height)));
  const step = 1 / scale;
  const rect = {
    x: Math.floor(view.x),
    y: Math.floor(view.y),
    width: Math.max(1, Math.ceil(view.width)),
    height: Math.max(1, Math.ceil(view.height)),
  };
  const full = compositePhoto(photo, pixels, rect, opts);
  const w = Math.max(1, Math.round(rect.width * scale));
  const h = Math.max(1, Math.round(rect.height * scale));
  const img = new ImageData(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = Math.min(rect.width - 1, Math.floor(x * step));
      const sy = Math.min(rect.height - 1, Math.floor(y * step));
      const si = (sy * rect.width + sx) * 4;
      img.data.set(full.data.subarray(si, si + 4), (y * w + x) * 4);
    }
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  off.getContext('2d')!.putImageData(img, 0, 0);
  // The checkerboard, then the picture over it.
  const c = 16;
  ctx.fillStyle = opts.dark ? '#1e293b' : '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = opts.dark ? '#0f172a' : '#f1f5f9';
  for (let y = 0; y < canvas.height; y += c)
    for (let x = (y / c) % 2 === 0 ? c : 0; x < canvas.width; x += c * 2) ctx.fillRect(x, y, c, c);
  ctx.imageSmoothingEnabled = view.width / canvas.width > 0.25;
  ctx.drawImage(
    off,
    (rect.x - view.x) * (canvas.width / view.width),
    (rect.y - view.y) * (canvas.height / view.height),
    rect.width * (canvas.width / view.width),
    rect.height * (canvas.height / view.height),
  );
}
