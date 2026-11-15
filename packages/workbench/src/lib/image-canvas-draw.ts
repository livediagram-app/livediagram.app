// A picture element painted on a 2D canvas for the PNG and PDF exports (docs/specs/009-elements/picture-crop-and-mask.md
// "Export and preview", in livedocuments and livedesign): clipped to its mask or its rounded box, on white, laid out
// by its crop or fitted by its fit, and grey when asked. The SVG export draws the same picture
// (@liveworkspace/element-model/svg-render-image-icon).

import {
  imageIsShaped,
  imageLayout,
  imageMaskPath,
  isImageMask,
  type ImageCrop,
} from '@liveworkspace/element-model/image-frame';
import { canvasFilters, greyCopy } from './image-greyscale';

/** What the painter reads of an element: its box, and an image's picture fields (absent on other kinds). */
export type CanvasPicture = {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  crop?: ImageCrop;
  mask?: unknown;
  greyscale?: boolean;
};

function roundedBox(ctx: CanvasRenderingContext2D, el: CanvasPicture, r: number): void {
  const { x, y, width: w, height: h } = el;
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/** Paint `img` as the element `el` shows it. `radius` rounds an unmasked box's corners. */
export function drawPictureOnCanvas(
  ctx: CanvasRenderingContext2D,
  el: CanvasPicture,
  img: HTMLImageElement,
  objectFit: 'cover' | 'contain',
  radius: number,
): void {
  const image = el.type === 'image' ? el : undefined;
  const mask = image && isImageMask(image.mask) ? image.mask : undefined;
  ctx.save();
  if (mask) {
    ctx.clip(new Path2D(imageMaskPath(mask, el.width, el.height, el.x, el.y)));
  } else {
    roundedBox(ctx, el, radius);
    ctx.clip();
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(el.x, el.y, el.width, el.height);
  const iw = img.naturalWidth || img.width || 0;
  const ih = img.naturalHeight || img.height || 0;
  // Greyscale: the canvas filter where there is one, else a grey copy of the picture.
  let source: CanvasImageSource = img;
  if (image?.greyscale === true) {
    if (canvasFilters(ctx)) ctx.filter = 'grayscale(1)';
    else source = greyCopy(img) ?? img;
  }
  if (iw > 0 && ih > 0) {
    if (image && imageIsShaped(image)) {
      const l = imageLayout(el, { width: iw, height: ih }, image.crop, objectFit);
      ctx.beginPath();
      ctx.rect(el.x + l.part.x, el.y + l.part.y, l.part.width, l.part.height);
      ctx.clip();
      ctx.drawImage(
        source,
        el.x + l.picture.x,
        el.y + l.picture.y,
        l.picture.width,
        l.picture.height,
      );
    } else {
      const scale =
        objectFit === 'cover'
          ? Math.max(el.width / iw, el.height / ih)
          : Math.min(el.width / iw, el.height / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.drawImage(source, el.x + (el.width - dw) / 2, el.y + (el.height - dh) / 2, dw, dh);
    }
  }
  ctx.restore();
}
