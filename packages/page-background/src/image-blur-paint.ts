// The canvas step of a blurred page picture (docs/specs/007-editor/pages-mode.md "Image backgrounds", Blur), for the
// worker and the page's own path: kept apart from image-blur.ts so the stored value's rules, which the API Workers
// read through each product's model, never name a canvas type.
import { boxBlurRgba } from './image-blur';

/** The blurred copy of `source` on `ctx`, a canvas `plan.width` by `plan.height`: drawn small, then blurred in place.
 *  Throws when the browser will not hand the pixels over (a picture from another site). */
export function paintBlurredCopy(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  source: CanvasImageSource,
  plan: { width: number; height: number; sigma: number },
): void {
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, plan.width, plan.height);
  const pixels = ctx.getImageData(0, 0, plan.width, plan.height);
  boxBlurRgba(pixels.data, plan.width, plan.height, plan.sigma);
  ctx.putImageData(pixels, 0, 0);
}
