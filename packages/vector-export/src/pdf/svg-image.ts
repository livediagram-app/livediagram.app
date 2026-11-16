// An SVG `<image>` on a PDF page (liveworkspace/docs/specs/013-export/vector-pdf.md "Pictures and the fallback"): placed by its x, y, size and
// preserveAspectRatio. A JPEG keeps its own bytes; any other picture is drawn at no more than three device pixels per
// CSS pixel of the size it shows (so a huge photo shown small doesn't swell the file). One picture used on many
// pages (a deck's repeated background) is stored once.
import { lengthScale, matrixOps, multiply, num } from './matrix';
import { dataUrlBytes, loadPixels, putJpeg, putPixels } from './pdf-image';
import type { SvgContext } from './svg-context';
import { viewBoxMatrix } from './svg-transform';

// Device pixels per CSS pixel a picture is kept at, at most.
export const IMAGE_MAX_SCALE = 3;

const hrefOf = (el: Element) => el.getAttribute('href') ?? el.getAttribute('xlink:href') ?? '';

/** Draws the picture, `alpha` its opacity. Nothing for one that fails to load. */
export async function drawImage(ctx: SvgContext, el: Element, alpha: number): Promise<void> {
  const n = (name: string) => {
    const v = parseFloat(el.getAttribute(name) ?? '');
    return Number.isFinite(v) ? v : 0;
  };
  const port = { x: n('x'), y: n('y'), w: n('width'), h: n('height') };
  const href = hrefOf(el);
  if (!href || port.w <= 0 || port.h <= 0) return;
  // The size it shows, in device pixels at the cap.
  const pagePerUnit = lengthScale(multiply(ctx.rootToPage, ctx.toRoot));
  const maxW = Math.max(1, Math.ceil((port.w * pagePerUnit * IMAGE_MAX_SCALE) / 0.75));
  const maxH = Math.max(1, Math.ceil((port.h * pagePerUnit * IMAGE_MAX_SCALE) / 0.75));
  const key = `${maxW}x${maxH}|${href}`;
  let img = ctx.images.get(key);
  if (!img) {
    try {
      const data = dataUrlBytes(href);
      const jpeg = data && data.type === 'image/jpeg' ? putJpeg(ctx.file, data.bytes) : null;
      let stored = jpeg;
      if (!stored) {
        const px = await loadPixels(href, maxW, maxH);
        stored = { obj: putPixels(ctx.file, px), width: px.width, height: px.height };
      }
      img = { ...stored, name: ctx.res.name('XObject', stored.obj) };
    } catch (err) {
      console.warn('[pdf] picture left out', err instanceof Error ? err.message : err);
      return;
    }
    ctx.images.set(key, img);
  }
  const fit = viewBoxMatrix(
    { x: 0, y: 0, w: img.width, h: img.height },
    port,
    el.getAttribute('preserveAspectRatio'),
  );
  const out = ctx.out;
  out.push('q');
  if (alpha < 1) out.push(`/${ctx.res.state(alpha, alpha)} gs`);
  // Sliced pictures spill past their box; it clips them.
  out.push(`${num(port.x)} ${num(port.y)} ${num(port.w)} ${num(port.h)} re W n`);
  out.push(
    matrixOps(fit),
    matrixOps([img.width, 0, 0, -img.height, 0, img.height]),
    `/${img.name} Do`,
    'Q',
  );
}
