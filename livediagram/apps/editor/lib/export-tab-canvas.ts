// The PNG / PDF path (export-tab.ts): a tab drawn onto a canvas, its backdrop pattern rasterised from the SVG export's
// own tile, isometric tabs drawn in depth bands. Split out of export-tab.ts, which re-exports renderTabToCanvas and
// renderedExportScale.

import {
  arrowLabelFontStack,
  arrowLabelPass,
  isBoxed,
  layerBands,
  layerOpacityOf,
  exportFontIds,
  visibleLayerElements,
  type BoxedElement,
  type Tab,
} from '@livediagram/document';
import {
  canvasSurface,
  boxedNeedsSvgRaster,
  contentBounds,
  EXPORT_BG,
  EXPORT_PADDING,
  r2,
  supportsShadow,
  svgArrow,
  sketchBackdropIds,
  svgBoxed,
  svgShadowDefs,
} from '@livediagram/document';
import {
  resolveIconArtLoaded,
  resolveStickerArtLoaded,
} from '@liveworkspace/workbench/lib/icon-registry';
import { isoCanvasMatrix, isoProjectBounds } from './isometric';
import { drawBoxed, drawBoxedExtrusion } from './export-tab-canvas-draw';
import { exportChartInk } from './export-chart-ink';
import { exportScale, MAX_EXPORT_CANVAS_SIDE } from '@liveworkspace/model-core/export-canvas';
import { embeddedFontFaceCss } from './export-fonts';
import { backgroundPatternDefs, type ImageExportOpts } from './export-tab-parts';

