// The per-element fallback (liveworkspace/docs/specs/013-export/vector-pdf.md "Pictures and the fallback"): an element PDF has no vector form
// for (a filter such as a shadow, a mask, a foreign object, a marker, a translucent gradient, text in a face the file
// does not embed) is drawn by the browser on its own, transparent around it, and placed as a picture exactly where it
// sits. Everything else on the page stays vector.
import { invert, mapRect, matrixOps, multiply, num, type Matrix } from './matrix';
import { putPixels, type Pixels } from './pdf-image';
import { byId, type SvgContext } from './svg-context';
import { refId, styleOf } from './svg-style';
import { parseTransform, type Box } from './svg-transform';

// The largest fallback picture, in pixels: past it the scale comes down (an iOS canvas past 16.7 MP draws nothing).
export const MAX_RASTER_PIXELS = 8_000_000;
// Elements that draw nothing themselves but are referenced: kept in the isolated copy.
const DEFINITIONS = new Set([
  'defs',
  'style',
  'clipPath',
  'mask',
  'pattern',
  'linearGradient',
  'radialGradient',
  'filter',
  'marker',
  'symbol',
]);
// What an ancestor's own effects are: the PDF already applies them around the picture.
const ANCESTOR_EFFECTS = ['opacity', 'clip-path', 'mask', 'filter', 'mix-blend-mode'];

// The ids an element's markup points at: url(#id) and href="#id".
function referencedIds(el: Element): Set<string> {
  const ids = new Set<string>();
  const html = el.outerHTML;
  for (const m of html.matchAll(/(?:url\(\s*["']?|href=")#([^"')\s]+)/g)) ids.add(m[1]!);
  return ids;
}

/** The root's markup with only `el`, its ancestors and the definitions left (and the page's faces), cut to `crop`.
 *  Built from the path down to `el` alone, so a picture of one element costs that element, not the whole page. */
export function isolatedSvg(
  root: SVGSVGElement,
  el: Element,
  crop: Box,
  pxW: number,
  pxH: number,
  fontCss = '',
): string {
  const copy = root.cloneNode(false) as Element;
  const kept = new Set<Element>();
  const build = (orig: Element, into: Element) => {
    for (const child of orig.children) {
      if (child === el) into.appendChild(el.cloneNode(true));
      else if (child.contains(el)) {
        const c = child.cloneNode(false) as Element;
        for (const name of ANCESTOR_EFFECTS) {
          c.removeAttribute(name);
          (c as SVGElement).style?.removeProperty(name);
        }
        into.appendChild(c);
        build(child, c);
      } else if (DEFINITIONS.has(child.localName)) {
        into.appendChild(child.cloneNode(true));
        kept.add(child);
      }
    }
  };
  build(root, copy);
  // A definition the element points at from elsewhere on the page (inside another element's group).
  const defs = copy.ownerDocument.createElementNS(copy.namespaceURI, 'defs');
  for (const id of referencedIds(el)) {
    const def = root.querySelector(`[id="${id.replace(/["\\]/g, '\\$&')}"]`);
    if (def && !el.contains(def) && ![...kept].some((k) => k.contains(def)))
      defs.appendChild(def.cloneNode(true));
  }
  if (defs.childElementCount) copy.insertBefore(defs, copy.firstChild);
  if (fontCss) {
    const style = copy.ownerDocument.createElementNS(copy.namespaceURI, 'style');
    style.textContent = fontCss;
    copy.insertBefore(style, copy.firstChild);
  }
  copy.setAttribute('viewBox', `${num(crop.x)} ${num(crop.y)} ${num(crop.w)} ${num(crop.h)}`);
  copy.setAttribute('width', String(pxW));
  copy.setAttribute('height', String(pxH));
  copy.setAttribute('preserveAspectRatio', 'none');
  return new XMLSerializer().serializeToString(copy);
}

async function drawSvg(svg: string, w: number, h: number): Promise<Pixels> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('PDF: a fallback picture failed to draw'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('PDF rendering failed: no 2d context');
  c.drawImage(img, 0, 0, w, h);
  return { width: w, height: h, data: c.getImageData(0, 0, w, h).data };
}

function bboxOf(el: Element): Box | null {
  try {
    const b = (el as SVGGraphicsElement).getBBox();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  } catch {
    return null;
  }
}

// How far past its geometry an element can paint: its filter's region (a shadow's offset and blur), else its stroke.
function margins(ctx: SvgContext, el: Element, box: Box): Box {
  const id = refId(styleOf(el)('filter'));
  const filter = id ? byId(ctx, id) : null;
  if (filter && filter.getAttribute('filterUnits') !== 'userSpaceOnUse') {
    const frac = (name: string, d: number) => {
      const v = filter.getAttribute(name);
      if (v === null) return d;
      const n = parseFloat(v);
      return v.trim().endsWith('%') ? n / 100 : n;
    };
    return {
      x: box.x + frac('x', -0.1) * box.w,
      y: box.y + frac('y', -0.1) * box.h,
      w: frac('width', 1.2) * box.w,
      h: frac('height', 1.2) * box.h,
    };
  }
  // A stroke, a marker or a glyph's overhang: a generous ring, cut to the page below.
  const pad = Math.max(4, 0.1 * Math.max(box.w, box.h));
  return { x: box.x - pad, y: box.y - pad, w: box.w + 2 * pad, h: box.h + 2 * pad };
}

function intersect(a: Box, b: Box): Box | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w);
  const bt = Math.min(a.y + a.h, b.y + b.h);
  return r > x && bt > y ? { x, y, w: r - x, h: bt - y } : null;
}

/** Draws `el` (in the current user space, its own transform not yet applied) as a picture. False when it covers
 *  nothing on the page. */
export async function rasterElement(ctx: SvgContext, el: Element): Promise<boolean> {
  const own = parseTransform(el.getAttribute('transform'));
  const elToRoot: Matrix = multiply(ctx.toRoot, own);
  const box = bboxOf(el);
  if (!box) return false;
  const crop = intersect(mapRect(elToRoot, margins(ctx, el, box)), ctx.view);
  if (!crop) return false;
  const pagePerRoot = Math.sqrt(Math.abs(ctx.rootToPage[0] * ctx.rootToPage[3]));
  // CSS px per root unit at 0.75 pt per px, times the device scale, held under the pixel cap.
  let px = (pagePerRoot / 0.75) * ctx.rasterScale;
  const area = crop.w * crop.h * px * px;
  if (area > MAX_RASTER_PIXELS) px *= Math.sqrt(MAX_RASTER_PIXELS / area);
  const w = Math.max(1, Math.ceil(crop.w * px));
  const h = Math.max(1, Math.ceil(crop.h * px));
  // The faces only travel with an element that has text: they can be the heaviest part of the page.
  const css = el.localName === 'text' || el.querySelector('text') ? ctx.fontCss : '';
  const pixels = await drawSvg(isolatedSvg(ctx.root, el, crop, w, h, css), w, h);
  const obj = putPixels(ctx.file, pixels);
  const name = ctx.res.name('XObject', obj);
  const back = invert(ctx.toRoot);
  if (!back) return false;
  ctx.out.push(
    'q',
    matrixOps(back),
    matrixOps([crop.w, 0, 0, -crop.h, crop.x, crop.y + crop.h]),
    `/${name} Do`,
    'Q',
  );
  return true;
}