// Rasterise an SVG string to an Image (for drawing the pattern onto the PNG /
// PDF canvas). Browser-only; the canvas renderer is never reached in non-DOM
// test runs (no 2D context there).
function svgToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('pattern render failed'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

// How far past a whole pixel a size may be from float arithmetic alone (1024 x 2.0000000001) and still count as
// that whole pixel when the canvas is sized.
const PART_PIXEL_NOISE = 1e-6;

// The scale each rendered canvas was drawn at, so a caller can size it in CSS
// px (the single-page PDF prints it at 0.75 pt per CSS px, not per pixel).
const renderedScale = new WeakMap<HTMLCanvasElement, number>();

/** The scale `renderTabToCanvas` drew this canvas at (CSS px x scale = pixels); 1 if unknown. */
export function renderedExportScale(canvas: HTMLCanvasElement): number {
  return renderedScale.get(canvas) ?? 1;
}

export async function renderTabToCanvas(
  tab: Tab,
  opts: { scale?: number } & ImageExportOpts = {},
): Promise<HTMLCanvasElement> {
  const chartInk = exportChartInk(tab);
  // Hidden layers drop out of the export (bounds included) unless the
  // dialog's include-hidden option is on (docs/specs/006-document/layers.md). `ordered` is the
  // paint order (layer bands bottom -> top, frames first per band),
  // with each element carrying its band's opacity factor.
  const els = opts.hiddenLayers ? tab.elements : visibleLayerElements(tab.elements, tab.layers);
  const ordered = layerBands(tab.elements, tab.layers, {
    includeHidden: opts.hiddenLayers,
  }).flatMap((band) => band.elements.map((el) => ({ el, alpha: layerOpacityOf(band.layer) })));
  // Every caption laid out once, as the canvas and the SVG export do
  // (docs/specs/008-canvas/arrow-labels.md); the bounds include the plates.
  // Shapes something sits on keep a solid fill under Sketch, as on the canvas (sketch-backdrop.ts).
  const backdrops = sketchBackdropIds(els, tab.finish);
  const labels = arrowLabelPass(tab.elements, {
    fontFamilyOf: (a) => arrowLabelFontStack(a, tab.font, tab.finish),
  });
  const bounds = contentBounds(els, labels, tab.elements);
  const pad = EXPORT_PADDING;
  // Isometric export (docs/specs/008-canvas/isometric-view.md / 48): project the flat content through the iso
  // affine and size the canvas to the tilted footprint so nothing clips. The
  // matrix is applied to the drawing context after positioning, so every
  // element / arrow drawer stays in plain canvas coordinates.
  const iso = opts.isometric ? isoCanvasMatrix() : null;
  const draw = iso ? isoProjectBounds(bounds, iso) : bounds;
  // 2x for crisp output, lowered so the canvas fits the largest every browser draws (side and area).
  const scale = exportScale(opts.scale ?? 2, draw.w + pad * 2, draw.h + pad * 2);
  const w = (draw.w + pad * 2) * scale;
  const h = (draw.h + pad * 2) * scale;
  const canvas = document.createElement('canvas');
  // A part pixel rounds up, so a part-pixel size (a box of 360.5 x 55.9 with its padding) keeps its last row
  // and column; a hair under a whole one (float noise) stays whole, and no side passes the canvas limit.
  const pixels = (n: number) =>
    Math.max(1, Math.min(MAX_EXPORT_CANVAS_SIDE, Math.ceil(n - PART_PIXEL_NOISE)));
  canvas.width = pixels(w);
  canvas.height = pixels(h);
  renderedScale.set(canvas, scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  // Background colour, painted across the whole canvas BEFORE the iso tilt so
  // the triangular margins around the parallelogram fill too. The pattern (if
  // on) sits flat over it, like the editor, whose backdrop never tilts.
  const bgColor = tab.backgroundColor ?? EXPORT_BG;
  // Elements that carry no colours of their own are drawn in the ink of the
  // paper being exported onto (docs/specs/007-editor/editor-app.md), so a dark canvas exports dark-canvas
  // elements rather than pale ones.
  const surface = canvasSurface(bgColor);
  // The paper under the content: a hollow arrowhead is filled with it, as on the canvas.
  const paper = bgColor;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, w / scale, h / scale);
  const bg = backgroundPatternDefs(tab, opts);
  if (bg) {
    const wu = w / scale;
    const hu = h / scale;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.floor(w)}" height="${Math.floor(h)}" viewBox="0 0 ${r2(wu)} ${r2(hu)}">` +
      `${bg.defs}<rect width="${r2(wu)}" height="${r2(hu)}" fill="${bg.fill}"/></svg>`;
    try {
      const img = await svgToImage(svg);
      ctx.drawImage(img, 0, 0, wu, hu);
    } catch {
      // Pattern is decorative, a render failure must never abort the export.
    }
  }
  // Position the (projected) content min-corner at the padding offset, then
  // apply the iso projection so element coords map onto the tilted plane.
  ctx.translate(pad - draw.x, pad - draw.y);
  if (iso) ctx.transform(iso.a, iso.b, iso.c, iso.d, 0, 0);

  // Isometric: paint every element's extrusion column first, so all the
  // depth sits behind all the element bodies (matching the editor's single
  // depth plane behind the element layer).
  if (iso) {
    for (const { el, alpha } of ordered) {
      if (el.type !== 'arrow') drawBoxedExtrusion(ctx, el, alpha, surface);
    }
  }
  // `ordered` keeps frame sections behind their contents
  // (docs/specs/008-canvas/canvas-and-palette.md).
  const resolveImage = opts.images ? (id: string) => opts.images!.get(id)?.image : undefined;
  // Elements the canvas drawers can't reproduce (tables, freehand, shape
  // silhouettes, rotation, icon glyphs: boxedNeedsSvgRaster) rasterise via
  // the SAME svg markup the SVG export emits, so the PNG/PDF output can't
  // drift from it. Pre-rendered async here (the draw loop below stays
  // sync), padded for stroke overflow, and for the rotated bounding box
  // when the element carries a rotation, since svgBoxed bakes the rotation
  // into the markup and it sweeps outside the unrotated box. A failed
  // rasterise falls back to drawBoxed's plain box.
  // The tab default face (docs/specs/004-interface-design/fonts.md) every element without its own inherits.
  const tabFont = tab.font;
  // Webfont bytes for the faces in play. A rasterised fragment is loaded as
  // an <img>, which blocks external resources outright, so a marker note
  // would come back in the fallback face unless the font travels INSIDE the
  // markup. Fetched once here and inlined into every fragment below.
  const fontCss =
    opts.fontCss ?? (await embeddedFontFaceCss(exportFontIds(els, tab.font, tab.finish)));
  // The canvas drawers paint through the DOM's own font set, so wait for it
  // to settle, rasterising mid-swap bakes the fallback face into the PNG.
  await document.fonts?.ready;
  const fontDefs = fontCss ? `<defs><style type="text/css">${fontCss}</style></defs>` : '';
  const rasterImages = new Map<string, { image: HTMLImageElement; pad: number }>();
  for (const el of els) {
    if (el.type === 'arrow' || !isBoxed(el)) continue;
    if (!boxedNeedsSvgRaster(el, resolveIconArtLoaded, resolveStickerArtLoaded, tab.finish))
      continue;
    const diag = Math.hypot(el.width, el.height);
    // A shadow sweeps outside the box by its offset + blur (docs/specs/008-canvas/element-shadows.md);
    // grow the raster pad so it isn't clipped, and inline its filter
    // def (the fragment has no document <defs> to resolve against).
    const shadow = supportsShadow(el) && el.shadow ? el.shadow : undefined;
    const shadowPad = shadow
      ? Math.max(Math.abs(shadow.offsetX), Math.abs(shadow.offsetY)) + shadow.blur
      : 0;
    const pad = (el.rotation ? (diag - Math.min(el.width, el.height)) / 2 + 2 : 2) + shadowPad;
    const w = el.width + pad * 2;
    const h = el.height + pad * 2;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(w * scale)}" height="${r2(h * scale)}"` +
      ` viewBox="${r2(el.x - pad)} ${r2(el.y - pad)} ${r2(w)} ${r2(h)}">` +
      `${fontDefs}${svgShadowDefs([el])}${svgBoxed(el, {
        resolveIconArt: resolveIconArtLoaded,
        resolveStickerArt: resolveStickerArtLoaded,
        // An image drawn this way (a shadow, a turn, an accent edge, a finish) embeds its bytes
        // like the SVG export, not the empty-image placeholder.
        resolveImageHref: (id) => opts.images?.get(id)?.href,
        tabFont,
        tabFinish: tab.finish,
        sketchBackdrop: backdrops.has(el.id),
        surface,
        ...chartInk,
      })}</svg>`;
    try {
      rasterImages.set(el.id, { image: await svgToImage(svg), pad });
    } catch {
      // Fall through to drawBoxed's plain box below.
    }
  }
  // One pass in the canvas's paint order (docs/specs/006-document/layers.md): arrows and boxes
  // interleave by array order, so an arrow sent behind a box stays behind it.
  // Arrows rasterise from the SAME markup the SVG export emits (heads, fans,
  // wrapped captions, knockouts, route-behind gaps), batched: each run of
  // consecutive arrows becomes one full-size layer. Endpoint resolution keeps
  // the FULL list, so an arrow pinned to a hidden element still lands where
  // the canvas draws it.
  const ax = bounds.x - pad;
  const ay = bounds.y - pad;
  const aw = bounds.w + pad * 2;
  const ah = bounds.h + pad * 2;
  let arrowRun: string[] = [];
  const flushArrows = async () => {
    if (arrowRun.length === 0) return;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(aw * scale)}" height="${r2(ah * scale)}"` +
      ` viewBox="${r2(ax)} ${r2(ay)} ${r2(aw)} ${r2(ah)}">${fontDefs}${arrowRun.join('')}</svg>`;
    arrowRun = [];
    ctx.drawImage(await svgToImage(svg), ax, ay, aw, ah);
  };
  for (const { el, alpha } of ordered) {
    if (el.type === 'arrow') {
      const svg = svgArrow(
        el,
        tab.elements,
        surface,
        tabFont,
        labels,
        undefined,
        els,
        paper,
        tab.finish,
      );
      arrowRun.push(alpha < 1 ? `<g opacity="${r2(alpha)}">${svg}</g>` : svg);
      continue;
    }
    await flushArrows();
    drawOne(ctx, el, alpha);
  }
  await flushArrows();
  return canvas;

  function drawOne(c: CanvasRenderingContext2D, el: BoxedElement, alpha: number) {
    const raster = rasterImages.get(el.id);
    if (raster) {
      // The raster bakes the ELEMENT's opacity into its markup; the
      // band's factor applies here.
      c.globalAlpha = alpha;
      c.drawImage(
        raster.image,
        el.x - raster.pad,
        el.y - raster.pad,
        el.width + raster.pad * 2,
        el.height + raster.pad * 2,
      );
      c.globalAlpha = 1;
      return;
    }
    drawBoxed(c, el, resolveImage, alpha, tabFont, surface);
  }
}
